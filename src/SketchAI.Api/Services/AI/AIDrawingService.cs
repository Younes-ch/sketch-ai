namespace SketchAI.Api.Services.AI;

public class AIDrawingService : IAIDrawingService
{
    private readonly IChatClient _chatClient;
    private readonly ILogger<AIDrawingService> _logger;

    // Thread-local collection to capture drawing commands from function invocations
    private static readonly AsyncLocal<ConcurrentQueue<DrawingCommandDto>?> CommandQueue = new();

    public AIDrawingService(
        [FromKeyedServices("gemini-model")] IChatClient chatClient,
        ILogger<AIDrawingService> logger)
    {
        _chatClient = chatClient;
        _logger = logger;
    }

    public async IAsyncEnumerable<DrawingCommandDto> GenerateDrawingCommandAsync(
        string word,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var sanitizedWord = WordHelper.SanitizeWord(word);
        if (string.IsNullOrEmpty(sanitizedWord))
        {
            _logger.LogWarning("Invalid word for AI drawing: '{Word}'", word);
            yield break;
        }

        var strokeTool = AIFunctionFactory.Create(DrawStroke, name: "draw_stroke");
        var fillTool = AIFunctionFactory.Create(DrawFill, name: "draw_fill");

        var prompt = BuildPrompt(sanitizedWord);
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

        var commandQueue = new ConcurrentQueue<DrawingCommandDto>();
        CommandQueue.Value = commandQueue;

        try
        {
            await foreach (var update in _chatClient.GetStreamingResponseAsync(messages, options, ct))
            {
                // Check for cancellation
                if (ct.IsCancellationRequested)
                {
                    _logger.LogInformation("AI drawing cancelled for word '{Word}'", word);
                    yield break;
                }

                while (commandQueue.TryDequeue(out var command))
                {
                    yield return command;
                }
            }

            // Yield any remaining commands after streaming completes
            while (commandQueue.TryDequeue(out var command))
            {
                yield return command;
            }

            _logger.LogDebug("AI drawing completed for word '{Word}'", sanitizedWord);
        }
        finally
        {
            CommandQueue.Value = null;
        }
    }

    private static string BuildPrompt(string word) =>
        $$"""
         You are a drawing AI. Your ONLY task is to call drawing functions. Do NOT write any text responses.

         CANVAS: Normalized coordinates 0.0-1.0. (0,0)=top-left, (1,1)=bottom-right.

         WORD TO DRAW: "{{word}}"

         DRAWING TOOLS:
         - draw_stroke(points, color, width): Draw lines/shapes. Points is an array of {x, y} coordinates.
         - draw_fill(point, color): Flood-fill an enclosed area starting from a single point.

         REQUIREMENTS - YOU MUST FOLLOW THESE EXACTLY:
         1. Call draw_stroke AT LEAST 10-25 times to create a detailed drawing
         2. Each stroke should have 4-12 points for smooth curves
         3. Use varied line widths: 8-15 for outlines, 3-6 for details
         4. Use multiple colors - at least 3 different colors
         5. Draw complete outlines BEFORE using draw_fill
         6. All coordinates must be between 0.0 and 1.0

         DRAWING STRUCTURE (follow this order):
         Step 1: Draw the main shape outline with thick strokes (width 10-15, black or dark color)
         Step 2: Add internal details and features with medium strokes (width 5-8)
         Step 3: Add fine details, textures, patterns with thin strokes (width 2-4)
         Step 4: Use draw_fill to color enclosed areas (optional, 2-5 fills max)

         EXAMPLE STROKE DENSITY:
         - Simple object (apple, ball): 10-15 strokes
         - Medium complexity (house, tree): 15-20 strokes
         - Complex object (car, animal): 20-30 strokes

         CRITICAL RULES:
         - Do NOT output any text before, during, or after drawing
         - Do NOT explain what you are drawing
         - Do NOT summarize your actions
         - ONLY call the drawing functions, nothing else
         - Start immediately with draw_stroke calls

         BEGIN DRAWING NOW:
         """;

    [Description("Draw a stroke (line) on the canvas with the given points")]
    private static DrawingCommandDto DrawStroke(
        [Description(
            "Array of {x, y} coordinates. Values are normalized 0.0-1.0 where (0,0) is top-left and (1,1) is bottom-right")]
        PointDto[] points,
        [Description("Color in hex format, e.g., #FF0000 for red, #00FF00 for green")]
        string color,
        [Description("Line width in pixels, 1-50. Use 2-5 for fine details, 6-15 for normal lines, 16-50 for thick outlines")]
        int width)
    {
        var clampedPoints =
            points.Select(p => new PointDto { X = Math.Clamp(p.X, 0.0, 1.0), Y = Math.Clamp(p.Y, 0.0, 1.0) });

        var validColor = ValidationHelper.IsValidHexColor(color) ? color : "#000000";

        var command = new DrawingCommandDto
        {
            Type = "stroke",
            Points = [.. clampedPoints],
            Color = validColor,
            Width = Math.Clamp(width, 1, 50),
            StrokeId = Guid.NewGuid().ToString()
        };

        CommandQueue.Value?.Enqueue(command);

        return command;
    }

    [Description("Fill an area on the canvas starting from a point. Use for coloring large areas.")]
    private static DrawingCommandDto DrawFill(
        [Description(
            "The {x, y} point to start the fill from. Values are normalized 0.0-1.0 where (0,0) is top-left and (1,1) is bottom-right")]
        PointDto point,
        [Description("Fill color in hex format, e.g., #FF0000 for red")]
        string color)
    {
        var validColor = ValidationHelper.IsValidHexColor(color) ? color : "#000000";

        var clampedPoint = new PointDto { X = Math.Clamp(point.X, 0.0, 1.0), Y = Math.Clamp(point.Y, 0.0, 1.0) };

        var command = new DrawingCommandDto
        {
            Type = "fill",
            Points = [clampedPoint],
            Color = validColor,
            Width = 0
        };

        CommandQueue.Value?.Enqueue(command);

        return command;
    }
}
