namespace SkribblAI.Api.Services;

public interface ICanvasService
{
    Task AddDrawingCommandAsync(string roomCode, DrawingCommandDto command);
    Task<List<DrawingCommandDto>> GetCanvasHistoryAsync(string roomCode);
    Task ClearCanvasAsync(string roomCode);
    Task DeleteCanvasHistoryAsync(string roomCode);
}
