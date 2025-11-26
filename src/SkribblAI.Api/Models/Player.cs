namespace SkribblAI.Api.Models;

public class Player
{
    public required string ConnectionId { get; set; }
    public required string Username { get; set; }
    public int Score { get; set; }
    public bool IsHost { get; set; }
    public DateTime JoinedAt { get; set; }
    public bool IsConnected { get; set; } = true;
}
