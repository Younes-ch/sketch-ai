namespace SketchAI.Api.Services;

public interface IAIService
{
    /// <summary>
    /// Sends a prompt to the AI and returns the complete response.
    /// </summary>
    Task<string> GetCompletionAsync(string prompt, ChatOptions? options = null, CancellationToken ct = default);
}
