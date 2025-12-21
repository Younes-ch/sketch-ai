namespace SkribblAI.Api.Extensions;

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
            Players = room.Players.Select(p => p.ToDto()).ToList(),
            WordHint = null,
            RoundStartedAt = room.RoundStartedAt
        };
    }

    public static RoomSettingsDto ToDto(this RoomSettings roomSettings)
    {
        return new RoomSettingsDto()
        {
            Difficulty = roomSettings.Difficulty,
            DrawTimeSeconds = roomSettings.DrawTimeSeconds,
            MaxPlayers = roomSettings.MaxPlayers,
            TotalRounds = roomSettings.TotalRounds,
            WordChoiceCount = roomSettings.WordChoiceCount
        };
    }
}
