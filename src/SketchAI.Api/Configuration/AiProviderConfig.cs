namespace SketchAI.Api.Configuration;

public class AiProviderConfig
{
    public required string Name { get; set; }
    public required string ServiceKey { get; set; }
    public int Priority { get; set; }
    public bool IsEnabled { get; set; }
}
