namespace SketchAI.Api.Services;

public class CanvasService : ICanvasService
{
    private readonly IDatabase _db;
    private readonly ILogger<CanvasService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public CanvasService(IConnectionMultiplexer redis, ILogger<CanvasService> logger)
    {
        _db = redis.GetDatabase();
        _logger = logger;
    }

    public async Task AddDrawingCommandAsync(string roomCode, DrawingCommandDto command)
    {
        var key = RedisKeys.CanvasHistory(roomCode);
        var serializedCommand = JsonSerializer.Serialize(command, JsonOptions);

        var newLength = await _db.ListRightPushAsync(key, serializedCommand);

        await _db.KeyExpireAsync(key, RedisKeys.CanvasExpiry);

        // Log periodically to avoid log spam (every 100 commands)
        if (newLength % 100 == 0)
        {
            _logger.LogDebug("Canvas history for room {RoomCode} reached {Count} commands",
                roomCode, newLength);
        }
    }

    public async Task<DrawingCommandDto?> UndoLastDrawCommandAsync(string roomCode)
    {
        var key = RedisKeys.CanvasHistory(roomCode);

        var lastCommandValue = await RedisHelper.SafeExecuteAsync(
            () => _db.ListRightPopAsync(key),
            _logger,
            $"UndoLastDrawCommand:{roomCode}",
            RedisValue.Null);

        if (lastCommandValue.IsNullOrEmpty)
            return null;

        var lastCommand = JsonSerializer.Deserialize<DrawingCommandDto>(lastCommandValue.ToString(), JsonOptions);
        if (lastCommand is null)
            return null;


        if (!string.IsNullOrEmpty(lastCommand.StrokeId))
        {
            var strokeIdToRemove = lastCommand.StrokeId;
            var removedCount = 1;

            while (true)
            {
                var peekValue = await _db.ListGetByIndexAsync(key, -1);
                if (peekValue.IsNullOrEmpty)
                    break;

                var peekCommand = JsonSerializer.Deserialize<DrawingCommandDto>(peekValue.ToString(), JsonOptions);
                if (peekCommand?.StrokeId != strokeIdToRemove)
                    break;

                await _db.ListRightPopAsync(key);
                removedCount++;
            }

            _logger.LogDebug("Undo: removed {Count} commands with strokeId {StrokeId} from room {RoomCode}",
                removedCount, strokeIdToRemove, roomCode);
        }
        else
        {
            _logger.LogDebug("Undo: removed last command (no strokeId) from room {RoomCode}", roomCode);
        }

        return lastCommand;
    }

    public async Task<List<DrawingCommandDto>> GetCanvasHistoryAsync(string roomCode)
    {
        var key = RedisKeys.CanvasHistory(roomCode);
        var historyValues = await RedisHelper.SafeExecuteAsync(
            () => _db.ListRangeAsync(key),
            _logger,
            $"GetCanvasHistory:{roomCode}",
            []) ?? [];

        if (historyValues.Length == 0)
        {
            return [];
        }

        var history = historyValues
            .Select(v => JsonSerializer.Deserialize<DrawingCommandDto>(v.ToString(), JsonOptions))
            .Where(cmd => cmd is not null)
            .Cast<DrawingCommandDto>()
            .ToList();

        _logger.LogDebug("Retrieved {Count} drawing commands for room {RoomCode}", history.Count, roomCode);
        return history;
    }

    public async Task ClearCanvasAsync(string roomCode)
    {
        var key = RedisKeys.CanvasHistory(roomCode);
        var success = await RedisHelper.SafeExecuteAsync(
            () => _db.KeyDeleteAsync(key),
            _logger,
            $"ClearCanvas:{roomCode}");

        if (success)
        {
            _logger.LogInformation("Canvas cleared for room {RoomCode}", roomCode);
        }
    }

    public async Task DeleteCanvasHistoryAsync(string roomCode)
    {
        // Same as ClearCanvasAsync, but different usage
        // ClearCanvasAsync = user action (clear button)
        // DeleteCanvasHistoryAsync = cleanup when room is deleted
        var key = RedisKeys.CanvasHistory(roomCode);
        var success = await RedisHelper.SafeExecuteAsync(
            () => _db.KeyDeleteAsync(key),
            _logger,
            $"DeleteCanvasHistory:{roomCode}");

        if (success)
        {
            _logger.LogDebug("Canvas history deleted for room {RoomCode}", roomCode);
        }
    }
}
