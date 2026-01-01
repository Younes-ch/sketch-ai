namespace SketchAI.Api.Services;

public class AIService : IAIService
{
    private readonly IChatClient _chatClient;
    private readonly ILogger<AIService> _logger;

    public AIService(IChatClient chatClient, ILogger<AIService> logger)
    {
        _chatClient = chatClient;
        _logger = logger;
    }

    public async Task<string> GetCompletionAsync(string prompt, ChatOptions? options, CancellationToken ct = default)
    {
        try
        {
            var message = new ChatMessage(ChatRole.User, prompt);
            var response = await _chatClient.GetResponseAsync(message, options, cancellationToken: ct);
            _logger.LogDebug("AI completion succeeded - Output tokens: {OutputTokenCount}", response?.Usage?.OutputTokenCount);
            return response?.Text ?? "";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while getting AI completion");
        }

        return "";
    }

    public async IAsyncEnumerable<string> StreamCompletionAsync(
        string prompt,
        ChatOptions? options,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var message = new ChatMessage(ChatRole.User, prompt);
        var response = _chatClient.GetStreamingResponseAsync(message, options, cancellationToken: ct);
        await foreach (var chunk in response)
        {
            if (ct.IsCancellationRequested) break;
            yield return chunk.Text;
        }
    }
}
