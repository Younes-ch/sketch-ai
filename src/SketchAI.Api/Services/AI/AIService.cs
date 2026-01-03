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
        var message = new ChatMessage(ChatRole.User, prompt);
        var response = await _chatClient.GetResponseAsync(message, options, cancellationToken: ct);
        _logger.LogDebug("AI completion succeeded - Output tokens: {OutputTokenCount}", response?.Usage?.OutputTokenCount);
        return response?.Text ?? "";
    }
}
