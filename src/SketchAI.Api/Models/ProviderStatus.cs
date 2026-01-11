namespace SketchAI.Api.Models;

public record ProviderStatus(
    string Name,
    string ServiceKey,
    int Priority,
    bool IsEnabled,
    bool IsRateLimited,
    DateTime? RateLimitedUntil
);
