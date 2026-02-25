namespace SketchAI.Api.Services.Game;

/// <summary>
/// Service for managing game rooms and their players.
/// </summary>
public interface IRoomService
{
    /// <summary>
    /// Creates a new game room with the specified host, atomically checking for uniqueness.
    /// </summary>
    /// <param name="roomCode">Unique 6-character room code.</param>
    /// <param name="roomName">Display name for the room.</param>
    /// <param name="isPublic">Whether the room is visible in public room listings.</param>
    /// <param name="hostConnectionId">SignalR connection ID of the host.</param>
    /// <param name="hostUsername">Display name of the host player.</param>
    /// <returns>A tuple containing the created room if successful, or null with an error message if creation failed.</returns>
    Task<(Room? Room, string? ErrorMessage)> CreateRoomAsync(string roomCode, string roomName, bool isPublic, string hostConnectionId, string hostUsername);

    /// <summary>
    /// Checks if a room name is already in use by an active room.
    /// </summary>
    /// <param name="roomName">The room name to check.</param>
    /// <returns>True if the name is already taken, false otherwise.</returns>
    Task<bool> RoomNameExistsAsync(string roomName);

    /// <summary>
    /// Asynchronously updates the settings for the specified room if the requesting connection has permission.
    /// </summary>
    /// <remarks>The method validates the caller's permissions before applying the new settings. If the update
    /// fails due to invalid input, lack of permissions, or other errors, the returned <see cref="Room"/> will be <see
    /// langword="null"/> and <c>ErrorMessage</c> will contain a descriptive message.</remarks>
    /// <param name="roomCode">The unique code identifying the room whose settings are to be updated. Cannot be null or empty.</param>
    /// <param name="connectionId">The identifier of the connection requesting the update. Must correspond to a connected user with permission to
    /// modify the room settings.</param>
    /// <param name="settings">An object containing the new settings to apply to the room. Cannot be null.</param>
    /// <returns>A tuple containing the updated <see cref="Room"/> if the operation succeeds, or <see langword="null"/> if it
    /// fails, and an error message describing the reason for failure if applicable; otherwise, <see langword="null"/>.</returns>
    Task<(Room? Room, string? ErrorMessage)> UpdateRoomSettingsAsync(string roomCode, string connectionId, RoomSettingsDto settings);

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
    /// Gets a paginated list of public rooms that are not full.
    /// </summary>
    /// <param name="page">The page number (1-based).</param>
    /// <param name="pageSize">The number of rooms per page.</param>
    /// <returns>Paginated result containing rooms and pagination metadata.</returns>
    Task<(List<Room> Rooms, int TotalCount)> GetPublicRoomsAsync(int page, int pageSize);

    /// <summary>
    /// Checks if a room has reached its maximum player capacity.
    /// </summary>
    /// <param name="room">The room code to check.</param>
    /// <returns>True if room is full or null.</returns>
    bool IsRoomFull(Room? room);

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
    /// Gets all rooms currently in the Drawing phase.
    /// Used by the background timer service to check for round expiry and hint reveals.
    /// </summary>
    /// <returns>List of rooms in the Drawing phase.</returns>
    Task<List<Room>> GetActiveDrawingRoomsAsync();

    /// <summary>
    /// Adds a room to the drawing phase tracking set.
    /// Call this when a room enters the Drawing phase.
    /// </summary>
    /// <param name="roomCode">The room code to add.</param>
    Task AddToDrawingPhaseAsync(string roomCode);

    /// <summary>
    /// Removes a room from the drawing phase tracking set.
    /// Call this when a room exits the Drawing phase.
    /// </summary>
    /// <param name="roomCode">The room code to remove.</param>
    Task RemoveFromDrawingPhaseAsync(string roomCode);

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

    /// <summary>
    /// Atomically adds a reaction for a player in the specified room.
    /// Acquires a lock, validates room phase, drawer, and duplicate checks, then saves.
    /// </summary>
    /// <param name="roomCode">The room code.</param>
    /// <param name="connectionId">The connection ID of the reacting player.</param>
    /// <returns>A tuple with Success indicating whether the reaction was added, and SenderUsername if successful.</returns>
    Task<(bool Success, string? SenderUsername)> TryAddReactionAsync(string roomCode, string connectionId);

    /// <summary>
    /// Kicks a player from the room. Only the host can kick players.
    /// </summary>
    /// <param name="roomCode">The room code.</param>
    /// <param name="hostConnectionId">The connection ID of the host requesting the kick.</param>
    /// <param name="targetUsername">The username of the player to kick.</param>
    /// <returns>The kicked player if successful, null otherwise, and an error message if failed.</returns>
    Task<(Player? KickedPlayer, string? ErrorMessage)> KickPlayerAsync(string roomCode, string hostConnectionId, string targetUsername);

    /// <summary>
    /// Starts a votekick against a player.
    /// </summary>
    /// <param name="roomCode">The room code.</param>
    /// <param name="initiatorConnectionId">The connection ID of the player starting the votekick.</param>
    /// <param name="targetUsername">The username of the player to votekick.</param>
    /// <returns>Success status and error message if failed.</returns>
    Task<(bool Success, string? ErrorMessage)> StartVoteKickAsync(string roomCode, string initiatorConnectionId, string targetUsername);

    /// <summary>
    /// Casts a vote in an active votekick.
    /// </summary>
    /// <param name="roomCode">The room code.</param>
    /// <param name="voterConnectionId">The connection ID of the voting player.</param>
    /// <param name="voteToKick">True to vote to kick, false to vote to keep.</param>
    /// <returns>The vote result if voting is complete, null if more votes needed.</returns>
    Task<(VoteKickResult? Result, string? ErrorMessage)> CastVoteKickAsync(string roomCode, string voterConnectionId, bool voteToKick);

    /// <summary>
    /// Cancels an active votekick (if target leaves, timeout, or other reasons).
    /// Also removes the room from active vote kick tracking.
    /// </summary>
    /// <param name="roomCode">The room code.</param>
    Task CancelVoteKickAsync(string roomCode);

    /// <summary>
    /// Attempts to expire a vote kick if the timer has elapsed.
    /// Acquires lock to prevent race conditions with CastVoteKickAsync.
    /// </summary>
    /// <param name="roomCode">The room code.</param>
    /// <returns>The vote result if expired, null if not expired or already processed.</returns>
    Task<VoteKickResult?> TryExpireVoteKickAsync(string roomCode);
}
