namespace SketchAI.Api.Services;

public class WordExplanationService : IWordExplanationService
{
    private readonly IDatabase _db;
    private readonly IAIService _aiService;
    private readonly ILogger<WordExplanationService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public WordExplanationService(IConnectionMultiplexer redis, IAIService aiService, ILogger<WordExplanationService> logger)
    {
        _db = redis.GetDatabase();
        _aiService = aiService;
        _logger = logger;
    }


    public async Task<WordExplanationDto> ExplainWordAsync(string word, string targetLanguage, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(word))
        {
            _logger.LogWarning("ExplainWordAsync called with empty word");
            return new WordExplanationDto(word, targetLanguage, "N/A", "Invalid word provided");
        }

        if (string.IsNullOrWhiteSpace(targetLanguage))
        {
            _logger.LogWarning("ExplainWordAsync called with empty target language for word '{Word}'", word);
            return new WordExplanationDto(word, targetLanguage, "N/A", "Invalid language provided");
        }

        var key = RedisKeys.WordExplanation(word, targetLanguage);
        var wordExplanationJson = await RedisHelper.SafeExecuteAsync(
            () => _db.StringGetAsync(key),
            _logger,
            $"CheckCacheForWordExplanation:{key}",
            RedisValue.Null);

        if (wordExplanationJson.HasValue)
        {
            _logger.LogInformation("Cache hit for word '{Word}'", word);
            var wordExplanation = JsonSerializer.Deserialize<WordExplanationDto>(wordExplanationJson.ToString(), JsonOptions);
            if (wordExplanation is not null)
            {
                return wordExplanation;
            }
            _logger.LogWarning("Failed to deserialize cached word explanation for '{Word}', fetching fresh", word);
        }

        _logger.LogInformation("Requesting word explanation for '{Word}' in {TargetLanguage}", word, targetLanguage);

        var prompt = $$"""
                       You are helping a {{targetLanguage}} speaker understand English words.

                       For the word "{{word}}", provide:
                       1. Translation to {{targetLanguage}} in only the number of words it needs.
                       2. A simple explanation in {{targetLanguage}} (1-2 sentences, easy to understand)

                       Respond ONLY with valid JSON in this exact format:
                       {"word": "{{word}}", "targetLanguage": "{{targetLanguage}}", "translation": "...", "simpleExplanation": "..."}
                       """;

        try
        {
            var responseJson = await _aiService.GetCompletionAsync(prompt, ct: ct);
            _logger.LogDebug("Received AI response for word '{Word}': {Response}", word, responseJson);

            var response = JsonSerializer.Deserialize<WordExplanationDto>(responseJson, JsonOptions);

            if (response is null)
            {
                _logger.LogWarning("Failed to parse AI response for word '{Word}' - response was null after deserialization", word);
                return new WordExplanationDto(word, targetLanguage, "N/A", "Translation unavailable");
            }

            _logger.LogInformation("Successfully explained word '{Word}' - Translation: {Translation}", word, response.Translation);

            await RedisHelper.SafeExecuteAsync(
            () => _db.StringSetAsync(key, responseJson, RedisKeys.WordExplanationExpiry),
            _logger,
            $"CacheWordExplanation:{key}");

            _logger.LogDebug("Translation for word {Word} to {TargetLanguage} saved", word, targetLanguage);
            return response;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse AI response as JSON for word '{Word}'", word);
            return new WordExplanationDto(word, targetLanguage, "N/A", "Translation unavailable");
        }
    }
}
