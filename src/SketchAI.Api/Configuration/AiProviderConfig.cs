namespace SketchAI.Api.Configuration;

public class AiProviderConfig
{
    public string Name { get; set; } = "Gemini";
    public string ServiceKey { get; set; } = "gemini-model";
    public int Priority { get; set; } = 1;
    public bool IsEnabled { get; set; } = true;
}
