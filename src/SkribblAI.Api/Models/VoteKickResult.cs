namespace SkribblAI.Api.Models;

/// <summary>
/// Result of a completed votekick.
/// </summary>
public class VoteKickResult
{
    public required string TargetUsername { get; set; }
    public required string TargetConnectionId { get; set; }
    public bool ShouldKick { get; set; }
    public int VotesToKick { get; set; }
    public int VotesToKeep { get; set; }
}
