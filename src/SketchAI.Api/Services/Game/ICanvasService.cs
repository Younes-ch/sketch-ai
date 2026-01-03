namespace SketchAI.Api.Services.Game;

/// <summary>
/// Service for managing drawing canvas history in game rooms.
/// </summary>
public interface ICanvasService
{
    /// <summary>
    /// Adds a drawing command to the room's canvas history.
    /// </summary>
    /// <param name="roomCode">The room to add the command to.</param>
    /// <param name="command">The drawing command (stroke or clear).</param>
    Task AddDrawingCommandAsync(string roomCode, DrawingCommandDto command);

    /// <summary>
    /// Removes the last stroke command from history (for undo).
    /// Returns the removed command, or null if history is empty.
    /// </summary>
    Task<DrawingCommandDto?> UndoLastDrawCommandAsync(string roomCode);

    /// <summary>
    /// Retrieves all drawing commands for a room's canvas.
    /// Used to sync new players with the current canvas state.
    /// </summary>
    /// <param name="roomCode">The room to get history for.</param>
    /// <returns>List of drawing commands in chronological order.</returns>
    Task<List<DrawingCommandDto>> GetCanvasHistoryAsync(string roomCode);

    /// <summary>
    /// Clears the canvas by deleting all drawing history.
    /// Called when a player clicks the clear button.
    /// </summary>
    /// <param name="roomCode">The room to clear.</param>
    Task ClearCanvasAsync(string roomCode);

    /// <summary>
    /// Deletes canvas history when a room is deleted.
    /// </summary>
    /// <param name="roomCode">The room being deleted.</param>
    Task DeleteCanvasHistoryAsync(string roomCode);
}
