namespace SketchAI.Api.Services;

public class CanvasService : ICanvasService
{
    private readonly IDatabase _db;
    private readonly ILogger<CanvasService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private const string UndoStrokeLuaScript = @"
            local key = KEYS[1]
            local strokeId = ARGV[1]
            local removed = {}
            local count = 0

            while true do
                local value = redis.call('LINDEX', key, -1)
                if not value then
                    break
                end
                
                local command = cjson.decode(value)
                if command.strokeId ~= strokeId then
                    break
                end
                
                redis.call('RPOP', key)
                count = count + 1
            end

            return count
            ";

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

        DrawingCommandDto? lastCommand;
        try
        {
            lastCommand = JsonSerializer.Deserialize<DrawingCommandDto>(lastCommandValue.ToString(), JsonOptions);
            if (lastCommand is null)
                return null;

        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to deserialize drawing command during undo in room {RoomCode}", roomCode);
            return null;
        }


        if (!string.IsNullOrEmpty(lastCommand.StrokeId))
        {
            var strokeIdToRemove = lastCommand.StrokeId;
            var removedCount = await _db.ScriptEvaluateAsync(
                UndoStrokeLuaScript,
                [key],
                [strokeIdToRemove]);

            _logger.LogDebug("Undo: removed {Count} commands with strokeId {StrokeId} from room {RoomCode}",
                (int)removedCount + 1, strokeIdToRemove, roomCode);
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
