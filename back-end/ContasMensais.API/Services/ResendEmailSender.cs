using System.Net.Http.Headers;
using System.Net.Http.Json;
using ContasMensais.API.Models;

namespace ContasMensais.API.Services;

public class ResendEmailSender
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public ResendEmailSender(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task SendAsync(string subject, string text, CancellationToken cancellationToken = default)
    {
        var settings = GetSettings();

        if (string.IsNullOrWhiteSpace(settings.Remetente) ||
            string.IsNullOrWhiteSpace(settings.ResendApiKey) ||
            settings.Destinatarios.Count == 0)
        {
            throw new InvalidOperationException("Configuracao de e-mail incompleta. Verifique EmailSettings__Remetente, EmailSettings__ResendApiKey e EmailSettings__Destinatarios__0.");
        }

        var payload = new
        {
            from = settings.Remetente,
            to = settings.Destinatarios,
            subject,
            text
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "emails")
        {
            Content = JsonContent.Create(payload)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ResendApiKey);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"Resend retornou {(int)response.StatusCode} ({response.ReasonPhrase}). Corpo: {responseBody}");
        }
    }

    public EmailSettings GetSettings()
    {
        return _configuration.GetSection("EmailSettings").Get<EmailSettings>() ?? new EmailSettings();
    }
}
