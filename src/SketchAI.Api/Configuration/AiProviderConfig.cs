namespace SketchAI.Api.Configuration;

public enum AiProviderType
{
    /// <summary>
    /// Google Gemini models (requires GOOGLE_GEMINI_KEY).
    /// </summary>
    Google,

    /// <summary>
    /// OpenAI models (configured via Aspire OpenAI client).
    /// </summary>
    OpenAI
}

public class AiProviderConfig
{
    public required string Name { get; set; }
    public required string ServiceKey { get; set; }
    public AiProviderType ProviderType { get; set; }
    public int Priority { get; set; }
    public bool IsEnabled { get; set; }
}
