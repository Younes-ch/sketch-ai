namespace SketchAI.Api.Services.AI;

public class WordExplanationService : IWordExplanationService
{
    private readonly IDatabase _db;
    private readonly IAIService _aiService;
    private readonly ILogger<WordExplanationService> _logger;

    // Allowed languages for translation - used for validation
    private static readonly HashSet<string> AllowedLanguages = new(StringComparer.OrdinalIgnoreCase)
    {
        "English", "French", "Spanish", "German", "Italian", "Portuguese",
        "Dutch", "Polish", "Russian", "Japanese", "Korean", "Chinese", "Arabic"
    };

    // Maximum allowed length for word input
    private const int MaxWordLength = 50;

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

        // Sanitize inputs against prompt injection
        var sanitizedWord = SanitizeWord(word);
        if (string.IsNullOrEmpty(sanitizedWord))
        {
            _logger.LogWarning("Word '{Word}' failed sanitization", word);
            return new WordExplanationDto(word, targetLanguage, "N/A", "Invalid word format");
        }

        if (!AllowedLanguages.Contains(targetLanguage))
        {
            _logger.LogWarning("Invalid target language requested: '{TargetLanguage}'", targetLanguage);
            return new WordExplanationDto(word, targetLanguage, "N/A", "Unsupported language");
        }

        var key = RedisKeys.WordExplanation(sanitizedWord, targetLanguage);
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

        _logger.LogInformation("Requesting word explanation for '{Word}' in {TargetLanguage}", sanitizedWord, targetLanguage);

        var prompt = $$"""
                       You are helping a {{targetLanguage}} speaker understand English words.

                       For the word "{{sanitizedWord}}", provide:
                       1. Translation to {{targetLanguage}} in only the number of words it needs.
                       2. A simple explanation in {{targetLanguage}} (1-2 sentences, easy to understand)

                       Respond ONLY with valid JSON in this exact format:
                       {"word": "{{sanitizedWord}}", "targetLanguage": "{{targetLanguage}}", "translation": "...", "simpleExplanation": "..."}
                       """;

        string responseJson;
        try
        {
            responseJson = await _aiService.GetCompletionAsync(prompt, ct: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI service failed while explaining word '{Word}'", sanitizedWord);
            return new WordExplanationDto(word, targetLanguage, "N/A", "Translation service unavailable");
        }

        try
        {
            _logger.LogDebug("Received AI response for word '{Word}': {Response}", sanitizedWord, responseJson);

            // Strip markdown code blocks if present
            responseJson = responseJson.Trim();
            if (responseJson.StartsWith("```"))
            {
                var startIndex = responseJson.IndexOf('\n', StringComparison.Ordinal) + 1;
                var endIndex = responseJson.LastIndexOf("```", StringComparison.Ordinal);
                if (startIndex > 0 && endIndex > startIndex)
                {
                    responseJson = responseJson[startIndex..endIndex].Trim();
                }
            }

            var response = JsonSerializer.Deserialize<WordExplanationDto>(responseJson, JsonOptions);

            if (response is null)
            {
                _logger.LogWarning("Failed to parse AI response for word '{Word}' - response was null after deserialization", sanitizedWord);
                return new WordExplanationDto(word, targetLanguage, "N/A", "Translation unavailable");
            }

            _logger.LogInformation("Successfully explained word '{Word}' - Translation: {Translation}", sanitizedWord, response.Translation);

            await RedisHelper.SafeExecuteAsync(
            () => _db.StringSetAsync(key, responseJson, RedisKeys.WordExplanationExpiry),
            _logger,
            $"CacheWordExplanation:{key}");

            _logger.LogDebug("Translation for word {Word} to {TargetLanguage} saved", word, targetLanguage);
            return response;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse AI response as JSON for word '{Word}'", sanitizedWord);
            return new WordExplanationDto(word, targetLanguage, "N/A", "Translation unavailable");
        }
    }

    /// <summary>
    /// Sanitizes word input by limiting length and removing potentially dangerous characters.
    /// </summary>
    private static string SanitizeWord(string word)
    {
        if (string.IsNullOrWhiteSpace(word))
            return string.Empty;

        var sanitized = word.Trim();
        if (sanitized.Length > MaxWordLength)
            sanitized = sanitized[..MaxWordLength];

        sanitized = new string(sanitized.Where(c =>
            char.IsLetterOrDigit(c) || c == ' ' || c == '-' || c == '\'').ToArray());

        return sanitized.Trim();
    }
}
