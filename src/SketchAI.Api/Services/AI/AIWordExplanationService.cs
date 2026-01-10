namespace SketchAI.Api.Services.AI;

public class AIWordExplanationService : IAIWordExplanationService
{
    private readonly IChatClient _chatClient;
    private readonly ILogger<AIWordExplanationService> _logger;

    public AIWordExplanationService(
        [FromKeyedServices("gpt-4o-mini")] IChatClient chatClient,
        ILogger<AIWordExplanationService> logger)
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
