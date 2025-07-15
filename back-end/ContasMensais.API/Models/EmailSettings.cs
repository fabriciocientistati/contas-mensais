namespace ContasMensais.API.Models;

public class EmailSettings
{
    public string Remetente { get; set; } = string.Empty;
    public List<string> Destinatarios { get; set; } = new();
    public string Senha { get; set; } = string.Empty;
}