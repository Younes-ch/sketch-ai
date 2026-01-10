namespace SketchAI.Api.Services.AI;

public interface IAIDrawingService
{
    /// <summary>
    /// Generates drawing commands for the given word using AI function calling.
    /// Commands are yielded as they are generated for real-time streaming.
    /// </summary>
    /// <param name="word">The word to draw</param>
    /// <param name="ct">Cancellation token to stop generation</param>
    /// <returns>Async stream of drawing commands (stroke/fill)</returns>
    IAsyncEnumerable<DrawingCommandDto> GenerateDrawingCommandAsync(string word, CancellationToken ct = default);
}
