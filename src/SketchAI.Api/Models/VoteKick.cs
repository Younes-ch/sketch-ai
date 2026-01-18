namespace SketchAI.Api.Models;

public class VoteKick
{
    public required string TargetUsername { get; set; }
    public required string TargetConnectionId { get; set; }
    public required string InitiatorUsername { get; set; }
    public HashSet<string> VotesToKick { get; set; } = [];
    public HashSet<string> VotesToKeep { get; set; } = [];
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public int DurationSeconds { get; set; } = 30;
    /// <summary>
    /// The number of eligible voters when the vote started (excludes target).
    /// This is fixed at vote creation so new players joining don't affect the vote.
    /// </summary>
    public int TotalVotersNeeded { get; set; }
}
