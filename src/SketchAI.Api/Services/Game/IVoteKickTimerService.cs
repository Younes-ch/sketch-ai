namespace SketchAI.Api.Services.Game;

public interface IVoteKickTimerService
{
    /// <summary>
    /// Gets all rooms with active vote kicks.
    /// </summary>
    Task<List<Room>> GetRoomsWithActiveVoteKicksAsync();

    /// <summary>
    /// Adds a room to the active vote kick tracking set.
    /// </summary>
    Task AddToActiveVoteKicksAsync(string roomCode);

    /// <summary>
    /// Removes a room from the active vote kick tracking set.
    /// </summary>
    Task RemoveFromActiveVoteKicksAsync(string roomCode);

    /// <summary>
    /// Processes vote kick expiration for a room.
    /// Returns the result if the vote kick expired, null otherwise.
    /// </summary>
    Task<VoteKickResult?> ProcessVoteKickExpirationAsync(Room room);
}
