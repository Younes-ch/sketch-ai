namespace SketchAI.Api.Services.Game;

public class RoomService : IRoomService
{
    private readonly IDatabase _db;
    private readonly IOptions<GameSettings> _gameSettings;
    private readonly ILogger<RoomService> _logger;
    private readonly IDistributedLockProvider _lockProvider;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RoomService(
        IConnectionMultiplexer redis,
        IOptions<GameSettings> gameSettings,
        ILogger<RoomService> logger,
        IDistributedLockProvider lockProvider)
    {
        _db = redis.GetDatabase();
        _gameSettings = gameSettings;
        _logger = logger;
        _lockProvider = lockProvider;
    }

    public async Task<Room> CreateRoomAsync(string roomCode, bool isPublic, string hostConnectionId, string hostUsername)
    {
        var host = new Player
        {
            ConnectionId = hostConnectionId,
            Username = hostUsername,
            IsHost = true,
            JoinedAt = DateTime.UtcNow,
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

        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("UpdateRoomSettings failed: Could not acquire lock for room {RoomCode}", roomCode);
            return (null, "Server busy, please try again");
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
            _logger.LogWarning("UpdateRoomSettings rejected: Room {RoomCode} is in {CurrentPhase} phase, expected Lobby|GameEnd",
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
            var isRoomFull = IsRoomFull(room);
            if (room is null)
            {
                await _db.SetRemoveAsync(RedisKeys.PublicRooms, roomCode);
                staleRoomsRemoved++;
            }
            else if (!isRoomFull)
            {
                rooms.Add(room);
            }
        }

        if (staleRoomsRemoved > 0)
        {
            _logger.LogInformation("Cleaned up {StaleCount} stale public room entries", staleRoomsRemoved);
        }

        _logger.LogDebug("Found {Count} available public rooms", rooms.Count);
        return rooms;
    }

    public bool IsRoomFull(Room? room)
    {
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
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("Failed to acquire lock for room {RoomCode} while adding player {Username}",
                roomCode, username);
            return null;
        }

        var room = await GetRoomAsync(roomCode);
        if (room is null)
        {
            _logger.LogWarning("Failed to add player {Username} - room {RoomCode} not found",
                username, roomCode);
            return null;
        }

        var isFull = IsRoomFull(room);
        if (isFull)
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
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("Failed to acquire lock for room {RoomCode} while removing player",
                roomCode);
            return false;
        }

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

    public async Task<(Player? KickedPlayer, string? ErrorMessage)> KickPlayerAsync(string roomCode, string hostConnectionId, string targetUsername)
    {
        var room = await GetRoomAsync(roomCode);
        if (room is null)
        {
            return (null, "Room not found");
        }

        if (room.HostConnectionId != hostConnectionId)
        {
            return (null, "Only the host can kick players");
        }

        var targetPlayer = room.Players.FirstOrDefault(p => p.Username == targetUsername);
        if (targetPlayer is null)
        {
            return (null, "Player not found");
        }

        if (targetPlayer.IsHost)
        {
            return (null, "Cannot kick the host");
        }

        return (targetPlayer, null);
    }

