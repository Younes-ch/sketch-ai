namespace SketchAI.Api.Exceptions;

/// <summary>
/// Exception thrown when AI drawing fails due to provider exhaustion, rate limits, or timeouts.
/// </summary>
public class AIDrawingException : Exception
{
    public AIDrawingException(string message) : base(message)
    {
    }

    public AIDrawingException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
