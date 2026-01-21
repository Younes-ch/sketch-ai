namespace SketchAI.Api.Extensions;

public static class RoomExtensions
{
    /// <summary>
    /// Maps a Room model to a GameStateDto.
    /// </summary>
    public static GameStateDto ToDto(this Room room)
    {
        var drawer = room.Players.FirstOrDefault(p => p.ConnectionId == room.CurrentDrawerConnectionId);

        return new GameStateDto
        {
            RoomCode = room.Id,
            Phase = room.Phase.ToString(),
            CurrentDrawerUsername = drawer?.Username ?? "Unknown",
            RoundNumber = room.RoundNumber,
            TotalRounds = room.Settings.TotalRounds,
            DrawTimeSeconds = room.Settings.DrawTimeSeconds,
            Players = room.Players.Select(p => p.ToDto()).ToList(),
            WordHint = null,
            RoundStartedAt = room.RoundStartedAt
        };
    }
}
