using ContasMensais.API.DbContext;
using ContasMensais.API.Dtos;
using ContasMensais.API.Jobs;
using ContasMensais.API.Models;
using ContasMensais.API.Services;
using ContasMensais.API.Validators;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using Quartz;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Text;

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

var emailSettings = builder.Configuration.GetSection("EmailSettings").Get<EmailSettings>() ?? new EmailSettings();
Console.WriteLine(
    "[EMAIL-CONFIG] Remetente configurado: {0}; Destinatarios configurados: {1}; Gmail OAuth configurado: {2}",
    !string.IsNullOrWhiteSpace(emailSettings.Remetente),
    emailSettings.Destinatarios.Count,
    !string.IsNullOrWhiteSpace(builder.Configuration["GmailSettings:ClientId"]) &&
    !string.IsNullOrWhiteSpace(builder.Configuration["GmailSettings:ClientSecret"]) &&
    !string.IsNullOrWhiteSpace(builder.Configuration["GmailSettings:RefreshToken"]));

var authSettings = builder.Configuration.GetSection("AuthSettings").Get<AuthSettings>() ?? new AuthSettings();
if (string.IsNullOrWhiteSpace(authSettings.JwtSecret) || authSettings.JwtSecret.Length < 32)
{
    if (!builder.Environment.IsDevelopment())
    {
        throw new InvalidOperationException("Configure AuthSettings__JwtSecret com pelo menos 32 caracteres.");
    }

    authSettings.JwtSecret = "dev-local-contas-mensais-jwt-secret-32";
    Console.WriteLine("[AUTH][AVISO] Usando JwtSecret local apenas para desenvolvimento.");
}

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
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
               .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));
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
builder.Services.AddScoped<PasswordHasher>();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<AdminUserSeeder>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authSettings.JwtSecret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});
builder.Services.AddHttpClient<GmailEmailSender>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddQuartz(q =>
{
    var jobKey = new JobKey("EmailJob");

    q.AddJob<EmailJob>(opts => opts.WithIdentity(jobKey));

    q.AddTrigger(opts => opts.ForJob(jobKey).WithIdentity("EmailJob-trigger-08")
        .WithCronSchedule("0 0 8 * * ?", x => x.InTimeZone(TimeZoneInfo.FindSystemTimeZoneById("America/Cuiaba"))));

    q.AddTrigger(opts => opts.ForJob(jobKey).WithIdentity("EmailJob-trigger-22")
        .WithCronSchedule("0 0 22 * * ?", x => x.InTimeZone(TimeZoneInfo.FindSystemTimeZoneById("America/Cuiaba"))));

    // 🔹 Dispara a cada segundo para teste
    // q.AddTrigger(opts => opts
    //     .ForJob(jobKey)
    //     .WithIdentity("EmailJob-trigger-test")
    //     .WithSimpleSchedule(x => x
    //         .WithIntervalInSeconds(1)
    //         .RepeatForever()
    //     )
    // );

});

builder.Services.AddQuartzHostedService(opt => opt.WaitForJobsToComplete = true);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    var adminSeeder = scope.ServiceProvider.GetRequiredService<AdminUserSeeder>();
    await adminSeeder.SeedAsync();
}

app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseAuthorization();

// Rotas

