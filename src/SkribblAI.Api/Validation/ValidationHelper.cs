namespace SkribblAI.Api.Validation;

public static partial class ValidationHelper
{
    // Canvas bounds
    private const int CanvasWidth = 800;
    private const int CanvasHeight = 500;

    // Validation limits
    private const int MinUsernameLength = 1;
    private const int MaxUsernameLength = 20;
    private const int RoomCodeLength = 6;
    private const int MinBrushWidth = 1;
    private const int MaxBrushWidth = 50;

    // Valid drawing command types
    private static readonly HashSet<string> ValidCommandTypes = ["stroke", "clear"];

    /// <summary>
    /// Validates a room code (6 chars, alphanumeric, uppercase).
    /// </summary>
    public static bool IsValidRoomCode(string? roomCode)
    {
        return !string.IsNullOrWhiteSpace(roomCode) && roomCode.Length == RoomCodeLength && RoomCodeRegex().IsMatch(roomCode);
    }

    /// <summary>
    /// Validates the specified room settings against the provided game settings and returns whether the configuration
    /// is valid.
    /// </summary>
    /// <remarks>The method checks each property of the room settings against the corresponding constraints in
    /// the game settings. Only the first validation error encountered is reported in the error message.</remarks>
    /// <param name="roomSettings">The room settings to validate. Contains user-specified values such as maximum players, total rounds, draw time,
    /// word choice count, and difficulty.</param>
    /// <param name="gameSettings">The game settings that define the allowed ranges and options for room configuration. Used as the validation
    /// criteria.</param>
    /// <returns>A tuple containing a boolean value that indicates whether the room settings are valid, and an error message
    /// describing the first validation failure if invalid; otherwise, null.</returns>
    public static (bool IsValid, string? ErrorMessage) IsValidRoomSettings(
        RoomSettingsDto roomSettings,
        GameSettings gameSettings)
    {
        if (roomSettings.MaxPlayers < gameSettings.MinPlayers || roomSettings.MaxPlayers > gameSettings.MaxPlayers)
            return (false,
                $"Max players should be between {gameSettings.MinPlayers}-{gameSettings.MinPlayers} players");

        if (roomSettings.TotalRounds < gameSettings.MinRounds || roomSettings.TotalRounds > gameSettings.MaxRounds)
            return (false,
                $"Total rounds should be between {gameSettings.MinRounds}-{gameSettings.MaxRounds}");

        if (!gameSettings.AllowedDrawTimes.Contains(roomSettings.DrawTimeSeconds))
            return (false, "Draw time should be one of the provided options");

        if (roomSettings.WordChoiceCount < gameSettings.MinWordChoices ||
            roomSettings.WordChoiceCount > gameSettings.MaxWordChoices)
            return (false,
                $"Word choices count should be between {gameSettings.MinWordChoices}-{gameSettings.MaxWordChoices}");

        if (!gameSettings.AllowedDifficulties.Contains(roomSettings.Difficulty))
            return (false, "Difficulty is not recognized");

        return (true, null);
    }

    /// <summary>
    /// Validates a username (1-20 chars, alphanumeric and spaces only).
    /// </summary>
    public static bool IsValidUsername(string? username)
    {
        if (string.IsNullOrWhiteSpace(username))
            return false;

        var trimmed = username.Trim();

        return trimmed.Length is >= MinUsernameLength and <= MaxUsernameLength && UsernameRegex().IsMatch(trimmed);
    }

    /// <summary>
    /// Validates a drawing command.
    /// </summary>
    public static bool IsValidDrawingCommand(DrawingCommandDto? command)
    {
        if (command is null)
            return false;

        // Validate type
        if (!ValidCommandTypes.Contains(command.Type.ToLowerInvariant()))
            return false;

        // Validate color (hex format)
        if (!IsValidHexColor(command.Color))
            return false;

        // Validate width
        if (command.Width is < MinBrushWidth or > MaxBrushWidth)
            return false;

        // For stroke commands, validate points
        if (!command.Type.Equals("stroke", StringComparison.OrdinalIgnoreCase)) return true;

        if (command.Points.Count == 0)
            return false;

        // Validate each point is within canvas bounds
        return command.Points.All(IsPointWithinBounds);
    }

    /// <summary>
    /// Validates a hex color string (#RGB or #RRGGBB format).
    /// </summary>
    public static bool IsValidHexColor(string? color)
    {
        return !string.IsNullOrWhiteSpace(color) && HexColorRegex().IsMatch(color);
    }

    /// <summary>
    /// Validates that a point is within canvas bounds.
    /// </summary>
    private static bool IsPointWithinBounds(PointDto? point)
    {
        if (point is null)
            return false;

        // Allow small negative values and slightly out of bounds for edge drawing
        const int tolerance = 10;

        return point.X >= -tolerance &&
               point.X <= CanvasWidth + tolerance &&
               point.Y >= -tolerance &&
               point.Y <= CanvasHeight + tolerance;
    }

    // Regex patterns using source generators for performance
    [GeneratedRegex("^[A-Z0-9]{6}$")]
    private static partial Regex RoomCodeRegex();

    [GeneratedRegex("^[a-zA-Z0-9 _-]+$")]
    private static partial Regex UsernameRegex();

    [GeneratedRegex("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")]
    private static partial Regex HexColorRegex();
}
