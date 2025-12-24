namespace SkribblAI.Api.Configuration;

public class RateLimiterCleanupConfig
{
    public TimeSpan CleanupInterval { get; set; } = TimeSpan.FromMinutes(10);
    public TimeSpan IdleThreshold { get; set; } = TimeSpan.FromHours(1);
}