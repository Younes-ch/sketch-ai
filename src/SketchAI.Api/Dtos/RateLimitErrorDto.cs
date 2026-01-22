namespace SketchAI.Api.Dtos;

/// <summary>
/// DTO for rate limit error responses with retry information.
/// </summary>
public sealed record RateLimitErrorDto
{
    /// <summary>
    /// Error type identifier for client-side handling.
    /// </summary>
    public string Type { get; init; } = "RateLimit";

    /// <summary>
    /// Human-readable error message.
    /// </summary>
    public required string Message { get; init; }

    /// <summary>
    /// Number of seconds until the client can retry.
    /// </summary>
    public required int RetryAfterSeconds { get; init; }
}
