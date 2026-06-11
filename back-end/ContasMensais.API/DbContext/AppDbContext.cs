using ContasMensais.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ContasMensais.API.DbContext;

public class AppDbContext : Microsoft.EntityFrameworkCore.DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    public DbSet<Conta> Contas => Set<Conta>();
    public DbSet<ReceitaMensal> Receitas => Set<ReceitaMensal>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Usuario>()
            .HasIndex(usuario => usuario.Email)
            .IsUnique();
    }
}
