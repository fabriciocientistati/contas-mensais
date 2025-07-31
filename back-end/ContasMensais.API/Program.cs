using ContasMensais.API.DbContext;
using ContasMensais.API.Dtos;
using ContasMensais.API.Jobs;
using ContasMensais.API.Models;
using ContasMensais.API.Validators;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Quartz;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// ✅ Define o tipo de licença gratuita para QuestPDF
QuestPDF.Settings.License = LicenseType.Community;

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Listen(System.Net.IPAddress.Any, 5000);
});

Console.WriteLine("Fuso horário: " + TimeZoneInfo.Local);

// Configurações
builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddUserSecrets<Program>()
    .AddEnvironmentVariables();

Console.WriteLine($"Ambiente: {builder.Environment.EnvironmentName}");
Console.WriteLine($"Conexão: {builder.Configuration.GetConnectionString("DefaultConnection") ?? "NÃO ENCONTRADA"}");

if (builder.Environment.IsDevelopment())
{
    Console.WriteLine("📦 Usando SQLite no ambiente Development");
    var dataDir = Path.Combine(Directory.GetCurrentDirectory(), "data");

    if (!Directory.Exists(dataDir))
        Directory.CreateDirectory(dataDir);

        builder.Services.AddDbContext<AppDbContext>(options =>
            options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=app.db"));
}
else
{
    Console.WriteLine("🐘 Usando PostgreSQL em Produção");
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<ContaValidators>();

builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("EmailJob");

    q.AddJob<EmailJob>(opts => opts.WithIdentity(jobKey));

    q.AddTrigger(opts => opts.ForJob(jobKey).WithIdentity("EmailJob-trigger-08")
        .WithCronSchedule("0 0 8 * * ?", x => x.InTimeZone(TimeZoneInfo.FindSystemTimeZoneById("America/Cuiaba"))));

    q.AddTrigger(opts => opts.ForJob(jobKey).WithIdentity("EmailJob-trigger-22")
        .WithCronSchedule("0 0 22 * * ?", x => x.InTimeZone(TimeZoneInfo.FindSystemTimeZoneById("America/Cuiaba"))));
});

builder.Services.AddQuartzHostedService(opt => opt.WaitForJobsToComplete = true);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.UseCors("CorsPolicy");

// Rotas

app.MapGet("/", async (AppDbContext db) =>
{
    return await db.Contas.ToListAsync();
});

// app.Map("/", async () =>
// {
//     // Retorna uma mensagem simples para a raiz
//     return Results.Ok("API de Contas a Pagar");
// });

app.MapGet("/contas/busca", async (
    [FromQuery] string valor,
    [FromQuery] int? ano,
    [FromQuery] int? mes,
    AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(valor))
        return Results.BadRequest("Informe um valor para busca.");

    // Função para remover acentos e normalizar
    string RemoverAcentos(string texto)
    {
        if (string.IsNullOrEmpty(texto)) return texto;
        var normalized = texto.Normalize(System.Text.NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder();
        foreach (var c in normalized)
        {
            var unicodeCategory = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(char.ToLowerInvariant(c));
        }
        return sb.ToString().Normalize(System.Text.NormalizationForm.FormC);
    }

    var contas = await db.Contas
        .AsNoTracking()
        .ToListAsync();

    var valorBusca = RemoverAcentos(valor);

    var filtradas = contas
        .Where(c => RemoverAcentos(c.Nome).Contains(valorBusca))
        .AsQueryable();

    if (ano.HasValue)
        filtradas = filtradas.Where(c => c.Ano == ano.Value);

    if (mes.HasValue)
        filtradas = filtradas.Where(c => c.Mes == mes.Value);

    var resultado = filtradas
        .OrderBy(c => c.Nome)
        .ToList();

    return resultado.Any()
        ? Results.Ok(resultado)
        : Results.NotFound("Nenhuma conta encontrada com os filtros informados.");
});

app.MapGet("/contas", async (int ano, int mes, AppDbContext db) =>
{
    var contasMes = await db.Contas
        .Where(c => c.Ano == ano && c.Mes == mes)
        .OrderBy(c => c.DataVencimento)
        .ToListAsync();

    // 🔁 Carregar todas as parcelas para poder agrupar corretamente por nome
    var todasAsContas = await db.Contas
        .AsNoTracking()
        .ToListAsync();

    // Agrupar por nome
    var grupos = todasAsContas
        .GroupBy(c => c.Nome)
        .ToDictionary(
            g => g.Key,
            g => g.OrderBy(c => c.DataVencimento).ToList()
        );

    var dtos = contasMes.Select(c =>
    {
        var grupo = grupos[c.Nome];
        var indice = grupo.FindIndex(p => p.Id == c.Id);

        return new ContaDto
        {
            Id = c.Id,
            Nome = c.Nome,
            Ano = c.Ano,
            Mes = c.Mes,
            Paga = c.Paga,
            DataVencimento = c.DataVencimento,
            ValorParcela = c.ValorParcela,
            QuantidadeParcelas = c.QuantidadeParcelas,
            IndiceParcela = indice + 1,
            TotalParcelas = grupo.Count
        };
    });

    return Results.Ok(dtos);
});