app.MapPost("/auth/login", async (
    [FromBody] LoginRequest request,
    AppDbContext db,
    PasswordHasher passwordHasher,
    JwtTokenService jwtTokenService) =>
{
    var email = request.Email.Trim().ToLowerInvariant();

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password))
        return Results.BadRequest("Informe e-mail e senha.");

    var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Email == email);

    if (usuario is null || !passwordHasher.Verify(request.Password, usuario.PasswordHash))
        return Results.Unauthorized();

    var tokenData = jwtTokenService.CreateToken(usuario);

    return Results.Ok(new LoginResponse
    {
        Token = tokenData.Token,
        Email = usuario.Email,
        ExpiresAt = tokenData.ExpiresAt
    });
}).AllowAnonymous();

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
        .ThenBy(c => c.DataVencimento)
        .ToList();

    var grupos = contas
        .GroupBy(c => c.Nome)
        .ToDictionary(
            g => g.Key,
            g => g.OrderBy(c => c.DataVencimento).ToList()
        );

    var dtos = resultado.Select(c =>
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

    return dtos.Any()
        ? Results.Ok(dtos)
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
            Paga = i == 0 && contaOriginal.Paga
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
app.MapPut("/contas/{id}/pagar", async (Guid id, AppDbContext db, GmailEmailSender emailSender) =>
{
    var conta = await db.Contas.FindAsync(id);
    if (conta is null) return Results.NotFound();

    conta.Paga = true;
    await db.SaveChangesAsync();

    try
    {
        await emailSender.SendAsync(
            $"Conta paga - \"{conta.Nome}\"",
            MontarTextoEmailAcaoConta("PAGA", conta),
            html: MontarHtmlEmailAcaoConta("PAGA", conta));

        Console.WriteLine($"[EMAIL-ACAO] Notificacao de conta paga enviada. Conta: {conta.Id} - {conta.Nome}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[EMAIL-ACAO][ERRO] Conta marcada como paga, mas falha ao enviar notificacao. Conta: {conta.Id} - {conta.Nome}. Erro: {ex}");
    }

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

app.MapDelete("/contas/{id}", async (Guid id, AppDbContext db, GmailEmailSender emailSender) =>
{
    var conta = await db.Contas.FindAsync(id);
    if (conta is null) return Results.NotFound();

    db.Contas.Remove(conta);
    await db.SaveChangesAsync();

    try
    {
        await emailSender.SendAsync(
            $"Conta deletada - \"{conta.Nome}\"",
            MontarTextoEmailAcaoConta("DELETADA", conta),
            html: MontarHtmlEmailAcaoConta("DELETADA", conta));

        Console.WriteLine($"[EMAIL-ACAO] Notificacao de conta deletada enviada. Conta: {conta.Id} - {conta.Nome}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[EMAIL-ACAO][ERRO] Conta deletada, mas falha ao enviar notificacao. Conta: {conta.Id} - {conta.Nome}. Erro: {ex}");
    }

    return Results.NoContent();
});

// Receitas
app.MapGet("/receitas", async (int ano, int mes, AppDbContext db) =>
{
    var receita = await db.Receitas
        .AsNoTracking()
        .FirstOrDefaultAsync(r => r.Ano == ano && r.Mes == mes);

    if (receita is null)
    {
        var (anoAnterior, mesAnterior) = ObterMesAnterior(ano, mes);

        var receitaAnterior = await db.Receitas
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Ano == anoAnterior && r.Mes == mesAnterior);

        if (receitaAnterior is not null)
        {
            var totalPagoAnterior = await db.Contas
                .AsNoTracking()
                .Where(c => c.Ano == anoAnterior && c.Mes == mesAnterior && c.Paga == true)
                .Select(c => c.ValorParcela * c.QuantidadeParcelas)
                .DefaultIfEmpty(0)
                .SumAsync();

            var saldoAnterior = receitaAnterior.ValorTotal - totalPagoAnterior;

            if (saldoAnterior > 0)
            {
                receita = new ReceitaMensal
                {
                    Ano = ano,
                    Mes = mes,
                    ValorTotal = Math.Round(saldoAnterior, 2),
                    AtualizadoEm = DateTime.UtcNow
                };

                db.Receitas.Add(receita);
                await db.SaveChangesAsync();
            }
        }
    }

    if (receita is null)
        return Results.NotFound();

    var dto = new ReceitaMensalDto
    {
        Id = receita.Id,
        Ano = receita.Ano,
        Mes = receita.Mes,
        ValorTotal = receita.ValorTotal,
        AtualizadoEm = receita.AtualizadoEm
    };

    return Results.Ok(dto);
});

app.MapPut("/receitas", async (
    [FromBody] ReceitaMensalDto dto,
    IValidator<ReceitaMensalDto> validator,
    AppDbContext db) =>
{
    var validationResult = await ContasMensais.API.Extensions.ValidationExtensions.Validate(dto, validator);

    if (validationResult is not null)
        return validationResult;

    var receita = await db.Receitas
        .FirstOrDefaultAsync(r => r.Ano == dto.Ano && r.Mes == dto.Mes);

    if (receita is null)
    {
        receita = new ReceitaMensal
        {
            Ano = dto.Ano,
            Mes = dto.Mes,
            ValorTotal = dto.ValorTotal,
            AtualizadoEm = DateTime.UtcNow
        };
        db.Receitas.Add(receita);
    }
    else
    {
        receita.ValorTotal = dto.ValorTotal;
        receita.AtualizadoEm = DateTime.UtcNow;
    }

    await db.SaveChangesAsync();

    var resultado = new ReceitaMensalDto
    {
        Id = receita.Id,
        Ano = receita.Ano,
        Mes = receita.Mes,
        ValorTotal = receita.ValorTotal,
        AtualizadoEm = receita.AtualizadoEm
    };

    return Results.Ok(resultado);
});

static (int ano, int mes) ObterMesAnterior(int ano, int mes)
{
    if (mes <= 1)
        return (ano - 1, 12);

    return (ano, mes - 1);
}

static string MontarTextoEmailAcaoConta(string acao, Conta conta)
{
    var dataNotificacao = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-4));
    var statusTexto = conta.Paga ? "Paga" : "Não paga";

    return $"""
            Ação realizada: {acao}

            Informações da conta:
            - Id: {conta.Id}
            - Nome: {conta.Nome}
            - Ano: {conta.Ano}
            - Mês: {conta.Mes}
            - Data de vencimento: {conta.DataVencimento:dd/MM/yyyy}
            - Valor da parcela: {FormatarMoeda(conta.ValorParcela)}
            - Quantidade de parcelas: {conta.QuantidadeParcelas}
            - Status: {statusTexto}

            Notificação gerada em {FormatarDataHoraCuiaba(dataNotificacao)}

            -- Contas-Mensais
            """;
}

