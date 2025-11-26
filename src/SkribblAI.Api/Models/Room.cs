namespace SkribblAI.Api.Models;

public class Room
{
    public required string Id { get; set; }
    public required string HostConnectionId { get; set; }
    public List<Player> Players { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime LastActivityAt { get; set; }
}
