namespace SkribblAI.Api.Services;

public class RoomService : IRoomService
{

    private readonly IDatabase _db;
    private readonly IOptions<GameSettings> _gameSettings;
    private readonly ILogger<RoomService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RoomService(
        IConnectionMultiplexer redis,
        IOptions<GameSettings> gameSettings,
        ILogger<RoomService> logger)
    {
        _db = redis.GetDatabase();
        _gameSettings = gameSettings;
        _logger = logger;
    }

    public async Task<Room> CreateRoomAsync(string roomCode, bool isPublic, string hostConnectionId, string hostUsername)
    {
        var host = new Player
        {
            ConnectionId = hostConnectionId,
            Username = hostUsername,
            IsHost = true,
            JoinedAt = DateTime.UtcNow,
            IsConnected = true
        };

        var roomSettings = new RoomSettingsDto()
        {
            Difficulty = _gameSettings.Value.DefaultDifficulty,
            DrawTimeSeconds = _gameSettings.Value.DefaultDrawTime,
            MaxPlayers = _gameSettings.Value.DefaultMaxPlayers,
            TotalRounds = _gameSettings.Value.DefaultRounds,
            WordChoiceCount = _gameSettings.Value.DefaultWordChoices
        };

        var room = new Room
        {
            Id = roomCode,
            HostConnectionId = hostConnectionId,
            IsPublic = isPublic,
            Settings = roomSettings,
            Players = [host],
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow
        };

        await SaveRoomAsync(room);

        var connectionKey = RedisKeys.ConnectionToRoom(hostConnectionId);
        await _db.StringSetAsync(connectionKey, roomCode, RedisKeys.RoomExpiry);

        if (isPublic)
        {
            await _db.SetAddAsync(RedisKeys.PublicRooms, roomCode);
        }

        _logger.LogInformation("Room {roomCode} created by {Username} ({ConnectionId})",
            roomCode, hostUsername, hostConnectionId);

        return room;
    }

    public async Task<(Room? Room, string? ErrorMessage)> UpdateRoomSettingsAsync(string roomCode, string connectionId, RoomSettingsDto roomSettings)
    {
        var (isValid, errorMessage) = ValidationHelper.IsValidRoomSettings(
            roomSettings,
            _gameSettings.Value);

        if (!isValid)
        {
            _logger.LogWarning("UpdateRoomSettings rejected for room {RoomCode}: {ValidationError}",
                roomCode,
                errorMessage);
            return (null, errorMessage);
        }

        var room = await GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("Failed to update room settings with code {RoomCode} - room not found",
                roomCode);

            return (null, "Room not found");
        }

        if (room.HostConnectionId != connectionId)
        {
            _logger.LogWarning("UpdateRoomSettings rejected: Connection {ConnectionId} is not the host of room {RoomCode}",
                connectionId, roomCode);
            return (null, "Only the host can change room settings");
        }

        if (room.Phase != GamePhase.Lobby && room.Phase != GamePhase.GameEnd)
        {
            _logger.LogWarning("UpdateRoomSettings rejected: Room {RoomCode} is in {CurrentPhase} phase, expected Lobby|GamePhase",
                roomCode, room.Phase);
            return (null, "Room settings can only be changed in the lobby or when the game ended");
        }

        room.Settings = roomSettings;
        await SaveRoomAsync(room);

