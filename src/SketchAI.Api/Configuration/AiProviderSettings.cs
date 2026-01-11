namespace SketchAI.Api.Configuration;

public class AiProviderSettings
{
    public List<AiProviderConfig> Providers
    {
        get => field ?? [];
        set;
    } = [];

    public int FallbackCooldownMinutes { get; set; } = 60;
}
