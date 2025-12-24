namespace SkribblAI.Api.Hubs.Filters;

public class RateLimitingHubFilter : IHubFilter
{
    private readonly ILogger<RateLimitingHubFilter> _logger;
    private static TimeProvider s_timeProvider = TimeProvider.System;

    // Store limiters per connection/IP address, keyed by "{connectionId|ipAddress}:{policy}"
    private static readonly ConcurrentDictionary<string, LimiterEntry> Limiters = new();

    private static readonly Dictionary<string, string> MethodPolicies = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SendDrawingCommand"] = "drawing",
        ["ClearCanvas"] = "drawing",
        ["SendGuess"] = "chat",
        ["CreateRoom"] = "roomCreation"
    };

    private static readonly HashSet<string> IpBasedPolicies = new(StringComparer.OrdinalIgnoreCase) { "roomCreation" };

    public static int ActiveLimiterCount => Limiters.Count;

    public RateLimitingHubFilter(ILogger<RateLimitingHubFilter> logger, TimeProvider timeProvider)
    {
        _logger = logger;
        s_timeProvider = timeProvider;
    }

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

        if (!MethodPolicies.TryGetValue(methodName, out var policy))
        {
            return await next(invocationContext);
        }

        var partitionKey = GetPartitionKey(invocationContext, policy);
        var limiterKey = $"{partitionKey}:{policy}";
        var entry = Limiters.GetOrAdd(limiterKey, _ => new LimiterEntry(CreateLimiter(policy), policy, s_timeProvider));
        entry.Touch(s_timeProvider);

        using var lease = await entry.Limiter.AcquireAsync(permitCount: 1);

        if (!lease.IsAcquired)
        {
            _logger.LogWarning(
                "Rate limit exceeded for {Method} by {PartitionType} {PartitionKey}",
                methodName,
                IpBasedPolicies.Contains(policy) ? "IP" : "connection",
                partitionKey);
            throw new HubException("Too many requests. Please slow down.");
        }

        return await next(invocationContext);
    }

    private static string GetPartitionKey(HubInvocationContext invocationContext, string policy)
    {
        if (IpBasedPolicies.Contains(policy))
        {
            var ipAddress = invocationContext.Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString();

            return !string.IsNullOrEmpty(ipAddress) ? ipAddress : "unknown";
        }

        return invocationContext.Context.ConnectionId;
    }

    private static RateLimiter CreateLimiter(string policy)
    {
        return policy switch
        {
            "drawing" => new SlidingWindowRateLimiter(new SlidingWindowRateLimiterOptions()
            {
                PermitLimit = 60,
                Window = TimeSpan.FromSeconds(1),
                SegmentsPerWindow = 6,
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
                PermitLimit = 2,
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
            if (Limiters.TryRemove(key, out var entry))
            {
                entry.Limiter.Dispose();
            }
        }
    }

    /// <summary>
    /// Cleans up IP-based limiters that have been idle for longer than the specified threshold.
    /// </summary>
    /// <param name="idleThreshold">The duration after which an idle limiter should be removed.</param>
    /// <returns>The number of limiters that were cleaned up.</returns>
    public static int CleanupStaleLimiters(TimeSpan idleThreshold)
    {
        var now = s_timeProvider.GetUtcNow();
        var cleanedUp = 0;

        var staleKeys = Limiters
            .Where(kvp => IpBasedPolicies.Contains(kvp.Value.Policy) && (now - kvp.Value.LastAccess) > idleThreshold)
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in staleKeys)
        {
            if (Limiters.TryRemove(key, out var entry))
            {
                entry.Limiter.Dispose();
                cleanedUp++;
            }
        }

        return cleanedUp;
    }
}
