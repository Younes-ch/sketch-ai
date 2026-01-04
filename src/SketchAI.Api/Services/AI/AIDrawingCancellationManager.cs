namespace SketchAI.Api.Services.AI;

public class AIDrawingCancellationManager : IAIDrawingCancellationManager
{
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _sessions = new();
    private readonly ILogger<AIDrawingCancellationManager> _logger;

    public AIDrawingCancellationManager(ILogger<AIDrawingCancellationManager> logger)
    {
        _logger = logger;
    }

    public CancellationTokenSource CreateSession(string roomCode)
    {
        // Cancel any existing session first
        CancelSession(roomCode);

        var cts = new CancellationTokenSource();
        _sessions[roomCode] = cts;
        _logger.LogDebug("Created AI drawing session for room {RoomCode}", roomCode);
        return cts;
    }

    public void CancelSession(string roomCode)
    {
        if (_sessions.TryRemove(roomCode, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
            _logger.LogDebug("Cancelled AI drawing session for room {RoomCode}", roomCode);
        }
    }

    public CancellationToken? GetToken(string roomCode)
    {
        return _sessions.TryGetValue(roomCode, out var cts) ? cts.Token : null;
    }

    public bool IsDrawing(string roomCode)
    {
        return _sessions.ContainsKey(roomCode);
    }
}
