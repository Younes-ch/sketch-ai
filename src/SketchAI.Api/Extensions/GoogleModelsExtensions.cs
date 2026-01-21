namespace SketchAI.Api.Extensions;

public static class GoogleModelsExtensions
{
    public static IServiceCollection AddGoogleModels(this IServiceCollection services, IConfiguration configuration)
    {
        var apiKey = configuration["GOOGLE_GEMINI_KEY"] ?? throw new InvalidOperationException("Gemini API key is not configured.");
        var aiProviderSettings = configuration.GetSection("AiProviders").Get<AiProviderSettings>();

        if (aiProviderSettings is not null)
        {
            foreach (var provider in aiProviderSettings.Providers)
            {
                if (!string.IsNullOrEmpty(provider.Name) && provider.Name.StartsWith("Google", StringComparison.OrdinalIgnoreCase))
                {
                    var options = new GeminiClientOptions
                    {
                        ApiKey = apiKey,
                        ModelId = provider.ServiceKey,
                    };

                    services.AddKeyedChatClient(provider.ServiceKey, new GeminiChatClient(options))
                                    .UseFunctionInvocation();
                }
            }
        }

        return services;
    }
}
