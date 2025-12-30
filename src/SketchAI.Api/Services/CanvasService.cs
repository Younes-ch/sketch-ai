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

        var lastCommand = await _db.ListRightPopAsync(key);

        if (lastCommand.IsNullOrEmpty)
            return null;

        _logger.LogInformation("Undo: removed last command from room {RoomCode}", roomCode);
        return JsonSerializer.Deserialize<DrawingCommandDto>(lastCommand.ToString(), JsonOptions);
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
