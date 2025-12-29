namespace SketchAI.Api.Dtos;

/// <summary>
/// Represents a point with normalized coordinates for canvas drawing.
/// Coordinates are normalized to a 0.0-1.0 range, independent of canvas resolution.
/// </summary>
public class PointDto
{
    /// <summary>
    /// X coordinate normalized to 0.0-1.0 range (0 = left edge, 1 = right edge).
    /// </summary>
    public double X { get; set; }

    /// <summary>
    /// Y coordinate normalized to 0.0-1.0 range (0 = top edge, 1 = bottom edge).
    /// </summary>
    public double Y { get; set; }
}
