using ContasMensais.API.DbContext;
using ContasMensais.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ContasMensais.API.Services;

public class AdminUserSeeder
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly PasswordHasher _passwordHasher;

    public AdminUserSeeder(AppDbContext db, IConfiguration configuration, PasswordHasher passwordHasher)
    {
        _db = db;
        _configuration = configuration;
        _passwordHasher = passwordHasher;
    }

    public async Task SeedAsync()
    {
        if (await _db.Usuarios.AnyAsync())
            return;

        var authSettings = _configuration.GetSection("AuthSettings").Get<AuthSettings>() ?? new AuthSettings();

        if (string.IsNullOrWhiteSpace(authSettings.AdminEmail) ||
            string.IsNullOrWhiteSpace(authSettings.AdminPassword))
        {
            throw new InvalidOperationException("Nenhum usuario existe. Configure AuthSettings__AdminEmail e AuthSettings__AdminPassword para criar o admin inicial.");
        }

        var usuario = new Usuario
        {
            Email = authSettings.AdminEmail.Trim().ToLowerInvariant(),
            Nome = "Administrador",
            PasswordHash = _passwordHasher.Hash(authSettings.AdminPassword)
        };

        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync();

        Console.WriteLine("[AUTH] Usuario administrador inicial criado: {0}", usuario.Email);
    }
}
