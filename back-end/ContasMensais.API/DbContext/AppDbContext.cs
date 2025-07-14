using ContasMensais.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ContasMensais.API.DbContext;

public class AppDbContext : Microsoft.EntityFrameworkCore.DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    public DbSet<Conta> Contas => Set<Conta>();
}