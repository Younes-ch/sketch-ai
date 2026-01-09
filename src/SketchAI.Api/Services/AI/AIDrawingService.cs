namespace SketchAI.Api.Services.AI;

public class AIDrawingService : IAIDrawingService
{
    private readonly IChatClient _chatClient;
    private readonly ILogger<AIDrawingService> _logger;

    public AIDrawingService(
        [FromKeyedServices("gpt-4o-mini")] IChatClient chatClient,
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
            _logger.LogWarning("Invalid word for AI drawing (sanitized to empty): '{Word}'", word);
            yield break;
        }

        // Use a shared queue captured by closure - avoids AsyncLocal thread isolation issues
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

        await foreach (var update in _chatClient.GetStreamingResponseAsync(messages, options, ct))
        {
            if (ct.IsCancellationRequested)
            {
                _logger.LogInformation("AI drawing cancelled for word '{Word}'", sanitizedWord);
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

    private static string BuildPrompt(string word) =>
        $$"""
         You are a drawing AI. Your ONLY task is to call drawing functions. Do NOT write any text responses.

         CANVAS: Normalized coordinates 0.0-1.0. (0,0)=top-left, (1,1)=bottom-right.

         WORD TO DRAW: "{{word}}"

         DRAWING TOOLS:
         - draw_stroke(points, color, width): Draw lines/shapes. Points is an array of {x, y} coordinates.
         - draw_fill(point, color): Flood-fill an enclosed area starting from a single point.

         INSTRUCTIONS:
         1. Draw a simple, recognizable representation of "{{word}}"
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
                StrokeId = Guid.NewGuid().ToString()
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
            StrokeId = Guid.NewGuid().ToString()
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
                StrokeId = Guid.NewGuid().ToString()
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
            StrokeId = Guid.NewGuid().ToString()
        };

        queue.Enqueue(command);

        return command;
    }
}
