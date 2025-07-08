using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;

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
        options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));
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

app.MapPost("/contas", async (ContaDto dto, AppDbContext db) =>
{
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


