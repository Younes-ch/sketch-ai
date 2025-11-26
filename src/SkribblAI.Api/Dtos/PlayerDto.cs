namespace SkribblAI.Api.Dtos;

public class PlayerDto
{
    public required string Username { get; set; }
    public int Score { get; set; }
    public bool IsHost { get; set; }
    public bool IsConnected { get; set; }
}
