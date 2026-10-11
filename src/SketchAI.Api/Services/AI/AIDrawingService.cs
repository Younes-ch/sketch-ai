using System.ClientModel;
using System.Globalization;

namespace SketchAI.Api.Services.AI;

/// <summary>
/// Streams a drawing from a single model response. The model writes one compact command per line
/// (see <see cref="SystemPrompt"/>) and each line is yielded as soon as it is complete, so strokes
/// appear while the model is still generating. No tool calling: one request per drawing keeps
/// token usage (and free-tier rate limits) low.
/// </summary>
public class AIDrawingService : IAIDrawingService
{
    private const string ProvidersExhaustedMessage = "AI drawing is temporarily unavailable. Please try again later.";
    private const int MaxCommands = 30; // Hard stop so a chatty model can't keep "improving" the drawing.

    // The canvas is 16:9 (1920x1080), so the model draws on a 160x90 grid to keep proportions (round circles stay round).
    private const double GridWidth = 160;
    private const double GridHeight = 90;

    private const string SystemPrompt =
        """
        You draw pictures for a Pictionary-style guessing game by writing drawing commands.
        Output ONLY command lines, one per line. No other text, no markdown, no code fences.

        Canvas is 160 wide and 90 tall: (0,0) is top-left, (160,90) is bottom-right.

        Commands:
        S <color> <width> <x,y> <x,y> ...   stroke through the points (2-16 points)
        C <color> <width> <x,y> <r>         circle centered at x,y with radius r
        F <color> <x,y>                     flood-fill the closed area containing the point

        Example for "apple":
        C #000000 12 80,50 30
        F #e53935 80,50
        S #5d4037 10 80,20 83,8
        S #000000 8 83,14 98,6 104,12 92,18 83,14
        F #43a047 95,12

        Rules:
        - Draw the simplest, most iconic version of the word that anyone would guess instantly. A quick doodle, not art.
        - Exaggerate the 1-2 features that make it unmistakable (e.g. the handle of a mug, the wheels of a car, the ears and whiskers of a cat).
        - 3 to 12 commands in total: the main shape first, then the key details, then stop.
        - Make it big and centered: it should span most of the canvas height (about y=10 to y=80).
        - F works like a paint bucket: it colors everything connected to its point until it hits a line.
          Only fill inside a closed shape (a circle, or a stroke whose last point equals the first),
          and draw the lines that separate regions before filling them.
        - Outlines width 10-14, details width 6-8. Use only the colors the subject needs.
        - Never write letters, numbers or words.
        """;

    private readonly IAIProviderSelector _providerSelector;
    private readonly IOptionsMonitor<GameSettings> _gameSettings;
    private readonly ILogger<AIDrawingService> _logger;

    public AIDrawingService(
        IAIProviderSelector providerSelector,
        IOptionsMonitor<GameSettings> gameSettings,
        ILogger<AIDrawingService> logger)
    {
        _providerSelector = providerSelector;
        _gameSettings = gameSettings;
        _logger = logger;
    }

