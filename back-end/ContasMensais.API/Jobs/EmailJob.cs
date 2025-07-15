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
        Console.WriteLine($"[DEBUG] Senha vinda de User Secrets: {_settings.Senha.Substring(0, 4)}...");

        var contas = await _context.Contas
            .Where(c => (c.DataVencimento == hoje || c.DataVencimento == amanha) && c.Paga != true)
            .ToListAsync();

        if (!contas.Any())
        {
            Console.WriteLine("[INFO] Nenhuma conta para notificar hoje.");
            return;
        }

        foreach (var conta in contas)
        {
            string quando = conta.DataVencimento == hoje ? "hoje" : "amanhã";

            var assunto = $"🔔 aviso: conta \"{conta.Nome}\" vence {quando}";
            var corpo = $"""
                         Olá, esta é uma notificação automática. 

                         A conta **{conta.Nome}** no valor de **R${conta.ValorParcela:F2}**
                         vence {quando} em **{conta.DataVencimento:dd/MM/yyyy}**.

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
                    Console.WriteLine($"[OK] E-mail enviado para conta \"{conta.Nome}\" com vencimento {quando}.");

                }
                
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERRO] Falha ao enviar e-mail da conta \"{conta.Nome}\": {ex.Message}");
            }
        }
    }
}