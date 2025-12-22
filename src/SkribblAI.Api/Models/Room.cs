namespace SkribblAI.Api.Models;

public class Room
{
    public required string Id { get; set; }
    public required string HostConnectionId { get; set; }
    public bool IsPublic { get; set; }
    public required RoomSettingsDto Settings { get; set; }
    public List<Player> Players { get; set; } = [];
    public GamePhase Phase { get; set; } = GamePhase.Lobby;
    public string? CurrentDrawerConnectionId { get; set; }
    public string? CurrentWord { get; set; }
    public string? CurrentWordHint { get; set; }
    public int LettersRevealed { get; set; } = 0;
    public int RoundNumber { get; set; } = 1;
    public DateTime? RoundStartedAt { get; set; }
    public List<string>? WordChoices { get; set; }
    public HashSet<string> PlayersWhoGuessed { get; set; } = [];
    public DateTime CreatedAt { get; set; }
    public DateTime LastActivityAt { get; set; }
}
