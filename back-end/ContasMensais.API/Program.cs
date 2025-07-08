using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables();

Console.WriteLine($"Ambiente: {builder.Environment.EnvironmentName}");
Console.WriteLine($"Conexão: {builder.Configuration.GetConnectionString("DefaultConnection") ?? "NÃO ENCONTRADA"}");

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Listen(System.Net.IPAddress.Any, 5000);
});

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


app.MapGet("/contas", async (int ano, int mes, AppDbContext db) =>
{
    var contas = await db.Contas
        .Where(c => c.Ano == ano && c.Mes == mes)
        .OrderBy(c => c.Nome)
        .ToListAsync();

    return Results.Ok(contas);
});

app.MapPost("/contas", async (Conta nova, AppDbContext db) =>
{
    nova.Paga = false;
    db.Contas.Add(nova);
    await db.SaveChangesAsync();
    return Results.Created($"/contas/{nova.Id}", nova);
});

app.MapPut("/contas/{id}/pagar", async (Guid id, AppDbContext db) =>
{
    var conta = await db.Contas.FindAsync(id);
    if (conta is null) return Results.NotFound();
    conta.Paga = true;
    await db.SaveChangesAsync();
    return Results.Ok();
});

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


public class Conta
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = string.Empty;
    public int Ano { get; set; }
    public int Mes { get; set; }
    public bool Paga { get; set; } = false;
    public DateOnly DataVencimento { get; set; }
    public decimal ValorParcela { get; set; }
    public int QuantidadeParcelas { get; set; }
    public decimal ValorTotal => Math.Round(ValorParcela * QuantidadeParcelas, 2);
}
