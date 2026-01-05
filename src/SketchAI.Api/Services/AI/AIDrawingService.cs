using System.Runtime.CompilerServices;

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
        var messages = new List<ChatMessage> { new(ChatRole.User, prompt) };

        var options = new ChatOptions
        {
            Tools = [strokeTool, fillTool],
            ToolMode = ChatToolMode.RequireAny
        };

        var commandQueue = new ConcurrentQueue<DrawingCommandDto>();
        CommandQueue.Value = commandQueue;

        try
        {
            // Use streaming to get commands as they are generated
            await foreach (var update in _chatClient.GetStreamingResponseAsync(messages, options, ct))
            {
                // Check for cancellation
                if (ct.IsCancellationRequested)
                {
                    _logger.LogInformation("AI drawing cancelled for word '{Word}'", word);
                    yield break;
                }

                // Yield any commands that were captured during this streaming update
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
        $"""
         You are an AI that draws simple pictures by calling drawing functions.

         CANVAS: Coordinates are normalized 0.0-1.0. (0,0)=top-left, (1,1)=bottom-right.

         WORD TO DRAW: "{word}"

         INSTRUCTIONS:
         1. Draw a simple, recognizable representation of "{word}"
         2. Use DrawStroke for lines, shapes, and outlines (pass array of points)
         3. Use Fill for flood-filling enclosed areas with color (single start point)
         4. Use multiple colors - be creative but keep it simple
         5. Draw outlines first with DrawStroke, then use Fill to color enclosed areas
         6. Keep strokes smooth with 3-10 points per stroke
         7. Stay within bounds (0.0 to 1.0 for both x and y)

         SUGGESTED APPROACH:
         - Start with main outline strokes (black or dark color, width 5-10)
         - Add detail strokes (thinner, width 2-4)
         - Use Fill to color large enclosed areas (e.g., inside a circle or shape)

         Call the drawing functions now. Draw approximately 5-20 strokes/fills total.
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
        var command = new DrawingCommandDto
        {
            Type = "stroke",
            Points = [.. points],
            Color = color,
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
        var command = new DrawingCommandDto
        {
            Type = "fill",
            Points = [point],
            Color = color,
            Width = 0
        };

        CommandQueue.Value?.Enqueue(command);

        return command;
    }
}
