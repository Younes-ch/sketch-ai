namespace SketchAI.Api.Dtos;

/// <summary>
/// Game state sent to all players. Does NOT include the actual word.
/// </summary>
public class GameStateDto
{
    public required string RoomCode { get; set; }
    public required string Phase { get; set; }
    public required string CurrentDrawerUsername { get; set; }
    public int RoundNumber { get; set; }
    public int TotalRounds { get; set; }
    public int DrawTimeSeconds { get; set; }

    public List<PlayerDto> Players { get; set; } = [];

    /// <summary>
    /// Word hint shown to guessers (e.g., "_ _ _ _ _").
    /// Null during WordSelection phase.
    /// </summary>
    public string? WordHint { get; set; }

    /// <summary>
    /// Round start time for client-side timer calculation.
    /// </summary>
    public DateTime? RoundStartedAt { get; set; }
}
