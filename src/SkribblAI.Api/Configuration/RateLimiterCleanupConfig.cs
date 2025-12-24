namespace SkribblAI.Api.Configuration;

public class RateLimiterCleanupConfig
{
    [Range(typeof(TimeSpan), "00:00:01", "1.00:00:00", ErrorMessage = "CleanupInterval must be between 1 second and 1 day")]
    public TimeSpan CleanupInterval { get; set; } = TimeSpan.FromMinutes(10);

    [Range(typeof(TimeSpan), "00:00:01", "7.00:00:00", ErrorMessage = "IdleThreshold must be between 1 second and 7 days")]
    public TimeSpan IdleThreshold { get; set; } = TimeSpan.FromHours(1);
}