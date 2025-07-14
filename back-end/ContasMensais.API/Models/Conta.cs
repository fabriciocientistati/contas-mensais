
namespace ContasMensais.API.Models;

public class Conta
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = string.Empty;
    public int Ano { get; set; }
    public int Mes { get; set; }
    public bool Paga { get; set; } = true;
    public DateOnly DataVencimento { get; set; }
    public decimal ValorParcela { get; set; }
    public int QuantidadeParcelas { get; set; }
    public decimal ValorTotalParcelas => Math.Round(ValorParcela * QuantidadeParcelas, 2);
    public decimal ValorTotalMensal => Math.Round(ValorParcela * QuantidadeParcelas, 2);
}