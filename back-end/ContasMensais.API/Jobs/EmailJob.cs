using ContasMensais.API.DbContext;
using ContasMensais.API.Models;
using ContasMensais.API.Services;
using Microsoft.EntityFrameworkCore;
using Quartz;

namespace ContasMensais.API.Jobs;

public class EmailJob : IJob
{
    private readonly EmailSettings _settings;
    private readonly AppDbContext _context;
    private readonly GmailEmailSender _emailSender;

    public EmailJob(IConfiguration config, AppDbContext context, GmailEmailSender emailSender)
    {
        _settings = config.GetSection("EmailSettings").Get<EmailSettings>()!;
        _context = context;
        _emailSender = emailSender;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var amanha = hoje.AddDays(1);
        var gmailSettings = _emailSender.GetGmailSettings();

        Console.WriteLine($"[JOB] Enviando e-mail em: {DateTime.Now}");
        Console.WriteLine(
            "[EMAIL-CONFIG] Remetente configurado: {0}; Destinatarios configurados: {1}; Gmail OAuth configurado: {2}",
            !string.IsNullOrWhiteSpace(_settings.Remetente),
            _settings.Destinatarios.Count,
            !string.IsNullOrWhiteSpace(gmailSettings.ClientId) &&
            !string.IsNullOrWhiteSpace(gmailSettings.ClientSecret) &&
            !string.IsNullOrWhiteSpace(gmailSettings.RefreshToken));

        if (string.IsNullOrWhiteSpace(_settings.Remetente) ||
            _settings.Destinatarios.Count == 0)
        {
            Console.WriteLine("[ERRO] Configuracao de e-mail incompleta. Verifique EmailSettings__Remetente, EmailSettings__Destinatarios__0 e GmailSettings.");
            return;
        }

        var contas = await _context.Contas
            .Where(c =>
                ((c.DataVencimento < hoje) || (c.DataVencimento == hoje) || (c.DataVencimento == amanha))
                && c.Paga != true)
            .ToListAsync(context.CancellationToken);

        if (!contas.Any())
        {
            Console.WriteLine("[INFO] Nenhuma conta para notificar hoje.");
            return;
        }

        foreach (var conta in contas)
        {
            var aviso = ObterAviso(conta, hoje);
            var assunto = $"{aviso.Titulo} - \"{conta.Nome}\"";
            var corpo = MontarTextoEmailAvisoConta(aviso, conta);
            var html = MontarHtmlEmailAvisoConta(aviso, conta);

            try
            {
                Console.WriteLine($"[JOB] Tentando enviar e-mail via Gmail API para {_settings.Destinatarios.Count} destinatario(s).");
                await _emailSender.SendAsync(assunto, corpo, context.CancellationToken, html);
                Console.WriteLine($"[OK] E-mail enviado para conta \"{conta.Nome}\" ({aviso.Quando}).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERRO] Falha ao enviar e-mail da conta \"{conta.Nome}\": {ex}");
            }
        }
    }

    private static AvisoConta ObterAviso(Conta conta, DateOnly hoje)
    {
        if (conta.DataVencimento < hoje)
        {
            return new AvisoConta(
                Titulo: "Conta vencida",
                Status: "CONTA VENCIDA",
                Quando: $"vencida em {conta.DataVencimento:dd/MM/yyyy}",
                Cor: "#b42318");
        }

        if (conta.DataVencimento == hoje)
        {
            return new AvisoConta(
                Titulo: "Conta vence hoje",
                Status: "VENCE HOJE",
                Quando: "vence hoje",
                Cor: "#b54708");
        }

        return new AvisoConta(
            Titulo: "Conta vence em breve",
            Status: "VENCE EM BREVE",
            Quando: $"vence em {conta.DataVencimento:dd/MM/yyyy}",
            Cor: "#0f766e");
    }

    private static string MontarTextoEmailAvisoConta(AvisoConta aviso, Conta conta)
    {
        var dataNotificacao = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(-4));

        return $"""
                {aviso.Titulo}

                Informacoes da conta:
                - Nome: {conta.Nome}
                - Ano: {conta.Ano}
                - Mes: {conta.Mes}
                - Data de vencimento: {conta.DataVencimento:dd/MM/yyyy}
                - Valor da parcela: {FormatarMoeda(conta.ValorParcela)}
                - Quantidade de parcelas: {conta.QuantidadeParcelas}
                - Status: {aviso.Status}

                Esta conta {aviso.Quando}. Organize o pagamento para manter seu controle em dia.

                Notificacao gerada em {FormatarDataHoraCuiaba(dataNotificacao)}

                -- Contas-Mensais
                """;
    }

    private static string MontarHtmlEmailAvisoConta(AvisoConta aviso, Conta conta)
    {
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
                               <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">{{System.Net.WebUtility.HtmlEncode(aviso.Titulo)}}</h1>
                             </td>
                           </tr>
                           <tr>
                             <td style="padding:26px 28px 30px;">
                               <div style="display:inline-block;padding:8px 13px;border-radius:999px;background:{{aviso.Cor}};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.04em;">
                                 {{System.Net.WebUtility.HtmlEncode(aviso.Status)}}
                               </div>
                               <h2 style="margin:18px 0 8px;font-size:24px;line-height:1.3;color:#111827;">{{nomeConta}}</h2>
                               <p style="margin:0 0 22px;color:#536173;font-size:15px;line-height:1.55;">Esta conta {{System.Net.WebUtility.HtmlEncode(aviso.Quando)}}. Organize o pagamento para manter seu controle em dia.</p>
                               <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;">
                                 {{LinhaHtml("Ano", conta.Ano.ToString())}}
                                 {{LinhaHtml("Mes", conta.Mes.ToString())}}
                                 {{LinhaHtml("Data de vencimento", conta.DataVencimento.ToString("dd/MM/yyyy"))}}
                                 {{LinhaHtml("Valor da parcela", FormatarMoeda(conta.ValorParcela))}}
                                 {{LinhaHtml("Quantidade de parcelas", conta.QuantidadeParcelas.ToString())}}
                                 {{LinhaHtml("Status", aviso.Status)}}
                               </table>
                               <p style="margin:22px 0 0;color:#697586;font-size:13px;line-height:1.5;">
                                 Notificacao gerada em {{FormatarDataHoraCuiaba(dataNotificacao)}}.
                                 <br>Referencia da conta: {{idCurto}}
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

    private static string LinhaHtml(string label, string value)
    {
        return $"""
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #e6eaf0;color:#697586;width:44%;vertical-align:top;">{System.Net.WebUtility.HtmlEncode(label)}</td>
                  <td style="padding:12px 0;border-top:1px solid #e6eaf0;color:#111827;font-weight:700;vertical-align:top;text-align:right;">{System.Net.WebUtility.HtmlEncode(value)}</td>
                </tr>
                """;
    }

    private static string FormatarMoeda(decimal valor)
    {
        return valor.ToString("C", System.Globalization.CultureInfo.GetCultureInfo("pt-BR"));
    }

    private static string FormatarDataHoraCuiaba(DateTimeOffset dataHora)
    {
        return dataHora.ToString("dd/MM/yyyy HH:mm");
    }

    private record AvisoConta(string Titulo, string Status, string Quando, string Cor);
}
