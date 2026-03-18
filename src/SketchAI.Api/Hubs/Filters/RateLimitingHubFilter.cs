namespace SketchAI.Api.Hubs.Filters;

public class RateLimitingHubFilter : IHubFilter
{
    private readonly ILogger<RateLimitingHubFilter> _logger;
    private readonly TimeProvider _timeProvider;

    // Store limiters per connection/IP address, keyed by "{connectionId|ipAddress}:{policy}"
    private static readonly ConcurrentDictionary<string, Lazy<LimiterEntry>> Limiters = new();

    private static readonly Dictionary<string, RateLimitPolicyConfig> MethodPolicies = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SendDrawingCommand"] = new("drawing", 1),
        ["ClearCanvas"] = new("drawing", 1),
        ["SendGuess"] = new("chat", 2),
        ["CreateRoom"] = new("roomCreation", 60)
    };

    private static readonly HashSet<string> IpBasedPolicies = new(StringComparer.OrdinalIgnoreCase) { "roomCreation" };

    public static int ActiveLimiterCount => Limiters.Count;

    public RateLimitingHubFilter(ILogger<RateLimitingHubFilter> logger, TimeProvider timeProvider)
    {
        _logger = logger;
        _timeProvider = timeProvider;
    }

    /// <summary>
    /// Rate limit policy configuration with retry window.
    /// </summary>
    private sealed record RateLimitPolicyConfig(string Policy, int RetryAfterSeconds);

    /// <summary>
    /// Tracks a rate limiter with its last access time.
    /// </summary>
    private sealed class LimiterEntry
    {
        public RateLimiter Limiter { get; }
        public string Policy { get; }
        private long _lastAccessTicks;

        public DateTimeOffset LastAccess => new(_lastAccessTicks, TimeSpan.Zero);

        public LimiterEntry(RateLimiter limiter, string policy, TimeProvider timeProvider)
        {
            Limiter = limiter;
            Policy = policy;
            _lastAccessTicks = timeProvider.GetUtcNow().UtcTicks;
        }

        public void Touch(TimeProvider timeProvider)
        {
            Interlocked.Exchange(ref _lastAccessTicks, timeProvider.GetUtcNow().UtcTicks);
        }
    }

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        var methodName = invocationContext.HubMethodName;

        if (!MethodPolicies.TryGetValue(methodName, out var policyConfig))
        {
            return await next(invocationContext);
        }

        var partitionKey = GetPartitionKey(invocationContext, policyConfig.Policy);
        var limiterKey = $"{partitionKey}:{policyConfig.Policy}";
        var entry = Limiters.GetOrAdd(limiterKey, _ => new Lazy<LimiterEntry>(() => new LimiterEntry(CreateLimiter(policyConfig.Policy), policyConfig.Policy, _timeProvider))).Value;
        entry.Touch(_timeProvider);

        using var lease = await entry.Limiter.AcquireAsync(permitCount: 1);

        if (!lease.IsAcquired)
        {
            _logger.LogWarning(
                "Rate limit exceeded for {Method} by {PartitionType} {PartitionKey}",
                methodName,
                IpBasedPolicies.Contains(policyConfig.Policy) ? "IP" : "connection",
                partitionKey);

            var errorDto = new RateLimitErrorDto
            {
                Message = "Too many requests. Please slow down.",
                RetryAfterSeconds = policyConfig.RetryAfterSeconds
            };
            throw new HubException(JsonSerializer.Serialize(errorDto));
        }

        return await next(invocationContext);
    }

    private static string GetPartitionKey(HubInvocationContext invocationContext, string policy)
    {
        if (IpBasedPolicies.Contains(policy))
        {
            var httpContext = invocationContext.Context.GetHttpContext();
            if (httpContext is null)
            {
                return $"conn-{invocationContext.Context.ConnectionId}";
            }

            // After UseForwardedHeaders middleware, RemoteIpAddress contains the real client IP
            var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();

            return !string.IsNullOrEmpty(ipAddress) ? ipAddress : $"conn-{invocationContext.Context.ConnectionId}";
        }

        return invocationContext.Context.ConnectionId;
    }

    private static RateLimiter CreateLimiter(string policy)
    {
        return policy switch
        {
            "drawing" => new SlidingWindowRateLimiter(new SlidingWindowRateLimiterOptions()
            {
                PermitLimit = 100,
                Window = TimeSpan.FromSeconds(1),
                SegmentsPerWindow = 10,
                QueueLimit = 0
            }),

            "chat" => new FixedWindowRateLimiter(new FixedWindowRateLimiterOptions()
            {
                PermitLimit = 5,
                Window = TimeSpan.FromSeconds(1),
                QueueLimit = 0
            }),

            "roomCreation" => new FixedWindowRateLimiter(new FixedWindowRateLimiterOptions()
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }),

            _ => throw new ArgumentException($"Unknown rate limit policy: {policy}", nameof(policy))
        };
    }

    /// <summary>
    /// Cleans up limiters for a disconnected connection.
    /// </summary>
    public static void CleanupConnection(string connectionId)
    {
        var prefix = $"{connectionId}:";

        // Find all keys that belong to this connection
        var keysToRemove = Limiters.Keys
            .Where(key => key.StartsWith(prefix, StringComparison.Ordinal))
            .ToList();

        foreach (var key in keysToRemove)
        {
            if (Limiters.TryRemove(key, out var lazyEntry) && lazyEntry.IsValueCreated)
            {
                lazyEntry.Value.Limiter.Dispose();
            }
        }
    }

    /// <summary>
    /// Cleans up IP-based limiters that have been idle for longer than the specified threshold.
    /// </summary>
    /// <param name="idleThreshold">The duration after which an idle limiter should be removed.</param>
    /// <param name="timeProvider">The time provider to use for determining current time.</param>
    /// <returns>The number of limiters that were cleaned up.</returns>
    public static int CleanupStaleLimiters(TimeSpan idleThreshold, TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow();
        var cleanedUp = 0;

        foreach (var kvp in Limiters)
        {
            if (kvp.Value.IsValueCreated &&
                IpBasedPolicies.Contains(kvp.Value.Value.Policy) &&
                (now - kvp.Value.Value.LastAccess) > idleThreshold &&
                Limiters.TryRemove(kvp.Key, out var entry))
            {
                entry.Value.Limiter.Dispose();
                cleanedUp++;
            }
        }

        return cleanedUp;
    }
}