    public async Task<(bool Success, string? ErrorMessage)> StartVoteKickAsync(string roomCode, string initiatorConnectionId, string targetUsername)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("Failed to acquire lock for room {RoomCode} while starting votekick",
                roomCode);
            return (false, "Server busy, please try again");
        }

        var room = await GetRoomAsync(roomCode);
        if (room is null)
        {
            return (false, "Room not found");
        }

        if (room.ActiveVoteKick is not null)
        {
            return (false, "A votekick is already in progress");
        }

        var initiator = room.Players.FirstOrDefault(p => p.ConnectionId == initiatorConnectionId);
        if (initiator is null)
        {
            return (false, "You are not in this room");
        }

        var targetPlayer = room.Players.FirstOrDefault(p => p.Username == targetUsername);
        if (targetPlayer is null)
        {
            return (false, "Player not found");
        }

        if (targetPlayer.ConnectionId == initiatorConnectionId)
        {
            return (false, "You cannot votekick yourself");
        }

        if (targetPlayer.IsHost)
        {
            return (false, "Cannot votekick the host");
        }

        if (room.Players.Count < 3)
        {
            return (false, "Need at least 3 players to start a votekick");
        }

        room.ActiveVoteKick = new VoteKick
        {
            TargetUsername = targetUsername,
            TargetConnectionId = targetPlayer.ConnectionId,
            InitiatorUsername = initiator.Username,
            StartedAt = DateTime.UtcNow,
            DurationSeconds = _gameSettings.Value.VoteKickDurationSeconds,
            TotalVotersNeeded = room.Players.Count - 1
        };

        // Initiator automatically votes to kick
        room.ActiveVoteKick.VotesToKick.Add(initiatorConnectionId);

        await SaveRoomAsync(room);

        await RedisHelper.SafeExecuteAsync(
            () => _db.SetAddAsync(RedisKeys.ActiveVoteKicks, roomCode),
            _logger,
            $"TrackActiveVoteKickInRoom:{roomCode}");

        _logger.LogInformation("Votekick started in room {RoomCode} by {Initiator} against {Target}",
            roomCode, initiator.Username, targetUsername);

        return (true, null);
    }

    public async Task<(VoteKickResult? Result, string? ErrorMessage)> CastVoteKickAsync(string roomCode, string voterConnectionId, bool voteToKick)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("Failed to acquire lock for room {RoomCode} while casting vote",
                roomCode);
            return (null, "Server busy, please try again");
        }

        var room = await GetRoomAsync(roomCode);
        if (room is null)
        {
            return (null, "Room not found");
        }

        if (room.ActiveVoteKick is null)
        {
            return (null, "No active votekick");
        }

        var voter = room.Players.FirstOrDefault(p => p.ConnectionId == voterConnectionId);
        if (voter is null)
        {
            return (null, "You are not in this room");
        }

        if (room.ActiveVoteKick.VotesToKick.Contains(voterConnectionId) ||
            room.ActiveVoteKick.VotesToKeep.Contains(voterConnectionId))
        {
            return (null, "You have already voted");
        }

        if (voterConnectionId == room.ActiveVoteKick.TargetConnectionId)
        {
            return (null, "You cannot vote on your own votekick");
        }

        if (voteToKick)
        {
            room.ActiveVoteKick.VotesToKick.Add(voterConnectionId);
        }
        else
        {
            room.ActiveVoteKick.VotesToKeep.Add(voterConnectionId);
        }

        await SaveRoomAsync(room);

        var totalVotes = room.ActiveVoteKick.VotesToKick.Count + room.ActiveVoteKick.VotesToKeep.Count;

        if (totalVotes >= room.ActiveVoteKick.TotalVotersNeeded)
        {
            var kickVotes = room.ActiveVoteKick.VotesToKick.Count;
            var keepVotes = room.ActiveVoteKick.VotesToKeep.Count;
            var totalVotersNeeded = room.ActiveVoteKick.TotalVotersNeeded;
            var majorityThreshold = (totalVotersNeeded / 2) + 1;
            var shouldKick = kickVotes >= majorityThreshold;

            var result = new VoteKickResult
            {
                TargetUsername = room.ActiveVoteKick.TargetUsername,
                TargetConnectionId = room.ActiveVoteKick.TargetConnectionId,
                ShouldKick = shouldKick,
                VotesToKick = kickVotes,
                VotesToKeep = keepVotes
            };

            // Clear the votekick
            room.ActiveVoteKick = null;
            await SaveRoomAsync(room);

            await RedisHelper.SafeExecuteAsync(
                () => _db.SetRemoveAsync(RedisKeys.ActiveVoteKicks, roomCode),
                _logger,
                $"UntrackActiveVoteKickInRoom:{roomCode}");

            _logger.LogInformation(
               "Votekick completed in room {RoomCode}: {Result} ({KickVotes}/{TotalVoters} kick, needed {Threshold})",
               roomCode,
               shouldKick ? "KICKED" : "KEPT",
               kickVotes,
               totalVotersNeeded,
               majorityThreshold);

            return (result, null);
        }

        return (null, null); // More votes needed
    }

    public async Task CancelVoteKickAsync(string roomCode)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("CancelVoteKick failed: Could not acquire lock for room {RoomCode}", roomCode);
            return;
        }

        var room = await GetRoomAsync(roomCode);
        if (room?.ActiveVoteKick is null)
        {
            return;
        }

        room.ActiveVoteKick = null;
        await SaveRoomAsync(room);

        await RedisHelper.SafeExecuteAsync(
            () => _db.SetRemoveAsync(RedisKeys.ActiveVoteKicks, roomCode),
            _logger,
            $"UntrackActiveVoteKickFromRoom:{roomCode}");

        _logger.LogInformation("Votekick cancelled in room {RoomCode}", roomCode);
    }

    public async Task<VoteKickResult?> TryExpireVoteKickAsync(string roomCode)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("TryExpireVoteKick: Could not acquire lock for room {RoomCode}", roomCode);
            return null;
        }

        var room = await GetRoomAsync(roomCode);
        if (room?.ActiveVoteKick is null)
        {
            // Already processed by CastVoteKickAsync or cancelled
            return null;
        }

        var elapsed = DateTime.UtcNow - room.ActiveVoteKick.StartedAt;
        if (elapsed.TotalSeconds < room.ActiveVoteKick.DurationSeconds)
        {
            return null;
        }

        // Timer expired - calculate result
        var kickVotes = room.ActiveVoteKick.VotesToKick.Count;
        var keepVotes = room.ActiveVoteKick.VotesToKeep.Count;
        var totalVotersNeeded = room.ActiveVoteKick.TotalVotersNeeded;
        var majorityThreshold = (totalVotersNeeded / 2) + 1;
        var shouldKick = kickVotes >= majorityThreshold;

        var result = new VoteKickResult
        {
            TargetUsername = room.ActiveVoteKick.TargetUsername,
            TargetConnectionId = room.ActiveVoteKick.TargetConnectionId,
            ShouldKick = shouldKick,
            VotesToKick = kickVotes,
            VotesToKeep = keepVotes
        };

        room.ActiveVoteKick = null;
        await SaveRoomAsync(room);

        await RedisHelper.SafeExecuteAsync(
            () => _db.SetRemoveAsync(RedisKeys.ActiveVoteKicks, roomCode),
            _logger,
            $"UntrackExpiredVoteKickFromRoom:{roomCode}");

        _logger.LogInformation(
            "Votekick expired in room {RoomCode}: {Result} ({KickVotes}/{TotalVoters} kick, needed {Threshold})",
            roomCode,
            shouldKick ? "KICKED" : "KEPT",
            kickVotes,
            totalVotersNeeded,
            majorityThreshold);

        return result;
    }
}
