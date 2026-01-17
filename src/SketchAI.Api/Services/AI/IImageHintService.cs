namespace SketchAI.Api.Services.AI;

public interface IImageHintService
{
    /// <summary>
    /// Gets image hints for a word to help the drawer visualize what to draw.
    /// </summary>
    /// <param name="word">The word to get image hints for.</param>
    /// <param name="preset">Optional preset category for context (e.g., "lol-champions", "animals").</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A list of image URLs.</returns>
    Task<List<string>> GetImageHintsAsync(string word, string? preset = null, CancellationToken ct = default);
}
