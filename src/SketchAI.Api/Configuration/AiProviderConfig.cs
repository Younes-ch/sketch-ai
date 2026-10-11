namespace SketchAI.Api.Configuration;

public class AiProviderConfig
{
    public required string Name { get; set; }
    public required string ServiceKey { get; set; }
    public required string Model { get; set; }

    /// <summary>
    /// Reasoning effort sent to the model; null leaves the provider default.
    /// gpt-oss supports Low/Medium/High, Qwen supports None to skip thinking.
    /// </summary>
    public ReasoningEffort? ReasoningEffort { get; set; }
    public int Priority { get; set; }
    public bool IsEnabled { get; set; }
}
