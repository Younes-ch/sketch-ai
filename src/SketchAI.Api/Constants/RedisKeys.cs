namespace SketchAI.Api.Constants;

public static class RedisKeys
{
    public static string Room(string roomCode) => $"room:{roomCode}";
    public static string RoomLock(string roomCode) => $"room:{roomCode}:lock";
    public static string CanvasHistory(string roomCode) => $"canvas:history:{roomCode}";
    public static string ConnectionToRoom(string connectionId) => $"connection:{connectionId}";
    public static string WordExplanation(string word, string targetLanguage) =>
        $"word_explanation:{word.ToLowerInvariant()}:{targetLanguage.ToLowerInvariant()}";

    public static string PublicRooms => "public_rooms";
    public static string RoomsInDrawingPhase => "drawing_phase_rooms";

    public static readonly TimeSpan RoomExpiry = TimeSpan.FromHours(2);
    public static readonly TimeSpan CanvasExpiry = TimeSpan.FromHours(2);
    public static readonly TimeSpan WordExplanationExpiry = TimeSpan.FromHours(24);
    public static readonly TimeSpan RoomLockExpiry = TimeSpan.FromSeconds(5);
}
