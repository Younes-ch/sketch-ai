namespace SketchAI.Api.Extensions;

public static class GoogleModelsExtensions
{
    public static IServiceCollection AddGoogleModels(this IServiceCollection services, IConfiguration configuration)
    {
        var aiProviderSettings = configuration.GetSection("AiProviders").Get<AiProviderSettings>();
        var googleProviders = aiProviderSettings?.Providers
            .Where(p => p.ProviderType == AiProviderType.Google)
            .ToList();

        if (googleProviders is null || googleProviders.Count == 0)
        {
            return services;
        }

        var apiKey = configuration["GOOGLE_GEMINI_KEY"]
            ?? throw new InvalidOperationException("Gemini API key is not configured but Google providers are defined.");

        foreach (var provider in googleProviders)
        {
            var options = new GeminiClientOptions
            {
                ApiKey = apiKey,
                ModelId = provider.ServiceKey,
            };

            services.AddKeyedChatClient(provider.ServiceKey, new GeminiChatClient(options))
                    .UseFunctionInvocation();
        }

        return services;
    }
}
