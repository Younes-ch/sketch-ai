namespace SketchAI.Api.Services.AI;

public class AIDrawingService : IAIDrawingService
{
    private readonly IAIProviderSelector _providerSelector;
    private readonly IOptionsMonitor<AiProviderSettings> _aiProviderOptions;
    private readonly ILogger<AIDrawingService> _logger;
    private static readonly TimeSpan DrawingTimeout = TimeSpan.FromSeconds(20);
    private const string ProvidersExhaustedMessage = "AI drawing is temporarily unavailable. Please try again later.";

    public AIDrawingService(
        IAIProviderSelector providerSelector,
        IOptionsMonitor<AiProviderSettings> aiProviderOptions,
        ILogger<AIDrawingService> logger)
    {
        _providerSelector = providerSelector;
        _aiProviderOptions = aiProviderOptions;
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

        var triedProviders = new HashSet<string>();
        var providers = _aiProviderOptions.CurrentValue.Providers;
        var maxRetries = providers?.Count ?? 0;

        if (maxRetries == 0)
        {
            _logger.LogError("No AI providers configured");
            throw new AIDrawingException(ProvidersExhaustedMessage);
        }

        var anyCommandsYielded = false;

        while (triedProviders.Count < maxRetries)
        {
            using var timeoutCts = new CancellationTokenSource(DrawingTimeout);
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct, timeoutCts.Token);
            var combinedCt = linkedCts.Token;

            var (chatClient, providerServiceKey) = _providerSelector.GetAvailableProvider();

            if (chatClient is null || providerServiceKey is null)
            {
                _logger.LogError("No AI providers available for drawing (tried {Count} providers)", triedProviders.Count);
                throw new AIDrawingException(ProvidersExhaustedMessage);
            }

            if (!triedProviders.Add(providerServiceKey))
            {
                _logger.LogWarning(
                    "Provider {ProviderServiceKey} returned again - selector cycling through same provider (all others exhausted or rate-limited)",
                    providerServiceKey);
                throw new AIDrawingException(ProvidersExhaustedMessage);
            }

            _logger.LogInformation("Starting AI drawing with provider: {ProviderServiceKey} (attempt {Attempt})",
                providerServiceKey, triedProviders.Count);

            var commandQueue = new ConcurrentQueue<DrawingCommandDto>();

            var strokeTool = AIFunctionFactory.Create(
                (
                    [Description(
                        "Array of {x, y} coordinates. Values are normalized 0.0-1.0 where (0,0) is top-left and (1,1) is bottom-right")]
                    PointDto[] points,
                    [Description("Color in hex format, e.g., #FF0000 for red, #00FF00 for green")]
                    string color,
                    [Description("Line width in pixels, 1-50. Use 2-5 for fine details, 6-15 for normal lines, 16-50 for thick outlines")]
                    int width) => DrawStroke(commandQueue, points, color, width),
                name: "draw_stroke",
                description: "Draw a stroke (line) on the canvas with the given points");

            var fillTool = AIFunctionFactory.Create(
                (
                    [Description("Starting point {x, y} for flood fill. Values are normalized 0.0-1.0 where (0,0) is top-left and (1,1) is bottom-right")]
                    PointDto point,
                    [Description("Color in hex format, e.g., #FF0000 for red, #00FF00 for green")]
                    string color) => DrawFill(commandQueue, point, color),
                name: "draw_fill",
                description: "Fill an area on the canvas starting from a point. Use for coloring large areas.");

            var prompt = BuildPrompt(sanitizedWord, preset);
            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, "You are a drawing function caller. Never output text. Only call draw_stroke and draw_fill functions."),
                new(ChatRole.User, prompt)
            };

            var options = new ChatOptions
            {
                Tools = [strokeTool, fillTool],
                ToolMode = ChatToolMode.RequireAny
            };

            var shouldRetryWithNextProvider = false;

            IAsyncEnumerator<ChatResponseUpdate>? enumerator = null;
            try
            {
                var streamingResponse = chatClient.GetStreamingResponseAsync(messages, options, combinedCt);
                enumerator = streamingResponse.GetAsyncEnumerator(combinedCt);
            }
            catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
            {
                _logger.LogWarning("AI drawing timed out during stream initialization for provider {ProviderServiceKey}", providerServiceKey);
                _providerSelector.MarkProviderRateLimited(providerServiceKey);
                shouldRetryWithNextProvider = true;
            }
            catch (Exception ex) when (IsRateLimitException(ex))
            {
                _logger.LogWarning(ex,
                    "Provider {ProviderServiceKey} hit rate limit during stream initialization, marking as unavailable and trying fallback",
                    providerServiceKey);

                _providerSelector.MarkProviderRateLimited(providerServiceKey);
                shouldRetryWithNextProvider = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "AI drawing stream initialization failed for word '{Word}' with provider {ProviderServiceKey}",
                    sanitizedWord, providerServiceKey);
                throw new AIDrawingException(ProvidersExhaustedMessage, ex);
            }

            if (shouldRetryWithNextProvider)
            {
                _logger.LogInformation("Retrying AI drawing with next available provider...");
                continue;
            }

            try
            {
                while (true)
                {
                    if (ct.IsCancellationRequested)
                    {
                        _logger.LogInformation("AI drawing cancelled for word '{Word}'", sanitizedWord);
                        yield break; // User-initiated cancellation is fine
                    }

                    if (timeoutCts.IsCancellationRequested)
                    {
                        _logger.LogWarning("AI drawing timed out for word '{Word}' with provider {ProviderServiceKey}",
                            sanitizedWord, providerServiceKey);
                        _providerSelector.MarkProviderRateLimited(providerServiceKey);
                        shouldRetryWithNextProvider = true;
                        break;
                    }

                    bool hasNext;
                    try
                    {
                        hasNext = await enumerator!.MoveNextAsync();
                    }
                    catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested)
                    {
                        _logger.LogWarning("AI drawing timed out during streaming for provider {ProviderServiceKey}", providerServiceKey);
                        _providerSelector.MarkProviderRateLimited(providerServiceKey);
                        shouldRetryWithNextProvider = true;
                        break;
                    }
                    catch (Exception ex) when (IsRateLimitException(ex))
                    {
                        _logger.LogWarning(ex,
                            "Provider {ProviderServiceKey} hit rate limit during AI drawing, marking as unavailable and trying fallback",
                            providerServiceKey);

                        _providerSelector.MarkProviderRateLimited(providerServiceKey);
                        shouldRetryWithNextProvider = true;
                        break; // Break inner loop to try next provider
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "AI drawing failed for word '{Word}' with provider {ProviderServiceKey}",
                            sanitizedWord, providerServiceKey);
                        throw new AIDrawingException(ProvidersExhaustedMessage, ex);
                    }

                    if (!hasNext)
                    {
                        break;
                    }

                    while (commandQueue.TryDequeue(out var command))
                    {
                        anyCommandsYielded = true;
                        timeoutCts.CancelAfter(DrawingTimeout); // Reset timeout on each yielded command
                        yield return command;
                    }
                }
            }
            finally
            {
                if (enumerator is not null)
                {
                    await enumerator.DisposeAsync();
                }
            }

            if (!shouldRetryWithNextProvider)
            {
                // Yield any remaining commands after streaming completes
                while (commandQueue.TryDequeue(out var command))
                {
                    anyCommandsYielded = true;
                    timeoutCts.CancelAfter(DrawingTimeout); // Reset timeout on each yielded command
                    yield return command;
                }

                if (!anyCommandsYielded)
                {
                    _logger.LogWarning(
                        "Provider {ProviderServiceKey} completed without yielding any commands - likely silent failure, trying fallback",
                        providerServiceKey);
                    _providerSelector.MarkProviderRateLimited(providerServiceKey);
                    continue; // Try next provider
                }

                _logger.LogDebug("AI drawing completed for word '{Word}' with provider {ProviderServiceKey}",
                    sanitizedWord, providerServiceKey);
                yield break;
            }

            _logger.LogInformation("Retrying AI drawing with next available provider...");
        }

        _logger.LogError("All AI providers exhausted after {MaxRetries} attempts for word '{Word}'",
            maxRetries, sanitizedWord);
        throw new AIDrawingException(ProvidersExhaustedMessage);
    }

    private static string BuildPrompt(string word, string? preset = null) =>
        $$"""
         You are a drawing AI. Your ONLY task is to call drawing functions. Do NOT write any text responses.

         CANVAS: Normalized coordinates 0.0-1.0. (0,0)=top-left, (1,1)=bottom-right.

         WORD TO DRAW: "{{word}}"
         {{(preset is not null ? $"CATEGORY: {preset}" : "")}}

         DRAWING TOOLS:
         - draw_stroke(points, color, width): Draw lines/shapes. Points is an array of {x, y} coordinates.
         - draw_fill(point, color): Flood-fill an enclosed area starting from a single point.

         INSTRUCTIONS:
         1. Draw a simple, recognizable representation of "{{word}}" {{(preset is not null ? $"from the category '{preset}'" : "")}}.
         2. Use draw_stroke for lines, shapes, and outlines (pass array of points)
         3. Use draw_fill for flood-filling enclosed areas with color (single start point)
         4. Use multiple colors - be creative but keep it simple
         5. Draw outlines first with draw_stroke, then use draw_fill to color enclosed areas
         6. Keep strokes smooth with 3-10 points per stroke
         7. Stay within bounds (0.0 to 1.0 for both x and y)

         SUGGESTED APPROACH:
         - Start with main outline strokes (black or dark color, width 5-10)
         - Add detail strokes (thinner, width 2-4)
         - Use Fill to color large enclosed areas (e.g., inside a circle or shape)

         CRITICAL RULES:
         - Do NOT output any text before, during, or after drawing
         - Do NOT explain what you are drawing
         - Do NOT summarize your actions
         - ONLY call the drawing functions, nothing else
         - Start immediately with draw_stroke calls

         BEGIN DRAWING NOW:
         """;

    private static DrawingCommandDto DrawStroke(
        ConcurrentQueue<DrawingCommandDto> queue,
        PointDto[] points,
        string color,
        int width)
    {

        if (points is null || points.Length == 0)
        {
            return new DrawingCommandDto
            {
                Type = "stroke",
                Points = [],
                Color = "#000000",
                Width = Math.Clamp(width, 1, 50),
                StrokeId = Guid.NewGuid().ToString(),
                IsAiGenerated = true
            };
        }

        var clampedPoints =
            points.Select(p => new PointDto { X = Math.Clamp(p.X, 0.0, 1.0), Y = Math.Clamp(p.Y, 0.0, 1.0) });

        var validColor = ValidationHelper.IsValidHexColor(color) ? color : "#000000";

        var command = new DrawingCommandDto
        {
            Type = "stroke",
            Points = [.. clampedPoints],
            Color = validColor,
            Width = Math.Clamp(width, 1, 50),
            StrokeId = Guid.NewGuid().ToString(),
            IsAiGenerated = true
        };

        queue.Enqueue(command);

        return command;
    }

    private static DrawingCommandDto DrawFill(
        ConcurrentQueue<DrawingCommandDto> queue,
        PointDto point,
        string color)
    {

        if (point is null)
        {
            return new DrawingCommandDto
            {
                Type = "fill",
                Points = [new PointDto { X = 0.5, Y = 0.5 }],
                Color = "#000000",
                Width = 0,
                StrokeId = Guid.NewGuid().ToString(),
                IsAiGenerated = true
            };
        }

        var validColor = ValidationHelper.IsValidHexColor(color) ? color : "#000000";

        var clampedPoint = new PointDto { X = Math.Clamp(point.X, 0.0, 1.0), Y = Math.Clamp(point.Y, 0.0, 1.0) };

        var command = new DrawingCommandDto
        {
            Type = "fill",
            Points = [clampedPoint],
            Color = validColor,
            Width = 0,
            StrokeId = Guid.NewGuid().ToString(),
            IsAiGenerated = true
        };

        queue.Enqueue(command);

        return command;
    }

    private bool IsRateLimitException(Exception ex)
    {
        if (ex is HttpRequestException { StatusCode: HttpStatusCode.TooManyRequests })
        {
            _logger.LogWarning("Rate limit detected via HttpRequestException (429)");
            return true;
        }

        var message = ex.Message;
        if (!string.IsNullOrEmpty(message))
        {
            if (message.Contains("429", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("rate limit", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("rate_limit", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("quota", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("too many requests", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("TooManyRequests", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Rate limit detected via exception message: {Message}", message);
                return true;
            }
        }

        if (ex.InnerException is not null)
        {
            return IsRateLimitException(ex.InnerException);
        }

        // Check aggregate exceptions (common in async scenarios)
        if (ex is AggregateException aggEx)
        {
            foreach (var innerEx in aggEx.InnerExceptions)
            {
                if (IsRateLimitException(innerEx))
                {
                    return true;
                }
            }
        }

        return false;
    }
}
