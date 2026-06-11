using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ContasMensais.API.Models;
using Microsoft.IdentityModel.Tokens;

namespace ContasMensais.API.Services;

public class JwtTokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public LoginResponseData CreateToken(Usuario usuario)
    {
        var authSettings = _configuration.GetSection("AuthSettings").Get<AuthSettings>() ?? new AuthSettings();

        if (string.IsNullOrWhiteSpace(authSettings.JwtSecret) || authSettings.JwtSecret.Length < 32)
            throw new InvalidOperationException("AuthSettings__JwtSecret precisa ter pelo menos 32 caracteres.");

        var expiresAt = DateTime.UtcNow.AddMinutes(authSettings.JwtExpirationMinutes);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authSettings.JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Email, usuario.Email)
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new LoginResponseData(new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}

public record LoginResponseData(string Token, DateTime ExpiresAt);
