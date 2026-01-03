namespace SketchAI.Api.Exceptions;

/// <summary>
/// Exception thrown when a distributed lock cannot be acquired.
/// </summary>
public class LockAcquisitionException : Exception
{
    public string LockKey { get; }

    public LockAcquisitionException(string lockKey)
        : base($"Failed to acquire lock for key: {lockKey}")
    {
        LockKey = lockKey;
    }

    public LockAcquisitionException(string lockKey, string message)
        : base(message)
    {
        LockKey = lockKey;
    }

    public LockAcquisitionException(string lockKey, string message, Exception innerException)
        : base(message, innerException)
    {
        LockKey = lockKey;
    }
}
