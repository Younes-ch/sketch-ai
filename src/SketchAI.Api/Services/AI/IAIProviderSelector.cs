namespace SketchAI.Api.Services.AI;

public interface IAIProviderSelector
{
    /// <summary>
    /// Gets the next available chat client based on priority and rate limit status.
    /// </summary>
    /// <returns>Tuple of (IChatClient, providerName) or (null, null) if all providers are exhausted</returns>
    (IChatClient? Client, string? ProviderServiceKey) GetAvailableProvider();

    /// <summary>
    /// Marks a provider as rate-limited. It will be skipped until the cooldown expires.
    /// </summary>
    /// <param name="providerServiceKey">The service key of the rate-limited provider</param>
    /// <param name="cooldown">How long to skip the provider (e.g. the 429 retry-after); defaults to FallbackCooldownMinutes</param>
    void MarkProviderRateLimited(string providerServiceKey, TimeSpan? cooldown = null);

    /// <summary>
    /// Gets the current status of all providers (for debugging/monitoring).
    /// </summary>
    IReadOnlyDictionary<string, ProviderStatus> GetProviderStatuses();

    /// <summary>
    /// Manually resets a provider's rate limit status (e.g., when a new day starts).
    /// </summary>
    void ResetProviderStatus(string providerServiceKey);

    /// <summary>
    /// Resets all providers' rate limit statuses.
    /// </summary>
    void ResetAllProviders();
}
