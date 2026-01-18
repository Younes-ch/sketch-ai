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
}