static string MontarHtmlEmailAcaoConta(string acao, Conta conta)
{
    var acaoNormalizada = acao.Equals("PAGA", StringComparison.OrdinalIgnoreCase) ? "Conta paga" : "Conta deletada";
    var statusCor = acao.Equals("PAGA", StringComparison.OrdinalIgnoreCase) ? "#0f766e" : "#b42318";
    var statusTexto = conta.Paga ? "Paga" : "Não paga";
    var dataNotificacao = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-4));
    var nomeConta = System.Net.WebUtility.HtmlEncode(conta.Nome);
    var idCurto = conta.Id.ToString()[..8];

    return $$"""
             <!doctype html>
             <html lang="pt-BR">
             <body style="margin:0;background:#eef1f5;font-family:Segoe UI,Arial,sans-serif;color:#182033;">
               <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef1f5;padding:24px 10px;">
                 <tr>
                   <td align="center">
                     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dde3ea;border-radius:16px;overflow:hidden;">
                       <tr>
                         <td style="padding:28px;background:#273142;color:#ffffff;">
                           <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#b8c2d3;">Contas Mensais</div>
                           <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">{{acaoNormalizada}}</h1>
                         </td>
                       </tr>
                       <tr>
                         <td style="padding:26px 28px 30px;">
                           <div style="display:inline-block;padding:8px 13px;border-radius:999px;background:{{statusCor}};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.04em;">
                             {{acao}}
                           </div>
                           <h2 style="margin:18px 0 8px;font-size:24px;line-height:1.3;color:#111827;">{{nomeConta}}</h2>
                           <p style="margin:0 0 22px;color:#536173;font-size:15px;line-height:1.55;">Uma movimentação foi registrada para esta conta.</p>
                           <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
                             {{LinhaHtml("Ano", conta.Ano.ToString())}}
                             {{LinhaHtml("Mês", conta.Mes.ToString())}}
                             {{LinhaHtml("Data de vencimento", conta.DataVencimento.ToString("dd/MM/yyyy"))}}
                             {{LinhaHtml("Valor da parcela", FormatarMoeda(conta.ValorParcela))}}
                             {{LinhaHtml("Quantidade de parcelas", conta.QuantidadeParcelas.ToString())}}
                             {{LinhaHtml("Status", statusTexto)}}
                           </table>
                           <p style="margin:22px 0 0;color:#697586;font-size:13px;line-height:1.5;">
                             Notificação gerada em {{FormatarDataHoraCuiaba(dataNotificacao)}}.
                             <br>Referência da conta: {{idCurto}}
                           </p>
                         </td>
                       </tr>
                     </table>
                   </td>
                 </tr>
               </table>
             </body>
             </html>
             """;
}

static string LinhaHtml(string label, string value)
{
    return $"""
            <tr>
              <td style="padding:12px 0;border-top:1px solid #e6eaf0;color:#697586;width:44%;vertical-align:top;">{System.Net.WebUtility.HtmlEncode(label)}</td>
              <td style="padding:12px 0;border-top:1px solid #e6eaf0;color:#111827;font-weight:700;vertical-align:top;text-align:right;">{System.Net.WebUtility.HtmlEncode(value)}</td>
            </tr>
            """;
}