        return (room, null);
    }

    public async Task<Room?> GetRoomAsync(string roomCode)
    {
        var roomKey = RedisKeys.Room(roomCode);
        var roomJson = await RedisHelper.SafeExecuteAsync(
            () => _db.StringGetAsync(roomKey),
            _logger,
            $"GetRoom:{roomCode}",
            RedisValue.Null);

        if (roomJson.IsNullOrEmpty)
        {
            _logger.LogDebug("Room {roomCode} not found", roomCode);
            return null;
        }

        var room = JsonSerializer.Deserialize<Room>(roomJson.ToString(), JsonOptions);
        return room;
    }

    public async Task<List<Room>> GetPublicRoomsAsync()
    {
        var publicRoomCodes = await RedisHelper.SafeExecuteAsync(
            () => _db.SetMembersAsync(RedisKeys.PublicRooms),
            _logger,
            "GetPublicRooms",
            []) ?? [];

        List<Room> rooms = [];
        var staleRoomsRemoved = 0;

        foreach (var roomCode in publicRoomCodes)
        {
            if (roomCode.IsNullOrEmpty) continue;

            var roomCodeStr = roomCode.ToString();
            var room = await GetRoomAsync(roomCodeStr);
            if (room is not null && room.Players.Count < room.Settings.MaxPlayers)
            {
                rooms.Add(room);
            }
            else if (room is null)
            {
                await _db.SetRemoveAsync(RedisKeys.PublicRooms, roomCode);
                staleRoomsRemoved++;
            }
        }

        if (staleRoomsRemoved > 0)
        {
            _logger.LogInformation("Cleaned up {StaleCount} stale public room entries", staleRoomsRemoved);
        }

        _logger.LogDebug("Found {Count} available public rooms", rooms.Count);
        return rooms;
    }

    public async Task<bool> IsRoomFullAsync(string roomCode)
    {
        var room = await GetRoomAsync(roomCode);

        return room is null || room.Players.Count >= room.Settings.MaxPlayers;
    }

    public async Task<bool> RoomExistsAsync(string roomCode)
    {
        var roomKey = RedisKeys.Room(roomCode);
        var roomExists = await RedisHelper.SafeExecuteAsync(
            () => _db.KeyExistsAsync(roomKey),
            _logger,
            $"RoomExists:{roomCode}",
            false);

        return roomExists;
    }

    public async Task<Player?> AddPlayerToRoomAsync(string roomCode, string connectionId, string username)
    {
        var room = await GetRoomAsync(roomCode);
        if (room is null)
        {
            _logger.LogWarning("Failed to add player {Username} - room {RoomCode} not found",
                username, roomCode);
            return null;
        }

        if (room.Players.Count >= room.Settings.MaxPlayers)
        {
            _logger.LogWarning("Failed to add player {Username} - room {RoomCode} is full ({PlayerCount}/{MaxPlayers})",
                username, roomCode, room.Players.Count, room.Settings.MaxPlayers);
            return null;
        }

        var newPlayer = new Player
        {
            ConnectionId = connectionId,
            Username = username,
            IsHost = false,
            JoinedAt = DateTime.UtcNow,
            IsConnected = true
        };

        room.Players.Add(newPlayer);

        _logger.LogInformation("Player {Username} joined room {RoomCode}. Players: {PlayerCount}/{MaxPlayers}",
            username, roomCode, room.Players.Count, room.Settings.MaxPlayers);

        room.LastActivityAt = DateTime.UtcNow;

        await SaveRoomAsync(room);

        var connectionKey = RedisKeys.ConnectionToRoom(connectionId);
        await _db.StringSetAsync(connectionKey, roomCode, RedisKeys.RoomExpiry);

        return newPlayer;
    }

    public async Task<bool> RemovePlayerFromRoomAsync(string roomCode, string connectionId)
    {
        var room = await GetRoomAsync(roomCode);
        if (room is null)
        {
            _logger.LogDebug("Cannot remove player - room {RoomCode} not found", roomCode);
            return false;
        }

        var player = room.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
        if (player is null)
        {
            _logger.LogDebug("Cannot remove player - connection {ConnectionId} not found in room {RoomCode}",
                connectionId[..8], roomCode); // Only log first 8 chars of connection ID
            return false;
        }

        room.Players.Remove(player);
        _logger.LogInformation("Player {Username} removed from room {RoomCode}. Remaining: {PlayerCount}",
            player.Username, roomCode, room.Players.Count);

        await _db.KeyDeleteAsync(RedisKeys.ConnectionToRoom(connectionId));

        if (room.Players.Count == 0)
        {
            await DeleteRoomAsync(roomCode);
            _logger.LogInformation("Room {RoomCode} deleted (empty)", roomCode);
        }
        else
        {
            // Host Migration: If host left, assign new host
            if (player.IsHost)
            {
                var newHost = room.Players.OrderBy(p => p.JoinedAt).First();
                newHost.IsHost = true;
                room.HostConnectionId = newHost.ConnectionId;
                _logger.LogInformation("Host migrated to {Username} in room {RoomCode}", newHost.Username, roomCode);
            }

            room.LastActivityAt = DateTime.UtcNow;

            await SaveRoomAsync(room);
        }

        return true;
    }

    public async Task<bool> DeleteRoomAsync(string roomCode)
    {
        var room = await GetRoomAsync(roomCode);
        if (room is null)
        {
            _logger.LogDebug("Cannot delete room {RoomCode} - not found", roomCode);
            return false;
        }

        _logger.LogInformation("Deleting room {RoomCode} with {PlayerCount} players",
            roomCode, room.Players.Count);

        await _db.SetRemoveAsync(RedisKeys.PublicRooms, roomCode);
        await _db.SetRemoveAsync(RedisKeys.RoomsInDrawingPhase, roomCode);

        // Clean up all connection keys for players in this room
        var keysToDelete = room.Players
            .Select(p => (RedisKey)RedisKeys.ConnectionToRoom(p.ConnectionId))
            .ToList();

        keysToDelete.Add(RedisKeys.Room(roomCode));

        keysToDelete.Add(RedisKeys.CanvasHistory(roomCode));

        await _db.KeyDeleteAsync(keysToDelete.ToArray());
        return true;
    }

    public async Task UpdateLastActivityAsync(string roomCode)
    {
        await _db.KeyExpireAsync(RedisKeys.Room(roomCode), RedisKeys.RoomExpiry);
    }

    public async Task<Player?> GetPlayerByConnectionIdAsync(string roomCode, string connectionId)
    {
        var room = await GetRoomAsync(roomCode);
        return room?.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
    }

    public async Task<string?> GetRoomCodeByConnectionIdAsync(string connectionId)
    {
        var connectionKey = RedisKeys.ConnectionToRoom(connectionId);
        var roomCode = await RedisHelper.SafeExecuteAsync(
            () => _db.StringGetAsync(connectionKey),
            _logger,
            "GetRoomCodeByConnectionId",
            RedisValue.Null);

        return roomCode.HasValue ? roomCode.ToString() : null;
    }

    public async Task SaveRoomAsync(Room room)
    {
        var roomKey = RedisKeys.Room(room.Id);
        var roomJson = JsonSerializer.Serialize(room, JsonOptions);
        await _db.StringSetAsync(roomKey, roomJson, RedisKeys.RoomExpiry);

        _logger.LogDebug("Room {RoomCode} state saved (Phase: {Phase}, Players: {PlayerCount})",
            room.Id, room.Phase, room.Players.Count);
    }

    public async Task<List<Room>> GetActiveDrawingRoomsAsync()
    {
        var drawingPhaseRoomCodes = await RedisHelper.SafeExecuteAsync(
            () => _db.SetMembersAsync(RedisKeys.RoomsInDrawingPhase),
            _logger,
            "GetActiveDrawingRooms",
            []) ?? [];

        List<Room> activeRooms = [];

        foreach (var roomCode in drawingPhaseRoomCodes)
        {
            if (roomCode.IsNullOrEmpty) continue;

            var room = await GetRoomAsync(roomCode.ToString());
            if (room is { Phase: GamePhase.Drawing, RoundStartedAt: not null })
            {
                activeRooms.Add(room);
            }
            else
            {
                // Room no longer exists or not in drawing phase
                await RemoveFromDrawingPhaseAsync(roomCode.ToString());
            }
        }

        return activeRooms;
    }

    public async Task AddToDrawingPhaseAsync(string roomCode)
    {
        await RedisHelper.SafeExecuteAsync(
            () => _db.SetAddAsync(RedisKeys.RoomsInDrawingPhase, roomCode),
            _logger,
            $"AddToDrawingPhase:{roomCode}");

        _logger.LogDebug("Room {RoomCode} added to drawing phase tracking", roomCode);
    }

    public async Task RemoveFromDrawingPhaseAsync(string roomCode)
    {
        await RedisHelper.SafeExecuteAsync(
            () => _db.SetRemoveAsync(RedisKeys.RoomsInDrawingPhase, roomCode),
            _logger,
            $"RemoveFromDrawingPhase:{roomCode}");

        _logger.LogDebug("Room {RoomCode} removed from drawing phase tracking", roomCode);
    }
}
