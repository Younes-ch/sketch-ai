namespace SketchAI.Api.Dtos;

public class DrawingCommandDto
{
    public string Type { get; set; } = string.Empty; // "stroke", "line", "clear"
    public List<PointDto> Points { get; set; } = [];
    public string Color { get; set; } = "#000000";
    public int Width { get; set; } = 2;
}
