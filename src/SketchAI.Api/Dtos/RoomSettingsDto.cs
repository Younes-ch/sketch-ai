namespace SketchAI.Api.Dtos;

public class RoomSettingsDto
{
    public int MaxPlayers { get; set; }
    public int TotalRounds { get; set; }
    public int DrawTimeSeconds { get; set; }
    public int WordChoiceCount { get; set; }
    public string Difficulty { get; set; } = "mixed";
}
