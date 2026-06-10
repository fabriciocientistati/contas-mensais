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
    private readonly ResendEmailSender _emailSender;

    public EmailJob(IConfiguration config, AppDbContext context, ResendEmailSender emailSender)
    {
        _settings = config.GetSection("EmailSettings").Get<EmailSettings>()!;
        _context = context;
        _emailSender = emailSender;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var amanha = hoje.AddDays(1);

        Console.WriteLine($"[JOB] Enviando e-mail em: {DateTime.Now}");
        Console.WriteLine(
            "[EMAIL-CONFIG] Remetente configurado: {0}; ResendApiKey configurada: {1}; Destinatarios configurados: {2}",
            !string.IsNullOrWhiteSpace(_settings.Remetente),
            !string.IsNullOrWhiteSpace(_settings.ResendApiKey),
            _settings.Destinatarios.Count);

        if (string.IsNullOrWhiteSpace(_settings.Remetente) ||
            string.IsNullOrWhiteSpace(_settings.ResendApiKey) ||
            _settings.Destinatarios.Count == 0)
        {
            Console.WriteLine("[ERRO] Configuracao de e-mail incompleta. Verifique EmailSettings__Remetente, EmailSettings__ResendApiKey e EmailSettings__Destinatarios__0.");
            return;
        }

        var contas = await _context.Contas
            .Where(c => 
                ((c.DataVencimento < hoje) || (c.DataVencimento == hoje) || (c.DataVencimento == amanha))
                && c.Paga != true)
            .ToListAsync();

        if (!contas.Any())
        {
            Console.WriteLine("[INFO] Nenhuma conta para notificar hoje.");
            return;
        }

        foreach (var conta in contas)
        {
            string quando;
            string status;

            if (conta.DataVencimento < hoje)
            {
                quando = $"vencida em {conta.DataVencimento:dd/MM/yyyy}";
                status = "⚠️ AVISO: Conta VENCIDA";
            }
            else if (conta.DataVencimento == hoje)
            {
                quando = "vence hoje";
                status = "🔔 aviso: conta vence hoje";
            }
            else
            {
                quando = $"vence em {conta.DataVencimento:dd/MM/yyyy}";
                status = "🔔 aviso: conta vence em breve";
            }

            var assunto = $"{status} - \"{conta.Nome}\"";
            var corpo = $"""
                         Olá, esta é uma notificação automática. 

                         A conta **{conta.Nome}** no valor de **R${conta.ValorParcela:F2}**
                         {quando}.

                         Por favor, organize seu pagamento!

                         -- Contas-Mensais
            """;
            try
            {
                Console.WriteLine($"[JOB] Tentando enviar e-mail via Resend para {_settings.Destinatarios.Count} destinatario(s).");
                await _emailSender.SendAsync(assunto, corpo, context.CancellationToken);
                Console.WriteLine($"[OK] E-mail enviado para conta \"{conta.Nome}\" ({quando}).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERRO] Falha ao enviar e-mail da conta \"{conta.Nome}\": {ex}");
            }
        }
    }
}
