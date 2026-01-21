namespace SketchAI.Api.Models;

public class Player
{
    public required string ConnectionId { get; set; }
    public required string Username { get; set; }
    public int Score { get; set; }
    public bool IsHost { get; set; }
    public int AiDrawingsUsed { get; set; }
    public int ImageHintsUsed { get; set; }
    public DateTime JoinedAt { get; set; }
    public DateTime? LastAiDrawingAt { get; set; }
}
