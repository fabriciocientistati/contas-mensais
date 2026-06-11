using System.Text;
using System.Text.Json;
using ContasMensais.API.Models;

namespace ContasMensais.API.Services;

public class GmailEmailSender
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public GmailEmailSender(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task SendAsync(string subject, string text, CancellationToken cancellationToken = default, string? html = null)
    {
        var emailSettings = GetEmailSettings();
        var gmailSettings = GetGmailSettings();

        if (string.IsNullOrWhiteSpace(emailSettings.Remetente) ||
            emailSettings.Destinatarios.Count == 0 ||
            string.IsNullOrWhiteSpace(gmailSettings.ClientId) ||
            string.IsNullOrWhiteSpace(gmailSettings.ClientSecret) ||
            string.IsNullOrWhiteSpace(gmailSettings.RefreshToken))
        {
            throw new InvalidOperationException("Configuracao de Gmail incompleta. Verifique EmailSettings__Remetente, EmailSettings__Destinatarios__0, GmailSettings__ClientId, GmailSettings__ClientSecret e GmailSettings__RefreshToken.");
        }

        var accessToken = await GetAccessTokenAsync(gmailSettings, cancellationToken);
        var rawMessage = BuildRawMessage(emailSettings.Remetente, emailSettings.Destinatarios, subject, text, html);

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
        {
            Content = JsonContent.Create(new { raw = rawMessage })
        };

        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"Gmail API retornou {(int)response.StatusCode} ({response.ReasonPhrase}). Corpo: {responseBody}");
        }
    }

    public EmailSettings GetEmailSettings()
    {
        return _configuration.GetSection("EmailSettings").Get<EmailSettings>() ?? new EmailSettings();
    }

    public GmailSettings GetGmailSettings()
    {
        return _configuration.GetSection("GmailSettings").Get<GmailSettings>() ?? new GmailSettings();
    }

    private async Task<string> GetAccessTokenAsync(GmailSettings settings, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://oauth2.googleapis.com/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = settings.ClientId,
                ["client_secret"] = settings.ClientSecret,
                ["refresh_token"] = settings.RefreshToken,
                ["grant_type"] = "refresh_token"
            })
        };

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"Google OAuth retornou {(int)response.StatusCode} ({response.ReasonPhrase}). Corpo: {responseBody}");
        }

        using var json = JsonDocument.Parse(responseBody);
        return json.RootElement.GetProperty("access_token").GetString()
               ?? throw new InvalidOperationException("Google OAuth nao retornou access_token.");
    }

    private static string BuildRawMessage(string from, IEnumerable<string> to, string subject, string text, string? html)
    {
        if (!string.IsNullOrWhiteSpace(html))
        {
            return BuildMultipartRawMessage(from, to, subject, text, html);
        }

        var message = string.Join("\r\n", new[]
        {
            $"From: {from}",
            $"To: {string.Join(", ", to)}",
            $"Subject: {EncodeHeader(subject)}",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=utf-8",
            "Content-Transfer-Encoding: base64",
            "",
            Convert.ToBase64String(Encoding.UTF8.GetBytes(text))
        });

        return Base64UrlEncode(Encoding.UTF8.GetBytes(message));
    }

    private static string BuildMultipartRawMessage(string from, IEnumerable<string> to, string subject, string text, string html)
    {
        var boundary = $"contas-mensais-{Guid.NewGuid():N}";
        var message = string.Join("\r\n", new[]
        {
            $"From: {from}",
            $"To: {string.Join(", ", to)}",
            $"Subject: {EncodeHeader(subject)}",
            "MIME-Version: 1.0",
            $"Content-Type: multipart/alternative; boundary=\"{boundary}\"",
            "",
            $"--{boundary}",
            "Content-Type: text/plain; charset=utf-8",
            "Content-Transfer-Encoding: base64",
            "",
            Convert.ToBase64String(Encoding.UTF8.GetBytes(text)),
            $"--{boundary}",
            "Content-Type: text/html; charset=utf-8",
            "Content-Transfer-Encoding: base64",
            "",
            Convert.ToBase64String(Encoding.UTF8.GetBytes(html)),
            $"--{boundary}--"
        });

        return Base64UrlEncode(Encoding.UTF8.GetBytes(message));
    }

    private static string EncodeHeader(string value)
    {
        return $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(value))}?=";
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}
