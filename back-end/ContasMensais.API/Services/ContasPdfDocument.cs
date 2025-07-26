using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QuestPDF.Drawing;
using ContasMensais.API.Dtos;
using System.Globalization;

public class ContasPdfDocument : IDocument
{
    private readonly List<ContaDto> _contas;

    public ContasPdfDocument(List<ContaDto> contas)
    {
        _contas = contas;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    public void Compose(IDocumentContainer container)
    {
        var totalGeral = _contas.Sum(c => c.ValorParcela);

        container.Page(page =>
        {
            page.Margin(30);
            page.Size(PageSizes.A4);

            page.Header().Text("Relatório de Contas Mensais")
                .FontSize(24).Bold().FontColor(Colors.Blue.Medium).AlignCenter();

            page.Content().PaddingVertical(10).Column(col =>
            {
                var grupos = _contas
                    .OrderBy(c => c.Nome)
                    .ThenBy(c => c.DataVencimento)
                    .GroupBy(c => c.Nome);

                foreach (var grupo in grupos)
                {
                    col.Item().PaddingBottom(5).Text($"📌 {grupo.Key}")
                        .FontSize(16).Bold().FontColor(Colors.Black);

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2); // Vencimento
                            columns.RelativeColumn(2); // Valor
                            columns.RelativeColumn(2); // Parcela
                            columns.RelativeColumn(2); // Situação
                        });

                        table.Header(header =>
                        {
                            header.Cell().Element(CellStyle).Text("Vencimento").SemiBold();
                            header.Cell().Element(CellStyle).Text("Valor").SemiBold();
                            header.Cell().Element(CellStyle).Text("Parcela").SemiBold();
                            header.Cell().Element(CellStyle).Text("Situação").SemiBold();

                            static IContainer CellStyle(IContainer container)
                            {
                                return container.DefaultTextStyle(x => x.FontSize(11).FontColor(Colors.White))
                                    .Background(Colors.Blue.Medium)
                                    .Padding(5);
                            }
                        });

                        foreach (var conta in grupo)
                        {
                            var isPaga = conta.Paga;
                            var bgColor = isPaga ? Colors.Green.Lighten3 : Colors.White;

                            table.Cell().Element(CellDataStyle(bgColor)).Text(conta.DataVencimento.ToString("dd/MM/yyyy"));
                            table.Cell().Element(CellDataStyle(bgColor)).Text(conta.ValorParcela.ToString("C", new CultureInfo("pt-BR")));
                            table.Cell().Element(CellDataStyle(bgColor)).Text($"{conta.IndiceParcela}/{conta.TotalParcelas}");
                            table.Cell().Element(CellDataStyle(bgColor)).Text(isPaga ? "✅ Paga" : "❌ Não paga");
                        }

                        static Func<IContainer, IContainer> CellDataStyle(string backgroundColor) =>
                            container => container.Background(backgroundColor)
                                .DefaultTextStyle(x => x.FontSize(10).FontColor(Colors.Black))
                                .PaddingVertical(4).PaddingHorizontal(5);
                    });

                     // Quebra de página entre grupos
                }
            });

            page.Footer().AlignRight().Text(text =>
            {
                text.Span("Total geral: ").SemiBold();
                text.Span($"{totalGeral.ToString("C", new CultureInfo("pt-BR"))}").Bold();
            });
        });
    }
}
