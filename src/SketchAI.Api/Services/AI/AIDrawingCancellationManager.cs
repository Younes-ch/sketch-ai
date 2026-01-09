namespace SketchAI.Api.Services.AI;

public class AIDrawingCancellationManager : IAIDrawingCancellationManager, IDisposable
{
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _sessions = new();
    private readonly ILogger<AIDrawingCancellationManager> _logger;
    private bool _disposed;

    public AIDrawingCancellationManager(ILogger<AIDrawingCancellationManager> logger)
    {
        _logger = logger;
    }

    public CancellationToken CreateSession(string roomCode)
    {
        var cts = new CancellationTokenSource();

        _sessions.AddOrUpdate(roomCode, cts, (_, existingCts) =>
        {
            try
            {
                existingCts.Cancel();
                existingCts.Dispose();
            }
            catch (ObjectDisposedException)
            {
                // Ignore if already disposed
            }

            _logger.LogDebug("Cancelled existing AI drawing session for room {RoomCode}", roomCode);
            return cts;
        });

        _logger.LogDebug("Created AI drawing session for room {RoomCode}", roomCode);
        return cts.Token;
    }

    public void CancelSession(string roomCode)
    {
        if (_sessions.TryRemove(roomCode, out var cts))
        {
            try
            {
                cts.Cancel();
                cts.Dispose();
                _logger.LogDebug("Cancelled AI drawing session for room {RoomCode}", roomCode);
            }
            catch (ObjectDisposedException)
            {
                // Ignore if already disposed
            }
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

    public void Dispose()
    {
        if (_disposed) return;

        foreach (var cts in _sessions.Values)
        {
            try
            {
                cts.Cancel();
                cts.Dispose();
            }
            catch (ObjectDisposedException)
            {
                // Ignore if already disposed
            }
        }

        _sessions.Clear();
        _disposed = true;
    }
}
