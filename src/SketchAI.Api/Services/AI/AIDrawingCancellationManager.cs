namespace SketchAI.Api.Services.AI;

public sealed class AIDrawingCancellationManager : IAIDrawingCancellationManager, IDisposable
{
    private readonly Lock _lock = new();
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _sessions = new();
    private readonly ILogger<AIDrawingCancellationManager> _logger;
    private volatile bool _disposed;

    public AIDrawingCancellationManager(ILogger<AIDrawingCancellationManager> logger)
    {
        _logger = logger;
    }

    public CancellationToken CreateSession(string roomCode)
    {
        using (_lock.EnterScope())
        {
            if (_disposed)
            {
                throw new ObjectDisposedException(nameof(AIDrawingCancellationManager));
            }

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

            _logger.LogDebug("Created new AI drawing session for room {RoomCode}", roomCode);
            return cts.Token;
        }
    }

    public void CancelSession(string roomCode)
    {

        using (_lock.EnterScope())
        {

            if (_disposed)
            {
                throw new ObjectDisposedException(nameof(AIDrawingCancellationManager));
            }

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
    }

    public CancellationToken? GetToken(string roomCode)
    {
        using (_lock.EnterScope())
        {

            if (_disposed)
            {
                throw new ObjectDisposedException(nameof(AIDrawingCancellationManager));
            }

            if (!_sessions.TryGetValue(roomCode, out var cts))
            {
                return null;
            }

            try
            {
                return cts.Token;
            }
            catch (ObjectDisposedException)
            {
                return null;
            }
        }
    }

    public bool IsDrawing(string roomCode)
    {
        using (_lock.EnterScope())
        {

            if (_disposed)
            {
                throw new ObjectDisposedException(nameof(AIDrawingCancellationManager));
            }

            if (!_sessions.TryGetValue(roomCode, out var cts))
            {
                return false;
            }

            try
            {
                return !cts.IsCancellationRequested;
            }
            catch (ObjectDisposedException)
            {
                return false;
            }
        }
    }

    public void Dispose()
    {
        using (_lock.EnterScope())
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
}
