namespace SketchAI.Api.Helpers;

/// <summary>
/// Provides safe wrappers for Redis operations with graceful error handling.
/// </summary>
public static class RedisHelper
{
    /// <summary>
    /// Executes a Redis operation safely, returning a fallback value on failure.
    /// </summary>
    /// <typeparam name="T">The return type of the operation.</typeparam>
    /// <param name="operation">The Redis operation to execute.</param>
    /// <param name="logger">Logger for error reporting.</param>
    /// <param name="operationName">Name of the operation for logging context.</param>
    /// <param name="fallback">Value to return if the operation fails.</param>
    /// <returns>The result of the operation, or the fallback value on failure.</returns>
    public static async Task<T?> SafeExecuteAsync<T>(
        Func<Task<T>> operation,
        ILogger logger,
        string operationName,
        T? fallback = default)
    {
        try
        {
            return await operation();
        }
        catch (RedisException ex)
        {
            logger.LogError(ex, "Redis operation '{OperationName}' failed", operationName);
            return fallback;
        }
        catch (TimeoutException ex)
        {
            logger.LogError(ex, "Redis operation '{OperationName}' timed out", operationName);
            return fallback;
        }
    }

    /// <summary>
    /// Executes a Redis operation safely without a return value.
    /// </summary>
    /// <param name="operation">The Redis operation to execute.</param>
    /// <param name="logger">Logger for error reporting.</param>
    /// <param name="operationName">Name of the operation for logging context.</param>
    /// <returns>True if the operation succeeded, false otherwise.</returns>
    public static async Task<bool> SafeExecuteAsync(
        Func<Task> operation,
        ILogger logger,
        string operationName)
    {
        try
        {
            await operation();
            return true;
        }
        catch (RedisException ex)
        {
            logger.LogError(ex, "Redis operation '{OperationName}' failed", operationName);
            return false;
        }
        catch (TimeoutException ex)
        {
            logger.LogError(ex, "Redis operation '{OperationName}' timed out", operationName);
            return false;
        }
    }
}
