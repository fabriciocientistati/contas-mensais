namespace ContasMensais.API.Dtos;

public class ReceitaMensalDto
{
    public Guid Id { get; set; }
    public int Ano { get; set; }
    public int Mes { get; set; }
    public decimal ValorTotal { get; set; }
    public DateTime AtualizadoEm { get; set; }
}
