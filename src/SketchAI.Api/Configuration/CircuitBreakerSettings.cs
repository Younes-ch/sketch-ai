namespace SketchAI.Api.Configuration;

/// <summary>
/// Configuration for circuit breaker and resilience policies on external HTTP clients.
/// </summary>
public class CircuitBreakerSettings
{
    // === Circuit Breaker Settings ===

    /// <summary>
    /// The failure ratio (0.0 to 1.0) that triggers the circuit to open.
    /// For example, 0.5 means 50% of requests must fail.
    /// </summary>
    public double FailureRatio { get; set; } = 0.5;

    /// <summary>
    /// Minimum number of requests during the sampling duration before the circuit breaker evaluates whether to open.
    /// The circuit won't open until at least this many requests have been made.
    /// </summary>
    public int MinimumThroughput { get; set; } = 3;

    /// <summary>
    /// Time window in seconds during which failure rates are calculated.
    /// </summary>
    public int SamplingDurationSeconds { get; set; } = 30;

    /// <summary>
    /// Duration in seconds that the circuit stays open before transitioning to half-open state.
    /// </summary>
    public int BreakDurationSeconds { get; set; } = 30;

    // === Timeout Settings ===

    /// <summary>
    /// Timeout in seconds for individual HTTP request attempts.
    /// </summary>
    public int AttemptTimeoutSeconds { get; set; } = 15;

    // === Retry Settings ===

    /// <summary>
    /// Maximum number of retry attempts after the initial request fails.
    /// Total attempts = 1 (initial) + MaxRetryAttempts.
    /// </summary>
    public int MaxRetryAttempts { get; set; } = 2;

    /// <summary>
    /// Initial delay in seconds between retry attempts.
    /// With exponential backoff, subsequent delays are multiplied (e.g., 1s, 2s, 4s).
    /// </summary>
    public double RetryDelaySeconds { get; set; } = 1.0;

    /// <summary>
    /// Whether to use exponential backoff for retries.
    /// If false, uses constant delay.
    /// </summary>
    public bool UseExponentialBackoff { get; set; } = true;

    /// <summary>
    /// Calculates the total request timeout that accounts for all retry attempts and backoff delays.
    /// Formula: (AttemptTimeout * TotalAttempts) + sum of backoff delays
    /// </summary>
    public TimeSpan CalculatedTotalTimeout
    {
        get
        {
            var totalAttempts = 1 + MaxRetryAttempts;
            var attemptTime = AttemptTimeoutSeconds * totalAttempts;

            // Calculate total backoff delay
            double totalBackoffDelay = 0;
            if (UseExponentialBackoff)
            {
                // Exponential: delay * (2^0 + 2^1 + ... + 2^(n-1)) for n retries
                for (var i = 0; i < MaxRetryAttempts; i++)
                {
                    totalBackoffDelay += RetryDelaySeconds * Math.Pow(2, i);
                }
            }
            else
            {
                totalBackoffDelay = RetryDelaySeconds * MaxRetryAttempts;
            }

            return TimeSpan.FromSeconds(attemptTime + totalBackoffDelay);
        }
    }
}
