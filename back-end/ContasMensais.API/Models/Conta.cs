
public class Conta
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = string.Empty;
    public int Ano { get; set; }
    public int Mes { get; set; }
    public bool Paga { get; set; } = false;
    public DateOnly DataVencimento { get; set; }
    public decimal ValorParcela { get; set; }
    public int QuantidadeParcelas { get; set; }
    public decimal ValorTotal => Math.Round(ValorParcela * QuantidadeParcelas, 2);
}
