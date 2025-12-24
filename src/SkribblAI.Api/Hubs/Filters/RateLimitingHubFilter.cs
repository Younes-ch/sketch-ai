using System.Collections.Concurrent;

namespace SkribblAI.Api.Hubs.Filters;

public class RateLimitingHubFilter : IHubFilter
{
    private readonly ILogger<RateLimitingHubFilter> _logger;

    // Store limiters per connection, keyed by "{connectionId}:{policy}"
    private static readonly ConcurrentDictionary<string, RateLimiter> Limiters = new();

    private static readonly Dictionary<string, string> MethodPolicies = new(StringComparer.OrdinalIgnoreCase)
    {
        ["SendDrawingCommand"] = "drawing",
        ["ClearCanvas"] = "drawing",
        ["SendGuess"] = "chat",
        ["CreateRoom"] = "roomCreation"
    };

    public RateLimitingHubFilter(ILogger<RateLimitingHubFilter> logger)
    {
        _logger = logger;
    }

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        var methodName = invocationContext.HubMethodName;
        var connectionId = invocationContext.Context.ConnectionId;

        if (!MethodPolicies.TryGetValue(methodName, out var policy))
        {
            return await next(invocationContext);
        }

        var limiterKey = $"{connectionId}:{policy}";
        var limiter = Limiters.GetOrAdd(limiterKey, _ => CreateLimiter(policy));

        using var lease = await limiter.AcquireAsync(permitCount: 1);

        if (!lease.IsAcquired)
        {
            _logger.LogWarning(
                "Rate limit exceeded for {Method} by connection {ConnectionId}",
                methodName, connectionId);
            throw new HubException("Too many requests. Please slow down.");
        }

        return await next(invocationContext);
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

            _ => new TokenBucketRateLimiter(new TokenBucketRateLimiterOptions()
            {
                TokenLimit = 10,
                ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                TokensPerPeriod = 10,
                QueueLimit = 0
            })
        };
    }

    /// <summary>
    /// Cleans up limiters for a disconnected connection.
    /// </summary>
    public static void CleanupConnection(string connectionId)
    {
        foreach (var policy in MethodPolicies.Values.Distinct())
        {
            var key = $"{connectionId}:{policy}";
            if (Limiters.TryRemove(key, out var limiter))
            {
                limiter.Dispose();
            }
        }
    }
}