app.MapPost("/contas", async (
    [FromBody]ContaDto dto, 
    IValidator<ContaDto> validator,
    AppDbContext db) =>
{
    var validationResult = await ContasMensais.API.Extensions.ValidationExtensions.Validate(dto, validator);

    if (validationResult is not null)
        return validationResult;

    var contasCriadas = new List<ContaDto>();

    for (int i = 0; i < dto.QuantidadeParcelas; i++)
    {
        var vencimento = dto.DataVencimento.AddMonths(i);
        var ano = vencimento.Year;
        var mes = vencimento.Month;

        var nova = new Conta
        {
            Nome = dto.Nome,
            Ano = ano,
            Mes = mes,
            Paga = false,
            DataVencimento = vencimento,
            ValorParcela = dto.ValorParcela,
            QuantidadeParcelas = 1 // Cada conta representa uma parcela
        };

        db.Contas.Add(nova);

        contasCriadas.Add(new ContaDto
        {
            Id = nova.Id,
            Nome = nova.Nome,
            Ano = nova.Ano,
            Mes = nova.Mes,
            Paga = false,
            DataVencimento = nova.DataVencimento,
            ValorParcela = nova.ValorParcela,
            QuantidadeParcelas = 1
        });
    }

    await db.SaveChangesAsync();

    return Results.Created($"/contas", contasCriadas);
});

app.MapPut("/contas/{id}", async (Guid id, [FromBody] ContaDto dto, AppDbContext db) =>
{
    var contaOriginal = await db.Contas.FindAsync(id);
    if (contaOriginal is null)
        return Results.NotFound();

    // 1. Buscar todas as parcelas com mesmo nome e data base
    var dataBase = contaOriginal.DataVencimento;
    var grupoParcelas = await db.Contas
        .Where(c => c.Nome == contaOriginal.Nome && c.DataVencimento >= dataBase)
        .OrderBy(c => c.DataVencimento)
        .ToListAsync();

    // 2. Apagar todas as parcelas futuras relacionadas
    db.Contas.RemoveRange(grupoParcelas);

    // 3. Criar as novas parcelas
    var novasParcelas = new List<Conta>();
    for (int i = 0; i < dto.QuantidadeParcelas; i++)
    {
        var vencimento = dto.DataVencimento.AddMonths(i);
        var nova = new Conta
        {
            Nome = dto.Nome,
            Ano = vencimento.Year,
            Mes = vencimento.Month,
            DataVencimento = vencimento,
            ValorParcela = dto.ValorParcela,
            QuantidadeParcelas = 1,
            Paga = false
        };
        novasParcelas.Add(nova);
        db.Contas.Add(nova);
    }

    await db.SaveChangesAsync();

    var dtos = novasParcelas.Select(n => new ContaDto
    {
        Id = n.Id,
        Nome = n.Nome,
        Ano = n.Ano,
        Mes = n.Mes,
        Paga = n.Paga,
        DataVencimento = n.DataVencimento,
        ValorParcela = n.ValorParcela,
        QuantidadeParcelas = n.QuantidadeParcelas
    });

    return Results.Ok(dtos);
});

// PUT pagar
app.MapPut("/contas/{id}/pagar", async (Guid id, AppDbContext db) =>
{
    var conta = await db.Contas.FindAsync(id);
    if (conta is null) return Results.NotFound();

    conta.Paga = true;
    await db.SaveChangesAsync();

    return Results.Ok();
});

// PUT desmarcar 
app.MapPut("/contas/{id}/desmarcar", async (Guid id, AppDbContext db) =>
{
    var conta = await db.Contas.FindAsync(id);
    if (conta is null) return Results.NotFound();

    conta.Paga = false;
    await db.SaveChangesAsync();

    return Results.Ok();
});

app.MapDelete("/contas/{id}", async (Guid id, AppDbContext db) =>
{
    var conta = await db.Contas.FindAsync(id);
    if (conta is null) return Results.NotFound();

    db.Contas.Remove(conta);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

app.MapGet("/contas/pdf", async (
    int? ano, int? mes, string? status, string? nome,
    AppDbContext db) =>
{
    var query = db.Contas.AsNoTracking();

    if (ano.HasValue)
        query = query.Where(c => c.Ano == ano.Value);

    if (mes.HasValue)
        query = query.Where(c => c.Mes == mes.Value);

    if (!string.IsNullOrWhiteSpace(nome))
        query = query.Where(c => c.Nome.ToLower().Contains(nome.ToLower()));

    if (status == "pagas")
        query = query.Where(c => c.Paga == true);
    else if (status == "nao-pagas")
        query = query.Where(c => c.Paga == false);

    var contas = await query.OrderBy(c => c.Nome).ThenBy(c => c.DataVencimento).ToListAsync();

    // Agrupa as contas por nome
    var grupos = contas
        .GroupBy(c => c.Nome)
        .ToDictionary(
            g => g.Key,
            g => g.OrderBy(c => c.DataVencimento).ToList()
        );

    // Monta os DTOs com índice da parcela e total
    var dtos = contas.Select(c =>
    {
        var grupo = grupos[c.Nome];
        var indice = grupo.FindIndex(p => p.Id == c.Id);

        return new ContaDto
        {
            Id = c.Id,
            Nome = c.Nome,
            Ano = c.Ano,
            Mes = c.Mes,
            Paga = c.Paga,
            DataVencimento = c.DataVencimento,
            ValorParcela = c.ValorParcela,
            QuantidadeParcelas = c.QuantidadeParcelas,
            IndiceParcela = indice + 1,
            TotalParcelas = grupo.Count
        };
    }).ToList();

    var pdf = new ContasPdfDocument(dtos);
    var bytes = pdf.GeneratePdf();

    return Results.File(bytes, "application/pdf", "Relatorio-Completo.pdf");
});


app.Run();


