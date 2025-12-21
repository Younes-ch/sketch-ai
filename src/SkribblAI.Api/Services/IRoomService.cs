namespace SkribblAI.Api.Services;

/// <summary>
/// Service for managing game rooms and their players.
/// </summary>
public interface IRoomService
{
    /// <summary>
    /// Creates a new game room with the specified host.
    /// </summary>
    /// <param name="roomCode">Unique 6-character room code.</param>
    /// <param name="isPublic">Whether the room is visible in public room listings.</param>
    /// <param name="hostConnectionId">SignalR connection ID of the host.</param>
    /// <param name="hostUsername">Display name of the host player.</param>
    /// <returns>The created room.</returns>
    Task<Room> CreateRoomAsync(string roomCode, bool isPublic, string hostConnectionId, string hostUsername);

    /// <summary>
    /// Asynchronously updates the settings for the specified room.
    /// </summary>
    /// <param name="roomCode">The unique code identifying the room whose settings are to be updated. Cannot be null or empty.</param>
    /// <param name="settings">An object containing the new settings to apply to the room. Cannot be null.</param>
    /// <returns>A task that represents the asynchronous operation. The task result contains the updated <see cref="Room"/>
    /// object with the applied settings.</returns>
    Task<(Room? Room, string? ErrorMessage)> UpdateRoomSettingsAsync(string roomCode, RoomSettings settings);

    /// <summary>
    /// Retrieves a room by its code.
    /// </summary>
    /// <param name="roomCode">The room code to look up.</param>
    /// <returns>The room if found, null otherwise.</returns>
    Task<Room?> GetRoomAsync(string roomCode);

    /// <summary>
    /// Gets all public rooms that are not full.
    /// </summary>
    /// <returns>List of available public rooms.</returns>
    Task<List<Room>> GetPublicRoomsAsync();

    /// <summary>
    /// Checks if a room has reached its maximum player capacity.
    /// </summary>
    /// <param name="roomCode">The room code to check.</param>
    /// <returns>True if room is full or doesn't exist.</returns>
    Task<bool> IsRoomFullAsync(string roomCode);

    /// <summary>
    /// Checks if a room exists.
    /// </summary>
    /// <param name="roomCode">The room code to check.</param>
    /// <returns>True if room exists.</returns>
    Task<bool> RoomExistsAsync(string roomCode);

    /// <summary>
    /// Adds a player to a room. Handles reconnection if username already exists.
    /// </summary>
    /// <param name="roomCode">The room to join.</param>
    /// <param name="connectionId">SignalR connection ID of the player.</param>
    /// <param name="username">Display name of the player.</param>
    /// <returns>The player if successfully added/reconnected, null if room not found or full.</returns>
    Task<Player?> AddPlayerToRoomAsync(string roomCode, string connectionId, string username);

    /// <summary>
    /// Removes a player from a room. Handles host migration if host leaves.
    /// Deletes the room if it becomes empty.
    /// </summary>
    /// <param name="roomCode">The room to leave.</param>
    /// <param name="connectionId">SignalR connection ID of the player.</param>
    /// <returns>True if player was removed.</returns>
    Task<bool> RemovePlayerFromRoomAsync(string roomCode, string connectionId);

    /// <summary>
    /// Deletes a room and all associated data.
    /// </summary>
    /// <param name="roomCode">The room to delete.</param>
    /// <returns>True if room was deleted.</returns>
    Task<bool> DeleteRoomAsync(string roomCode);

    /// <summary>
    /// Refreshes the room's TTL to prevent expiration.
    /// </summary>
    /// <param name="roomCode">The room to update.</param>
    Task UpdateLastActivityAsync(string roomCode);

    /// <summary>
    /// Finds a player in a room by their connection ID.
    /// </summary>
    /// <param name="roomCode">The room to search.</param>
    /// <param name="connectionId">The connection ID to find.</param>
    /// <returns>The player if found.</returns>
    Task<Player?> GetPlayerByConnectionIdAsync(string roomCode, string connectionId);

    /// <summary>
    /// Finds which room a connection belongs to.
    /// </summary>
    /// <param name="connectionId">The connection ID to look up.</param>
    /// <returns>The room code if found.</returns>
    Task<string?> GetRoomCodeByConnectionIdAsync(string connectionId);

    /// <summary>
    /// Persists the current room state to Redis.
    /// <param name="room">The room to save.</param>
    /// </summary>
    Task SaveRoomAsync(Room room);
}
