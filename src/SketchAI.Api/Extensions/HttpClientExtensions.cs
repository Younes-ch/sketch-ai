namespace SketchAI.Api.Extensions;

public static class HttpClientExtensions
{
    /// <summary>
    /// Adds the Serper API client with standard resilience policies.
    /// </summary>
    public static IServiceCollection AddSerperClient(
        this IServiceCollection services,
        IConfiguration configuration,
        CircuitBreakerSettings circuitBreakerSettings)
    {
        services.AddHttpClient("SerperClient", client =>
        {
            var serperApiKey = configuration["SERPER_API_KEY"]
                ?? throw new InvalidOperationException("Serper API Key is not configured");

            client.BaseAddress = new Uri("https://google.serper.dev");
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            client.DefaultRequestHeaders.Add("X-API-KEY", serperApiKey);
        })
        .AddStandardResilienceHandler(options =>
        {
            ConfigureResilienceOptions(options, circuitBreakerSettings);
        });

        return services;
    }

    /// <summary>
    /// Configures standard resilience options from CircuitBreakerSettings.
    /// Can be reused for other HTTP clients requiring similar resilience policies.
    /// </summary>
    public static void ConfigureResilienceOptions(
        HttpStandardResilienceOptions options,
        CircuitBreakerSettings settings)
    {
        // Circuit breaker settings
        options.CircuitBreaker.FailureRatio = settings.FailureRatio;
        options.CircuitBreaker.MinimumThroughput = settings.MinimumThroughput;
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(settings.SamplingDurationSeconds);
        options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(settings.BreakDurationSeconds);

        // Timeout settings
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(settings.AttemptTimeoutSeconds);
        options.TotalRequestTimeout.Timeout = settings.CalculatedTotalTimeout;

        // Retry settings
        options.Retry.MaxRetryAttempts = settings.MaxRetryAttempts;
        options.Retry.Delay = TimeSpan.FromSeconds(settings.RetryDelaySeconds);
        options.Retry.BackoffType = settings.UseExponentialBackoff
            ? DelayBackoffType.Exponential
            : DelayBackoffType.Constant;
    }
}
