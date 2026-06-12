namespace ContasMensais.API.Dtos;

public class CreateUsuarioRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
}