    public async IAsyncEnumerable<DrawingCommandDto> GenerateDrawingCommandAsync(
        string word,
        string? preset = null,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var sanitizedWord = WordHelper.SanitizeWord(word);
        if (string.IsNullOrEmpty(sanitizedWord))
        {
            _logger.LogWarning("Invalid word for AI drawing (sanitized to empty): '{Word}'", word);
            throw new AIDrawingException("Invalid word for AI drawing");
        }

        List<ChatMessage> messages =
        [
            new(ChatRole.System, SystemPrompt),
            new(ChatRole.User, preset is null ? $"Draw: \"{sanitizedWord}\"" : $"Draw: \"{sanitizedWord}\" (category: {preset})")
        ];

        var options = new ChatOptions { MaxOutputTokens = 2048 }; // Reasoning effort is set per provider (see Program.cs)

        var drawingTimeout = TimeSpan.FromSeconds(_gameSettings.CurrentValue.AiDrawingTimeoutSeconds);
        var triedProviders = new HashSet<string>();

        while (true)
        {
            var (chatClient, providerServiceKey) = _providerSelector.GetAvailableProvider();
            if (chatClient is null || providerServiceKey is null || !triedProviders.Add(providerServiceKey))
            {
                _logger.LogError("No AI providers available for drawing '{Word}' (tried {Count})", sanitizedWord, triedProviders.Count);
                throw new AIDrawingException(ProvidersExhaustedMessage);
            }

            _logger.LogInformation("Starting AI drawing for '{Word}' with provider {ProviderServiceKey}", sanitizedWord, providerServiceKey);

            using var timeoutCts = new CancellationTokenSource(drawingTimeout);
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);

            var pending = "";
            var closedShapes = new List<List<PointDto>>();
            var commandCount = 0;
            var startedTalking = false;
            Exception? failure = null;

            await using var stream = chatClient.GetStreamingResponseAsync(messages, options, linkedCts.Token)
                .GetAsyncEnumerator(linkedCts.Token);

            while (commandCount < MaxCommands)
            {
                bool hasNext;
                try
                {
                    hasNext = await stream.MoveNextAsync();
                }
                catch (Exception ex)
                {
                    failure = ex;
                    break;
                }

                // Yield every complete line; at end of stream, terminate the remainder so it's flushed too.
                pending += hasNext ? stream.Current.Text : "\n";
                int newline;
                while (commandCount < MaxCommands && (newline = pending.IndexOf('\n')) >= 0)
                {
                    var line = pending[..newline];
                    pending = pending[(newline + 1)..];

                    if (ParseCommand(line, closedShapes) is { } command)
                    {
                        commandCount++;
                        timeoutCts.CancelAfter(drawingTimeout); // Timeout is per-stroke, not for the whole drawing
                        yield return command;
                    }
                    else if (IsProse(line))
                    {
                        // The model is "thinking out loud": stop before its draft commands get drawn or burn the token quota.
                        startedTalking = true;
                        break;
                    }
                }

                if (!hasNext || startedTalking)
                {
                    break;
                }
            }

            if (ct.IsCancellationRequested)
            {
                _logger.LogInformation("AI drawing cancelled for word '{Word}'", sanitizedWord);
                yield break;
            }

            if (failure is null && commandCount > 0)
            {
                _logger.LogInformation("AI drawing for '{Word}' finished with {Count} commands via {ProviderServiceKey}",
                    sanitizedWord, commandCount, providerServiceKey);
                yield break;
            }

            if (failure is not null && !IsRateLimitOrTimeout(failure) && commandCount == 0)
            {
                _logger.LogError(failure, "AI drawing failed for word '{Word}' with provider {ProviderServiceKey}", sanitizedWord, providerServiceKey);
                throw new AIDrawingException(ProvidersExhaustedMessage, failure);
            }

            _providerSelector.MarkProviderRateLimited(providerServiceKey, GetRetryAfter(failure));

            if (commandCount > 0)
            {
                // ponytail: keep the partial drawing instead of starting a second one on top with another provider.
                _logger.LogWarning(failure, "AI drawing for '{Word}' stopped after {Count} commands via {ProviderServiceKey}",
                    sanitizedWord, commandCount, providerServiceKey);
                yield break;
            }

            _logger.LogWarning(failure, "Provider {ProviderServiceKey} produced no drawing for '{Word}' (wrote text: {StartedTalking}), trying next provider",
                providerServiceKey, sanitizedWord, startedTalking);
        }
    }

    /// <summary>
    /// Parses "S #rrggbb width x,y x,y ...", "C #rrggbb width x,y r" or "F #rrggbb x,y" (grid coordinates).
    /// Returns null for anything else, so stray text from the model is ignored.
    /// Closed shapes are collected in <paramref name="closedShapes"/>: a fill is only accepted inside one of them,
    /// because a flood fill on an open outline floods the whole canvas.
    /// </summary>
    private static DrawingCommandDto? ParseCommand(string line, List<List<PointDto>> closedShapes)
    {
        var parts = line.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 3 || !ValidationHelper.IsValidHexColor(parts[1]))
        {
            return null;
        }

        switch (parts[0].ToUpperInvariant())
        {
            case "S" when parts.Length >= 4 && int.TryParse(parts[2], CultureInfo.InvariantCulture, out var strokeWidth):
                var points = parts[3..].Select(ParsePoint).OfType<PointDto>().ToList();
                if (points.Count == 0)
                {
                    return null;
                }

                // Treat "ends within 3 grid units of its start" as closed, and snap it shut so the fill can't leak.
                if (points.Count >= 3 && Math.Abs(points[0].X - points[^1].X) * GridWidth <= 3 && Math.Abs(points[0].Y - points[^1].Y) * GridHeight <= 3)
                {
                    points[^1] = points[0];
                    closedShapes.Add(points);
                }

                return NewCommand("stroke", points, parts[1], Math.Clamp(strokeWidth, ValidationHelper.MinBrushWidth, ValidationHelper.MaxBrushWidth));

            case "C" when parts.Length >= 5
                          && int.TryParse(parts[2], CultureInfo.InvariantCulture, out var width)
                          && ParsePoint(parts[3]) is { } center
                          && double.TryParse(parts[4], NumberStyles.Float, CultureInfo.InvariantCulture, out var radius):
                // 24 segments, closed; radius scaled per axis so it stays round on the 16:9 canvas.
                var circle = Enumerable.Range(0, 25).Select(i => new PointDto(
                    Math.Clamp(center.X + radius / GridWidth * Math.Cos(i * Math.PI / 12), 0.0, 1.0),
                    Math.Clamp(center.Y + radius / GridHeight * Math.Sin(i * Math.PI / 12), 0.0, 1.0))).ToList();
                closedShapes.Add(circle);
                return NewCommand("stroke", circle, parts[1], Math.Clamp(width, ValidationHelper.MinBrushWidth, ValidationHelper.MaxBrushWidth));

            case "F" when ParsePoint(parts[2]) is { } point && closedShapes.Any(shape => Contains(shape, point)):
                return NewCommand("fill", [point], parts[1], 0);

            default:
                return null;
        }
    }

    private static PointDto? ParsePoint(string token)
    {
        var xy = token.Split(',');
        return xy.Length == 2
               && double.TryParse(xy[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var x)
               && double.TryParse(xy[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var y)
            ? new PointDto(Math.Clamp(x / GridWidth, 0.0, 1.0), Math.Clamp(y / GridHeight, 0.0, 1.0))
            : null;
    }

    /// <summary>
    /// A non-empty line that is neither a (possibly malformed) command nor a code fence: the model is writing text.
    /// </summary>
    private static bool IsProse(string line)
    {
        var trimmed = line.Trim();
        return trimmed.Length > 0 && !trimmed.StartsWith("```") && !Regex.IsMatch(trimmed, @"^[SCFscf]\s");
    }

    /// <summary>Ray-casting point-in-polygon test.</summary>
    private static bool Contains(List<PointDto> polygon, PointDto p)
    {
        var inside = false;
        for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++)
        {
            var (a, b) = (polygon[i], polygon[j]);
            if ((a.Y > p.Y) != (b.Y > p.Y) && p.X < (b.X - a.X) * (p.Y - a.Y) / (b.Y - a.Y) + a.X)
            {
                inside = !inside;
            }
        }

        return inside;
    }

    private static DrawingCommandDto NewCommand(string type, List<PointDto> points, string color, int width) => new()
    {
        Type = type,
        Points = points,
        Color = color,
        Width = width,
        StrokeId = Guid.NewGuid().ToString(),
        IsAiGenerated = true
    };

    private static bool IsRateLimitOrTimeout(Exception ex) =>
        ex is OperationCanceledException or ClientResultException { Status: 429 };

    /// <summary>Groq (and OpenAI) send retry-after in seconds on 429s; honor it instead of a fixed cooldown.</summary>
    private static TimeSpan? GetRetryAfter(Exception? ex) =>
        ex is ClientResultException cre
        && cre.GetRawResponse()?.Headers.TryGetValue("retry-after", out var value) == true
        && double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds)
            ? TimeSpan.FromSeconds(seconds)
            : null;
}
