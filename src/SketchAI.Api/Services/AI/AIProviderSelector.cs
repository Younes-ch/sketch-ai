namespace SketchAI.Api.Services.AI;

public class AIProviderSelector : IAIProviderSelector
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IOptionsMonitor<AiProviderSettings> _aiProviderOptions;
    private readonly ILogger<AIProviderSelector> _logger;
    private readonly TimeProvider _timeProvider;

    private readonly ConcurrentDictionary<string, DateTime> _rateLimitedProviders = new();

    public AIProviderSelector(
        IServiceProvider serviceProvider,
        IOptionsMonitor<AiProviderSettings> aiProviderOptions,
        ILogger<AIProviderSelector> logger,
        TimeProvider timeProvider)
    {
        _serviceProvider = serviceProvider;
        _aiProviderOptions = aiProviderOptions;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    private IEnumerable<AiProviderConfig> GetSortedProviders()
    {
        var providers = _aiProviderOptions.CurrentValue.Providers;
        if (providers is null || providers.Count == 0)
        {
            _logger.LogWarning("No AI providers configured in AiProviders:Providers");
            return [];
        }
        return providers.OrderBy(p => p.Priority);
    }

    public (IChatClient? Client, string? ProviderServiceKey) GetAvailableProvider()
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;

        foreach (var provider in GetSortedProviders().Where(provider => provider.IsEnabled))
        {
            if (_rateLimitedProviders.TryGetValue(provider.ServiceKey, out var expiry))
            {
                if (now < expiry)
                {
                    _logger.LogDebug(
                        "Skipping provider {Name} ({ServiceKey}) - rate limited until {Expiry}",
                        provider.Name, provider.ServiceKey, expiry);
                    continue;
                }

                _rateLimitedProviders.TryRemove(provider.ServiceKey, out _);
                _logger.LogInformation(
                    "Rate limit cooldown expired for provider {Name} ({ServiceKey})",
                    provider.Name, provider.ServiceKey);
            }

            var chatClient = _serviceProvider.GetKeyedService<IChatClient>(provider.ServiceKey);

            if (chatClient is null)
            {
                _logger.LogWarning("Provider {Name} ({ServiceKey}) not registered in DI", provider.Name, provider.ServiceKey);
                continue;
            }

            _logger.LogDebug("Selected provider: {Name} ({ServiceKey})", provider.Name, provider.ServiceKey);
            return (chatClient, provider.ServiceKey);
        }

        _logger.LogError("All AI providers exhausted - no available providers");
        return (null, null);
    }

    public void MarkProviderRateLimited(string providerServiceKey)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var cooldownMinutes = _aiProviderOptions.CurrentValue.FallbackCooldownMinutes;
        var expiry = now.AddMinutes(cooldownMinutes);

        _rateLimitedProviders.AddOrUpdate(
            providerServiceKey,
            expiry,
            (_, existingExpiry) => (existingExpiry > now && existingExpiry > expiry) ? existingExpiry : expiry);

        _logger.LogWarning(
            "Provider {ProviderServiceKey} marked as rate limited until {Expiry} ({CooldownMinutes} minutes)",
            providerServiceKey, expiry, cooldownMinutes);
    }

    public IReadOnlyDictionary<string, ProviderStatus> GetProviderStatuses()
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var statuses = new Dictionary<string, ProviderStatus>();

        foreach (var provider in GetSortedProviders())
        {
            var isRateLimited = _rateLimitedProviders.TryGetValue(provider.ServiceKey, out var expiry) && now <= expiry;

            statuses[provider.ServiceKey] = new ProviderStatus(
                Name: provider.Name,
                ServiceKey: provider.ServiceKey,
                Priority: provider.Priority,
                IsEnabled: provider.IsEnabled,
                IsRateLimited: isRateLimited,
                RateLimitedUntil: isRateLimited ? expiry : null
            );
        }

        return statuses;
    }

    public void ResetProviderStatus(string providerServiceKey)
    {
        if (_rateLimitedProviders.TryRemove(providerServiceKey, out var expiry))
        {
            _logger.LogInformation(
                "Manually reset rate limit status for provider {ProviderServiceKey} (was limited until {Expiry})",
                providerServiceKey, expiry);
        }
        else
        {
            _logger.LogDebug(
                "Provider {ProviderServiceKey} was not rate limited, nothing to reset",
                providerServiceKey);
        }
    }

    public void ResetAllProviders()
    {
        var count = _rateLimitedProviders.Count;
        _rateLimitedProviders.Clear();
        _logger.LogInformation("Reset rate limit status for all providers ({Count} providers cleared)", count);
    }
}
