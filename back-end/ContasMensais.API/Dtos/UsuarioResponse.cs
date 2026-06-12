namespace ContasMensais.API.Dtos;

public class UsuarioResponse
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
}
