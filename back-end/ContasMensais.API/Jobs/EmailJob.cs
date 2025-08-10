using System.Net;
using System.Net.Mail;
using ContasMensais.API.DbContext;
using ContasMensais.API.Models;
using Microsoft.EntityFrameworkCore;
using Quartz;

namespace ContasMensais.API.Jobs;

public class EmailJob : IJob
{
    private readonly EmailSettings _settings;
    private readonly AppDbContext _context;

    public EmailJob(IConfiguration config, AppDbContext context)
    {
        _settings = config.GetSection("EmailSettings").Get<EmailSettings>()!;
        _context = context;
    }

    public async Task Execute(IJobExecutionContext context)
    {
        var hoje = DateOnly.FromDateTime(DateTime.Today);
        var amanha = hoje.AddDays(1);

        Console.WriteLine($"[JOB] Enviando e-mail em: {DateTime.Now}");
        var senhaDebug = string.IsNullOrEmpty(_settings.Senha) || _settings.Senha.Length < 4
            ? "(senha não definida ou curta)"
            : _settings.Senha.Substring(0, 4) + "...";
        Console.WriteLine($"[DEBUG] Senha vinda de User Secrets: {senhaDebug}");

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
                using var smtp = new SmtpClient("smtp.gmail.com", 587)
                {
                    EnableSsl = true,
                    UseDefaultCredentials = false,
                    Credentials = new NetworkCredential(_settings.Remetente, _settings.Senha)
                };

                foreach (var destinatario in _settings.Destinatarios)
                {
                    var mail = new MailMessage(_settings.Remetente, destinatario, assunto, corpo)
                    {
                        IsBodyHtml = false
                    };

                    await smtp.SendMailAsync(mail);
                    Console.WriteLine($"[OK] E-mail enviado para conta \"{conta.Nome}\" ({quando}).");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERRO] Falha ao enviar e-mail da conta \"{conta.Nome}\": {ex.Message}");
            }
        }
    }
}