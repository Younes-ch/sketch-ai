namespace SketchAI.Api.Services.Infrastructure;

/// <summary>
/// Redis-based distributed lock provider using StackExchange.Redis LockTake/LockRelease.
/// </summary>
public class RedisDistributedLockProvider : IDistributedLockProvider
{
    private readonly IDatabase _db;
    private readonly ILogger<RedisDistributedLockProvider> _logger;

    private static readonly TimeSpan DefaultRetryDelay = TimeSpan.FromMilliseconds(50);

    public RedisDistributedLockProvider(
        IConnectionMultiplexer redis,
        ILogger<RedisDistributedLockProvider> logger)
    {
        _db = redis.GetDatabase();
        _logger = logger;
    }

    public async Task<IAsyncDisposable?> TryAcquireLockAsync(
        string lockKey,
        TimeSpan expiry,
        TimeSpan? retryDelay = null,
        int retryCount = 3,
        CancellationToken ct = default)
    {
        var lockValue = Guid.NewGuid().ToString();
        var delay = retryDelay ?? DefaultRetryDelay;

        for (var attempt = 0; attempt <= retryCount; attempt++)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                var acquired = await _db.LockTakeAsync(lockKey, lockValue, expiry);

                if (acquired)
                {
                    _logger.LogDebug("Lock acquired for {LockKey} (attempt {Attempt})", lockKey, attempt + 1);
                    return new RedisLockHandle(_db, lockKey, lockValue, _logger);
                }

                if (attempt < retryCount)
                {
                    _logger.LogDebug("Lock {LockKey} busy, retrying in {Delay}ms (attempt {Attempt}/{MaxAttempts})",
                        lockKey, delay.TotalMilliseconds, attempt + 1, retryCount + 1);
                    await Task.Delay(delay, ct);
                }
            }
            catch (RedisException ex)
            {
                _logger.LogWarning(ex, "Redis error while acquiring lock {LockKey}", lockKey);
                if (attempt == retryCount)
                    throw;

                await Task.Delay(delay, ct);
            }
        }

        _logger.LogWarning("Failed to acquire lock {LockKey} after {Attempts} attempts", lockKey, retryCount + 1);
        return null;
    }

    public async Task<IAsyncDisposable> AcquireLockAsync(
        string lockKey,
        TimeSpan expiry,
        TimeSpan? retryDelay = null,
        int retryCount = 3,
        CancellationToken ct = default)
    {
        var handle = await TryAcquireLockAsync(lockKey, expiry, retryDelay, retryCount, ct);

        return handle ?? throw new LockAcquisitionException(lockKey);
    }
}

/// <summary>
/// Handle representing an acquired distributed lock. Disposing releases the lock.
/// </summary>
internal sealed class RedisLockHandle : IAsyncDisposable
{
    private readonly IDatabase _db;
    private readonly string _lockKey;
    private readonly string _lockValue;
    private readonly ILogger _logger;
    private bool _disposed;

    public RedisLockHandle(IDatabase db, string lockKey, string lockValue, ILogger logger)
    {
        _db = db;
        _lockKey = lockKey;
        _lockValue = lockValue;
        _logger = logger;
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
            return;

        _disposed = true;

        try
        {
            var released = await _db.LockReleaseAsync(_lockKey, _lockValue);

            if (released)
            {
                _logger.LogDebug("Lock released for {LockKey}", _lockKey);
            }
            else
            {
                // This can happen if the lock expired before we released it
                _logger.LogWarning("Lock {LockKey} was not released (already expired or stolen)", _lockKey);
            }
        }
        catch (RedisException ex)
        {
            _logger.LogError(ex, "Failed to release lock {LockKey}", _lockKey);
        }
    }
}
