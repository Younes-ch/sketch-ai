namespace SkribblAI.Api.Models;

public class Room
{
    public required string Id { get; set; }
    public required string HostConnectionId { get; set; }
    public bool IsPublic { get; set; }
    public int MaxPlayers { get; set; } = 8;
    public List<Player> Players { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime LastActivityAt { get; set; }
}
