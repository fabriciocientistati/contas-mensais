namespace ContasMensais.API.Models;

public class AuthSettings
{
    public string AdminEmail { get; set; } = string.Empty;
    public string AdminPassword { get; set; } = string.Empty;
    public string JwtSecret { get; set; } = string.Empty;
    public int JwtExpirationMinutes { get; set; } = 1440;
}
