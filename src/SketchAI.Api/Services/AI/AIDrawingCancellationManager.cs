namespace SketchAI.Api.Services.AI;

public class AIDrawingCancellationManager : IAIDrawingCancellationManager
{
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _sessions = new();
    private readonly ILogger<AIDrawingCancellationManager> _logger;

    public AIDrawingCancellationManager(ILogger<AIDrawingCancellationManager> logger)
    {
        _logger = logger;
    }

    public CancellationToken CreateSession(string roomCode)
    {
        var cts = new CancellationTokenSource();

        _sessions.AddOrUpdate(roomCode, cts, (_, existing) =>
        {
            existing.Cancel();
            existing.Dispose();
            return cts;
        });

        _logger.LogDebug("Created AI drawing session for room {RoomCode}", roomCode);
        return cts.Token;
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
        if (!_sessions.TryGetValue(roomCode, out var cts))
        {
            return false;
        }

        return !cts.IsCancellationRequested;
    }
}
