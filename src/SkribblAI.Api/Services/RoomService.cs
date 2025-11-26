namespace SkribblAI.Api.Services;

public class RoomService : IRoomService
{
    private readonly ILogger<RoomService> _logger;
    private readonly IDatabase _db;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RoomService(IConnectionMultiplexer redis, ILogger<RoomService> logger)
    {
        _logger = logger;
        _db = redis.GetDatabase();
    }

    public async Task<Room> CreateRoomAsync(string roomCode, string hostConnectionId, string hostUsername)
    {
        var host = new Player
        {
            ConnectionId = hostConnectionId,
            Username = hostUsername,
            IsHost = true,
            JoinedAt = DateTime.UtcNow,
            IsConnected = true
        };

        var room = new Room
        {
            Id = roomCode,
            HostConnectionId = hostConnectionId,
            Players = [host],
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow
        };

        var roomKey = RedisKeys.Room(roomCode);
        var connectionKey = RedisKeys.ConnectionToRoom(hostConnectionId);

        var roomJson = JsonSerializer.Serialize(room, JsonOptions);

        await _db.StringSetAsync(roomKey, roomJson, RedisKeys.RoomExpiry);
        await _db.StringSetAsync(connectionKey, roomCode, RedisKeys.RoomExpiry);

        _logger.LogInformation("Room {roomCode} created by {Username} ({ConnectionId})",
            roomCode, hostUsername, hostConnectionId);

        return room;
    }

    public async Task<Room?> GetRoomAsync(string roomCode)
    {
        var roomKey = RedisKeys.Room(roomCode);
        var roomJson = await _db.StringGetAsync(roomKey);

        if (roomJson.IsNullOrEmpty)
        {
            _logger.LogDebug("Room {roomCode} not found", roomCode);
            return null;
        }

        var room = JsonSerializer.Deserialize<Room>(roomJson.ToString(), JsonOptions);
        return room;
    }

    public async Task<bool> RoomExistsAsync(string roomCode)
    {
        var roomKey = RedisKeys.Room(roomCode);
        var roomExists = await _db.KeyExistsAsync(roomKey);

        return roomExists;
    }

    public async Task<Player?> AddPlayerToRoomAsync(string roomCode, string connectionId, string username)
    {
        var room = await GetRoomAsync(roomCode);
        if (room is null) return null;

        // Check if player already exists (reconnection)
        var existingPlayer = room.Players.FirstOrDefault(p => p.Username == username);

        if (existingPlayer != null)
        {
            // Clean up old connection key
            await _db.KeyDeleteAsync(RedisKeys.ConnectionToRoom(existingPlayer.ConnectionId));

            existingPlayer.ConnectionId = connectionId;
            existingPlayer.IsConnected = true;
        }
        else
        {
            var newPlayer = new Player
            {
                ConnectionId = connectionId,
                Username = username,
                IsHost = false,
                JoinedAt = DateTime.UtcNow,
                IsConnected = true
            };
            room.Players.Add(newPlayer);
        }

        room.LastActivityAt = DateTime.UtcNow;

        var roomKey = RedisKeys.Room(roomCode);
        var updatedRoomJson = JsonSerializer.Serialize(room, JsonOptions);
        var connectionKey = RedisKeys.ConnectionToRoom(connectionId);

        await _db.StringSetAsync(roomKey, updatedRoomJson, RedisKeys.RoomExpiry);
        await _db.StringSetAsync(connectionKey, roomCode, RedisKeys.RoomExpiry);

        return existingPlayer ?? room.Players.First(p => p.ConnectionId == connectionId);
    }

    public async Task<bool> RemovePlayerFromRoomAsync(string roomCode, string connectionId)
    {
        var room = await GetRoomAsync(roomCode);
        if (room is null) return false;

        var player = room.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
        if (player is null) return false;

        room.Players.Remove(player);

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
            var updatedRoomJson = JsonSerializer.Serialize(room, JsonOptions);
            await _db.StringSetAsync(RedisKeys.Room(roomCode), updatedRoomJson, RedisKeys.RoomExpiry);
        }

        return true;
    }

    public async Task<bool> DeleteRoomAsync(string roomCode)
    {
        var room = await GetRoomAsync(roomCode);
        if (room is null) return false;

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
        var roomCode = await _db.StringGetAsync(connectionKey);
        return roomCode.HasValue ? roomCode.ToString() : null;
    }
}
