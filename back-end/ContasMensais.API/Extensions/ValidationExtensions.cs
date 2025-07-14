using FluentValidation;

namespace ContasMensais.API.Extensions;

public static class ValidationExtensions
{
    public static async Task<IResult?> Validate<T>(T model, IValidator<T> validator)
    {
        var validationResult = await validator.ValidateAsync(model);

        if (!validationResult.IsValid)
        {
            var errors = validationResult.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(e => e.ErrorMessage).ToArray()
                );

            return Results.ValidationProblem(errors);
        }

        return null;
    }
}