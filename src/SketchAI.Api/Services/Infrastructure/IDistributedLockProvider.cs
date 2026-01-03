namespace SketchAI.Api.Services;

/// <summary>
/// Provides distributed locking functionality to prevent race conditions
/// in concurrent operations across multiple instances.
/// </summary>
public interface IDistributedLockProvider
{
    /// <summary>
    /// Attempts to acquire a distributed lock.
    /// </summary>
    /// <param name="lockKey">The unique key identifying the resource to lock.</param>
    /// <param name="expiry">The maximum time the lock can be held before auto-release.</param>
    /// <param name="retryDelay">Delay between retry attempts. Defaults to 50ms.</param>
    /// <param name="retryCount">Number of retry attempts. Defaults to 3.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A disposable lock handle if acquired, null if lock could not be obtained.</returns>
    Task<IAsyncDisposable?> TryAcquireLockAsync(
        string lockKey,
        TimeSpan expiry,
        TimeSpan? retryDelay = null,
        int retryCount = 3,
        CancellationToken ct = default);

    /// <summary>
    /// Acquires a distributed lock, throwing if it cannot be obtained.
    /// </summary>
    /// <param name="lockKey">The unique key identifying the resource to lock.</param>
    /// <param name="expiry">The maximum time the lock can be held before auto-release.</param>
    /// <param name="retryDelay">Delay between retry attempts. Defaults to 50ms.</param>
    /// <param name="retryCount">Number of retry attempts. Defaults to 3.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A disposable lock handle.</returns>
    /// <exception cref="LockAcquisitionException">Thrown when the lock cannot be acquired.</exception>
    Task<IAsyncDisposable> AcquireLockAsync(
        string lockKey,
        TimeSpan expiry,
        TimeSpan? retryDelay = null,
        int retryCount = 3,
        CancellationToken ct = default);
}