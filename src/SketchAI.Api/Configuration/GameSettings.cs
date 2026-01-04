namespace SketchAI.Api.Configuration;

public class GameSettings
{
    public int DefaultMaxPlayers { get; set; }
    public int DefaultRounds { get; set; }
    public int DefaultDrawTime { get; set; }
    public int DefaultWordChoices { get; set; }
    public string DefaultDifficulty { get; set; } = "mixed";
    public int MinPlayers { get; set; } = 2;
    public int MaxPlayers { get; set; } = 20;
    public int MinRounds { get; set; } = 1;
    public int MaxRounds { get; set; } = 10;
    public int MinWordChoices { get; set; } = 2;
    public int MaxWordChoices { get; set; } = 5;
    public int MaxAiDrawingsPerRound { get; set; } = 2;
    public int AiDrawingCooldownSeconds { get; set; } = 30;
    public List<int> AllowedDrawTimes { get; set; } =
    [
        15, 20, 30, 40, 50, 60, 70, 80, 90,
        100, 120, 150, 180, 210, 240
    ];
    public List<string> AllowedDifficulties { get; set; } = ["easy", "medium", "hard", "mixed"];
}