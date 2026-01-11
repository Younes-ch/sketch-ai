namespace SketchAI.Api.Configuration;

public class AiProviderSettings
{
    public List<AiProviderConfig> Providers { get; set; } = [];
    public int FallbackCooldownMinutes { get; set; } = 60;
}
