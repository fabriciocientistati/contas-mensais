using ContasMensais.API.Dtos;
using FluentValidation;

namespace ContasMensais.API.Validators;

public class ContaValidators : AbstractValidator<ContaDto>
{
    public ContaValidators()
    {
        RuleFor(c => c.Nome)
            .NotEmpty().WithMessage("O campo {PropertyName} precisa ser fornecido")
            .MinimumLength(3).WithMessage("O nome deve ter no mínimo 3 caracteres.");

        RuleFor(c => c.Ano)
            .InclusiveBetween(2000, DateTime.Now.Year + 1)
            .WithMessage("Ano deve estar entre 2000 e o próximo ano.");

        RuleFor(c => c.Mes)
            .InclusiveBetween(1, 12)
            .WithMessage("Mês deve estar entre 1 e 12.");

        RuleFor(c => c.DataVencimento)
            .NotEmpty().WithMessage("Data de vencimento é obrigatória.");
        
        RuleFor(c => c.ValorParcela)
            .GreaterThan(0).WithMessage("O valor da parcela deve ser maior que 0.");
        
        RuleFor(c => c.QuantidadeParcelas)
            .GreaterThan(0).WithMessage("A quantidade de parcelas deve ser maior que 0.");
    }
}