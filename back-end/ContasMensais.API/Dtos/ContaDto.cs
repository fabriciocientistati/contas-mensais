
namespace ContasMensais.API.Dtos;

public class ContaDto
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public int Ano { get; set; }
    public int Mes { get; set; }
    public bool Paga { get; set; }
    public DateOnly DataVencimento { get; set; }
    public decimal ValorParcela { get; set; }
    public int QuantidadeParcelas { get; set; }
    public decimal ValorTotal => Math.Round(ValorParcela * QuantidadeParcelas, 2);
    public int IndiceParcela { get; set; }
    public int TotalParcelas { get; set; }

}