using ContasMensais.API.Dtos;
using FluentValidation;

namespace ContasMensais.API.Validators;

public class ReceitaMensalValidator : AbstractValidator<ReceitaMensalDto>
{
    public ReceitaMensalValidator()
    {
        RuleFor(r => r.Ano)
            .InclusiveBetween(2000, DateTime.Now.Year + 1)
            .WithMessage("Ano deve estar entre 2000 e o próximo ano.");

        RuleFor(r => r.Mes)
            .InclusiveBetween(1, 12)
            .WithMessage("Mês deve estar entre 1 e 12.");

    }
}
