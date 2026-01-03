namespace SketchAI.Api.Services;

/// <summary>
/// Background service that periodically cleans up stale IP-based rate limiters.
/// </summary>
public class RateLimiterCleanupService : BackgroundService
{
    private readonly ILogger<RateLimiterCleanupService> _logger;
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _cleanupInterval;
    private readonly TimeSpan _idleThreshold;

    public RateLimiterCleanupService(
        ILogger<RateLimiterCleanupService> logger,
        TimeProvider timeProvider,
        IOptions<RateLimiterCleanupConfig> options)
    {
        _logger = logger;
        _timeProvider = timeProvider;
        _cleanupInterval = options.Value.CleanupInterval;
        _idleThreshold = options.Value.IdleThreshold;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Rate limiter cleanup service started. Running every {Interval} minutes, cleaning limiters idle for >{IdleThreshold} hour(s)",
            _cleanupInterval.TotalMinutes,
            _idleThreshold.TotalHours);

        using var timer = new PeriodicTimer(_cleanupInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await timer.WaitForNextTickAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            try
            {
                var beforeCount = RateLimitingHubFilter.ActiveLimiterCount;
                var cleanedUp = RateLimitingHubFilter.CleanupStaleLimiters(_idleThreshold, _timeProvider);
                var afterCount = RateLimitingHubFilter.ActiveLimiterCount;

                if (cleanedUp > 0)
                {
                    _logger.LogInformation(
                        "Cleaned up {CleanedUp} stale IP-based rate limiters. Active limiters: {Before} -> {After}",
                        cleanedUp,
                        beforeCount,
                        afterCount);
                }
                else
                {
                    _logger.LogDebug(
                        "Rate limiter cleanup completed. No stale limiters found. Active limiters: {Count}",
                        afterCount);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during rate limiter cleanup");
            }
        }

        _logger.LogInformation("Rate limiter cleanup service stopped");
    }
}