static string FormatarMoeda(decimal valor)
{
    return valor.ToString("C", System.Globalization.CultureInfo.GetCultureInfo("pt-BR"));
}

static string FormatarDataHoraCuiaba(DateTimeOffset dataHora)
{
    return dataHora.ToString("dd/MM/yyyy HH:mm");
}

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

app.MapPost("/email/test", async (GmailEmailSender emailSender, HttpRequest request) =>
{
    var settings = emailSender.GetEmailSettings();
    var gmailSettings = emailSender.GetGmailSettings();

    Console.WriteLine(
        "[EMAIL-TEST] Remetente configurado: {0}; Destinatarios configurados: {1}; Gmail OAuth configurado: {2}; Token configurado: {3}",
        !string.IsNullOrWhiteSpace(settings.Remetente),
        settings.Destinatarios.Count,
        !string.IsNullOrWhiteSpace(gmailSettings.ClientId) &&
        !string.IsNullOrWhiteSpace(gmailSettings.ClientSecret) &&
        !string.IsNullOrWhiteSpace(gmailSettings.RefreshToken),
        !string.IsNullOrWhiteSpace(settings.TestToken));

    if (string.IsNullOrWhiteSpace(settings.TestToken))
        return Results.Problem("Token de teste de e-mail nao configurado.", statusCode: StatusCodes.Status500InternalServerError);

    if (!request.Headers.TryGetValue("X-Email-Test-Token", out var token) || token != settings.TestToken)
        return Results.Unauthorized();

    try
    {
        Console.WriteLine("[EMAIL-TEST] Tentando enviar e-mail de teste via Gmail API para {0} destinatario(s).", settings.Destinatarios.Count);

        await emailSender.SendAsync(
            "Teste de e-mail - Contas Mensais",
            $"Teste de envio via Gmail API disparado manualmente em {DateTimeOffset.Now:dd/MM/yyyy HH:mm:ss zzz}.",
            request.HttpContext.RequestAborted,
            MontarHtmlEmailTeste());

        Console.WriteLine("[EMAIL-TEST] E-mail de teste enviado para {0} destinatario(s).", settings.Destinatarios.Count);
        return Results.Ok(new { mensagem = "E-mail de teste enviado.", destinatarios = settings.Destinatarios.Count });
    }
    catch (OperationCanceledException ex)
    {
        Console.WriteLine($"[EMAIL-TEST][ERRO] Timeout ao enviar e-mail de teste: {ex}");
        return Results.Problem("Timeout ao enviar e-mail de teste pela Gmail API.", statusCode: StatusCodes.Status504GatewayTimeout);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[EMAIL-TEST][ERRO] Falha no envio manual: {ex}");
        return Results.Problem("Falha ao enviar e-mail de teste. Verifique os logs da aplicacao.", statusCode: StatusCodes.Status500InternalServerError);
    }
}).AllowAnonymous();

static string MontarHtmlEmailTeste()
{
    var dataNotificacao = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-4));

    return $$"""
             <!doctype html>
             <html lang="pt-BR">
             <body style="margin:0;background:#eef1f5;font-family:Segoe UI,Arial,sans-serif;color:#182033;">
               <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef1f5;padding:24px 10px;">
                 <tr>
                   <td align="center">
                     <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dde3ea;border-radius:16px;overflow:hidden;">
                       <tr>
                         <td style="padding:28px;background:#273142;color:#ffffff;">
                           <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#b8c2d3;">Contas Mensais</div>
                           <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">Teste de envio realizado</h1>
                         </td>
                       </tr>
                       <tr>
                         <td style="padding:26px 28px;">
                           <div style="display:inline-block;padding:8px 13px;border-radius:999px;background:#0f766e;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.04em;">ONLINE</div>
                           <p style="margin:18px 0 0;color:#536173;font-size:15px;line-height:1.6;">
                             A integração com a Gmail API está funcionando corretamente.
                           </p>
                           <p style="margin:22px 0 0;color:#697586;font-size:13px;">
                             Notificação gerada em {{FormatarDataHoraCuiaba(dataNotificacao)}}.
                           </p>
                         </td>
                       </tr>
                     </table>
                   </td>
                 </tr>
               </table>
             </body>
             </html>
             """;
}

app.Run();


