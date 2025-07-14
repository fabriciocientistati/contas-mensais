using ContasMensais.API.DbContext;
using ContasMensais.API.Dtos;
using ContasMensais.API.Models;
using ContasMensais.API.Validators;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Listen(System.Net.IPAddress.Any, 5000);
});

// Configurações
builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables();

// Gerando log de ambiente e conexão
Console.WriteLine($"Ambiente: {builder.Environment.EnvironmentName}");
Console.WriteLine($"Conexão: {builder.Configuration.GetConnectionString("DefaultConnection") ?? "NÃO ENCONTRADA"}");

// Banco de dados
if (builder.Environment.IsDevelopment())
{
    Console.WriteLine("📦 Usando SQLite no ambiente Development");
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=app.db"));
}
else
{
    Console.WriteLine("🐘 Usando PostgreSQL em Produção");
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

}

// Ativar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy
        .AllowAnyOrigin()
        .AllowAnyMethod()
        .AllowAnyHeader();
    });
});

// Adicionar serviço para documentação futuramente
builder.Services.AddEndpointsApiExplorer();

// FluentValidation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<ContaValidators>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated(); // Garante a criação do banco
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

    var query = db.Contas
        .AsNoTracking()
        .Where(c => c.Nome.ToLower().Contains(valor.ToLower()));

    if (ano.HasValue)
        query = query.Where(c => c.Ano == ano.Value);

    if (mes.HasValue)
        query = query.Where(c => c.Mes == mes.Value);

    var contas = await query
        .OrderBy(c => c.Nome)
        .ToListAsync();

    return contas.Any()
        ? Results.Ok(contas)
        : Results.NotFound("Nenhuma conta encontrada com os filtros informados.");
});

// GET all (com DTO)
app.MapGet("/contas", async (int ano, int mes, AppDbContext db) =>
{
    var contas = await db.Contas
        .Where(c => c.Ano == ano && c.Mes == mes)
        .OrderBy(c => c.Nome)
        .ToListAsync();

    var dtos = contas.Select(c => new ContaDto
    {
        Id = c.Id,
        Nome = c.Nome,
        Ano = c.Ano,
        Mes = c.Mes,
        Paga = c.Paga,
        DataVencimento = c.DataVencimento,
        ValorParcela = c.ValorParcela,
        QuantidadeParcelas = c.QuantidadeParcelas
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
    
    var nova = new Conta
    {
        Nome = dto.Nome,
        Ano = dto.Ano,
        Mes = dto.Mes,
        Paga = false,
        DataVencimento = dto.DataVencimento,
        ValorParcela = dto.ValorParcela,
        QuantidadeParcelas = dto.QuantidadeParcelas
    };

    db.Contas.Add(nova);
    await db.SaveChangesAsync();

    dto.Id = nova.Id;
    dto.Paga = false;

    return Results.Created($"/contas/{dto.Id}", dto);
});

app.MapPut("/contas/{id}", async (Guid id, [FromBody] ContaDto dto, AppDbContext db) =>
{
    var contaExistente = await db.Contas.FindAsync(id);
    if (contaExistente is null) return Results.NotFound();

    contaExistente.Nome = dto.Nome;
    contaExistente.Ano = dto.Ano;
    contaExistente.Mes = dto.Mes;
    contaExistente.DataVencimento = dto.DataVencimento;
    contaExistente.ValorParcela = dto.ValorParcela;
    contaExistente.QuantidadeParcelas = dto.QuantidadeParcelas;
    contaExistente.Paga = dto.Paga;

    await db.SaveChangesAsync();

    return Results.Ok(new ContaDto
    {
        Id = contaExistente.Id,
        Nome = contaExistente.Nome,
        Ano = contaExistente.Ano,
        Mes = contaExistente.Mes,
        Paga = contaExistente.Paga,
        DataVencimento = contaExistente.DataVencimento,
        ValorParcela = contaExistente.ValorParcela,
        QuantidadeParcelas = contaExistente.QuantidadeParcelas
    });
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

app.Run();


