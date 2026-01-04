namespace SketchAI.Api.Services.AI;

public interface IAIDrawingCancellationManager
{
    CancellationTokenSource CreateSession(string roomCode);
    void CancelSession(string roomCode);
    CancellationToken? GetToken(string roomCode);
    bool IsDrawing(string roomCode);
}
