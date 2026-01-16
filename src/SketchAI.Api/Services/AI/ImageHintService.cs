namespace SketchAI.Api.Services.AI;

public class ImageHintService : IImageHintService
{
    private readonly IDatabase _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ImageHintService> _logger;
    private const int ImageCount = 3;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);

    // Preset display names for better search context
    private static readonly Dictionary<string, string> PresetDisplayNames = new(StringComparer.OrdinalIgnoreCase)
    {
        { "lol-champions", "League of Legends champion" },
        { "valorant-agents", "VALORANT agent" },
        { "animals", "animal" },
        { "country-flags", "country flag" },
        { "food-and-drinks", "food" },
        { "sports", "sport" },
        { "professions", "profession job" },
        { "video-games", "video game" }
    };

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ImageHintService(
        IConnectionMultiplexer redis,
        IHttpClientFactory httpClientFactory,
        ILogger<ImageHintService> logger)
    {
        _db = redis.GetDatabase();
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<List<string>> GetImageHintsAsync(string word, string? preset = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(word))
        {
            _logger.LogWarning("GetImageHintsAsync called with empty word");
            throw new InvalidOperationException("Word cannot be empty");
        }

        var sanitizedWord = WordHelper.SanitizeWord(word);
        if (string.IsNullOrEmpty(sanitizedWord))
        {
            _logger.LogWarning("Word '{Word}' failed sanitization", word);
            throw new InvalidOperationException("Invalid word format");
        }

        var cacheKey = RedisKeys.ImageHints(sanitizedWord, preset);
        var cachedUrls = await RedisHelper.SafeExecuteAsync(
            () => _db.StringGetAsync(cacheKey),
            _logger,
            $"CheckCacheForImageHints:{cacheKey}",
            RedisValue.Null);

        if (cachedUrls.HasValue)
        {
            _logger.LogDebug("Cache hit for image hints: {Word}", sanitizedWord);
            var urls = JsonSerializer.Deserialize<List<string>>(cachedUrls.ToString(), JsonOptions);
            if (urls is not null && urls.Count > 0)
            {
                return urls;
            }
        }

        _logger.LogInformation("Fetching image hints for '{Word}' with preset '{Preset}'", sanitizedWord, preset);

        var searchQuery = BuildSearchQuery(sanitizedWord, preset);
        var imageUrls = await FetchImagesFromSerperAsync(searchQuery, ct);

        if (imageUrls.Count == 0 && !string.IsNullOrEmpty(preset))
        {
            _logger.LogDebug("No results with preset context, trying without for '{Word}'", sanitizedWord);
            imageUrls = await FetchImagesFromSerperAsync(sanitizedWord, ct);
        }

        if (imageUrls.Count == 0)
        {
            throw new InvalidOperationException($"No images found for '{word}'. Try drawing from memory!");
        }

        var json = JsonSerializer.Serialize(imageUrls, JsonOptions);
        await RedisHelper.SafeExecuteAsync(
            () => _db.StringSetAsync(cacheKey, json, CacheDuration),
            _logger,
            $"CacheImageHints:{cacheKey}",
            false);

        return imageUrls;
    }

    private string BuildSearchQuery(string word, string? preset)
    {
        if (string.IsNullOrEmpty(preset))
        {
            return word;
        }

        if (PresetDisplayNames.TryGetValue(preset, out var presetContext))
        {
            return $"{word} {presetContext}";
        }

        return word;
    }

    /// <summary>
    /// Fetches images from Serper API.
    /// Throws an exception if the API fails.
    /// </summary>
    private async Task<List<string>> FetchImagesFromSerperAsync(string query, CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("SerperClient");

        var requestBody = new
        {
            q = query,
        };

        HttpResponseMessage response;
        try
        {
            var jsonBody = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonBody, System.Text.Encoding.UTF8, "application/json");

            _logger.LogDebug("Sending Serper request: {Body}", jsonBody);

            response = await client.PostAsync("images", content, ct);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Network error while fetching images for query '{Query}'", query);
            throw new InvalidOperationException("Image search service is unavailable. Please try again later.");
        }
        catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
        {
            _logger.LogWarning("Timeout while fetching images for query '{Query}'", query);
            throw new InvalidOperationException("Image search timed out. Please try again.");
        }

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Serper API returned {StatusCode} for query '{Query}'. Response: {Response}",
                response.StatusCode, query, errorContent);
            throw new InvalidOperationException($"Image search failed (HTTP {(int)response.StatusCode}). Please try again later.");
        }

        SerperSearchResponse? result;
        try
        {
            result = await response.Content.ReadFromJsonAsync<SerperSearchResponse>(JsonOptions, ct);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Serper API response for query '{Query}'", query);
            throw new InvalidOperationException("Failed to parse image search results.");
        }

        if (result?.Images is null || result.Images.Count == 0)
        {
            _logger.LogDebug("No Serper results for query '{Query}'", query);
            return [];
        }

        return result.Images
            .Take(ImageCount)
            .Select(h => h.ImageUrl)
            .Where(url => !string.IsNullOrEmpty(url))
            .ToList();
    }

    // Serper API response models
    private record SerperSearchResponse(List<SerperImageHit>? Images);
    private record SerperImageHit(string ImageUrl);
}
