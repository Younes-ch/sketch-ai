namespace SkribblAI.Api.Hubs;

/// <summary>
/// SignalR hub for real-time drawing interactions.
/// </summary>
public class DrawingHub : Hub
{
    public async Task SendDrawingCommand(DrawingCommandDto command)
    {
        // TODO: For now, broadcast to all clients except sender. Later we'll add room-based broadcasting
        await Clients.Others.SendAsync("ReceiveDrawingCommand", command);
    }

    public async Task ClearCanvas()
    {
        await Clients.Others.SendAsync("ClearCanvas");
    }

    public override async Task OnConnectedAsync()
    {
        Console.WriteLine($"Client connected: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Console.WriteLine($"Client disconnected: {Context.ConnectionId}");
        await base.OnDisconnectedAsync(exception);
    }
}
