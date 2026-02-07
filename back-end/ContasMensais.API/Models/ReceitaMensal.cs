namespace ContasMensais.API.Models;

public class ReceitaMensal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int Ano { get; set; }
    public int Mes { get; set; }
    public decimal ValorTotal { get; set; }
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
