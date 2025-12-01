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
        if (string.IsNullOrWhiteSpace(roomCode))
            return false;

        if (roomCode.Length != RoomCodeLength)
            return false;

        return RoomCodeRegex().IsMatch(roomCode);
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
        if (string.IsNullOrWhiteSpace(color))
            return false;

        return HexColorRegex().IsMatch(color);
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
