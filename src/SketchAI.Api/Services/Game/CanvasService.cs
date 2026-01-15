namespace SketchAI.Api.Services.Game;

public class CanvasService : ICanvasService
{
    private readonly IDatabase _db;
    private readonly ILogger<CanvasService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>
    /// Atomic undo script that handles both regular strokes and AI-generated commands.
    /// 
    /// Logic:
    /// 1. Pop the last command from the list
    /// 2. If the last command is AI-generated, remove ALL AI-generated commands from the entire list
    /// 3. If the last command is NOT AI-generated, remove all consecutive commands from the tail 
    ///    that share the same strokeId (LIFO behavior for multi-segment strokes)
    /// 
    /// Returns: JSON object with removedCount and wasAiGenerated flag
    /// </summary>
    private const string AtomicUndoLuaScript = """
        local key = KEYS[1]
        local count = 0
        
        -- Pop the last command
        local lastValue = redis.call('RPOP', key)
        if not lastValue then
            return cjson.encode({ removedCount = 0, wasAiGenerated = false })
        end
        
        local ok, lastCommand = pcall(cjson.decode, lastValue)
        if not ok then
            return cjson.encode({ removedCount = 1, wasAiGenerated = false })
        end
        
        count = 1
        local wasAiGenerated = lastCommand.isAiGenerated == true
        
        if wasAiGenerated then
            -- Remove ALL AI-generated commands from the list
            local len = redis.call('LLEN', key)
            local i = 0
            
            while i < len do
                local value = redis.call('LINDEX', key, i)
                if value then
                    local parseOk, command = pcall(cjson.decode, value)
                    if parseOk and command.isAiGenerated == true then
                        redis.call('LSET', key, i, '__DELETED__')
                        count = count + 1
                    end
                end
                i = i + 1
            end
            
            redis.call('LREM', key, 0, '__DELETED__')
        else
            -- Remove consecutive commands with the same strokeId from the tail
            local strokeId = lastCommand.strokeId
            if strokeId then
                while true do
                    local value = redis.call('LINDEX', key, -1)
                    if not value then
                        break
                    end
                    
                    local parseOk, command = pcall(cjson.decode, value)
                    if not parseOk or command.strokeId ~= strokeId then
                        break
                    end
                    
                    redis.call('RPOP', key)
                    count = count + 1
                end
            end
        end
        
        return cjson.encode({ removedCount = count, wasAiGenerated = wasAiGenerated })
        """;

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

    public async Task<(int RemovedCount, bool WasAiGenerated)> UndoLastDrawCommandAsync(string roomCode)
    {
        var key = RedisKeys.CanvasHistory(roomCode);

        var result = await RedisHelper.SafeExecuteAsync(
            () => _db.ScriptEvaluateAsync(AtomicUndoLuaScript, [key]),
            _logger,
            $"AtomicUndo:{roomCode}",
            RedisResult.Create("{\"removedCount\":0,\"wasAiGenerated\":false}", ResultType.BulkString));

        if (result is null || result.IsNull)
            return (0, false);

        try
        {
            var resultJson = result.ToString();
            using var doc = JsonDocument.Parse(resultJson);
            var removedCount = doc.RootElement.GetProperty("removedCount").GetInt32();
            var wasAiGenerated = doc.RootElement.GetProperty("wasAiGenerated").GetBoolean();

            _logger.LogDebug("Undo: removed {Count} commands (AI: {WasAi}) from room {RoomCode}",
                removedCount, wasAiGenerated, roomCode);

            return (removedCount, wasAiGenerated);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse undo result in room {RoomCode}", roomCode);
            return (0, false);
        }
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

        var malformedCount = 0;
        var history = historyValues
            .Select(v =>
            {
                try
                {
                    return JsonSerializer.Deserialize<DrawingCommandDto>(v.ToString(), JsonOptions);
                }
                catch (JsonException)
                {
                    malformedCount++;
                    return null;
                }
            })
            .Where(cmd => cmd is not null)
            .Cast<DrawingCommandDto>()
            .ToList();

        if (malformedCount > 0)
        {
            _logger.LogWarning("Skipping {MalformedCount} malformed drawing commands in room history for {RoomCode}",
                malformedCount, roomCode);
        }

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
