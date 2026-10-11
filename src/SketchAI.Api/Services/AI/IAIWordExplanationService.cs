namespace SketchAI.Api.Services.AI;

public interface IAIWordExplanationService
{
    /// <summary>
    /// Sends a prompt to the AI and returns the complete response.
    /// </summary>
    Task<string> GetCompletionAsync(string prompt, CancellationToken ct = default);
}
