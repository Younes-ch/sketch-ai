namespace SkribblAI.Api.Hubs;

/// <summary>
/// SignalR hub for real-time drawing interactions.
/// </summary>
public class DrawingHub : Hub
{
    private readonly IRoomService _roomService;
    private readonly ICanvasService _canvasService;
    private readonly ILogger<DrawingHub> _logger;


    public DrawingHub(IRoomService roomService, ICanvasService canvasService, ILogger<DrawingHub> logger)
    {
        _roomService = roomService;
        _canvasService = canvasService;
        _logger = logger;
    }

    /// <summary>
    /// Creates a new room and joins the creator as host.
    /// </summary>
    public async Task CreateRoom(string username, string roomCode, bool isPublic = true)
    {
        if (!ValidationHelper.IsValidUsername(username))
        {
            throw new HubException("Invalid username. Use 1-20 alphanumeric characters, spaces, or underscores.");
        }

        if (!ValidationHelper.IsValidRoomCode(roomCode))
        {
            throw new HubException("Invalid room code. Must be 6 alphanumeric characters.");
        }

        // Check if room already exists
        if (await _roomService.RoomExistsAsync(roomCode))
        {
            throw new HubException("Room already exists. Try a different code.");
        }

        var room = await _roomService.CreateRoomAsync(roomCode, isPublic, Context.ConnectionId, username);

        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        var players = room.Players.Select(ToPlayerDto).ToList();
        await Clients.Caller.SendAsync("RoomCreated", roomCode, players);
    }

    /// <summary>
    /// Joins an existing room.
    /// </summary>
    public async Task JoinRoom(string username, string roomCode)
    {
        if (!ValidationHelper.IsValidUsername(username))
        {
            throw new HubException("Invalid username. Use 1-20 alphanumeric characters, spaces, or underscores.");
        }

        if (!ValidationHelper.IsValidRoomCode(roomCode))
        {
            throw new HubException("Invalid room code. Must be 6 alphanumeric characters.");
        }

        var room = await _roomService.GetRoomAsync(roomCode);
        if (room is null)
        {
            _logger.LogWarning("Player {Username} tried to join non-existent room {RoomCode}", username, roomCode);
            throw new HubException("Room not found");
        }

        var existingPlayer = room.Players.FirstOrDefault(p => p.Username == username);
        if (existingPlayer == null && room.Players.Count >= room.MaxPlayers)
        {
            throw new HubException("Room is full");
        }

        var player = await _roomService.AddPlayerToRoomAsync(roomCode, Context.ConnectionId, username);
        if (player is null)
        {
            throw new HubException("Failed to join room");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        room.Players.Add(player);
        var players = room!.Players.Select(ToPlayerDto).ToList();

        await Clients.Caller.SendAsync("RoomJoined", roomCode, players);

        await Clients.OthersInGroup(roomCode).SendAsync("PlayerJoined", ToPlayerDto(player));
        _logger.LogInformation("Player {Username} joined room {RoomCode}. Total players: {PlayerCount}",
            username, roomCode, players.Count);

        var history = await _canvasService.GetCanvasHistoryAsync(roomCode);
        if (history.Count > 0)
        {
            await Clients.Caller.SendAsync("ReceiveCanvasHistory", history);
            _logger.LogDebug("Sent {Count} drawing commands to {Username} in room {RoomCode}",
                history.Count, username, roomCode);
        }
    }

    public async Task LeaveRoom()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);
        if (roomCode == null) return;

        var player = await _roomService.GetPlayerByConnectionIdAsync(roomCode, Context.ConnectionId);
        if (player == null) return;

        await HandlePlayerLeaving(roomCode, player);
    }

    /// <summary>
    /// Sends a drawing command to all other players in the room.
    /// </summary>
    public async Task SendDrawingCommand(DrawingCommandDto command, string roomCode)
    {
        if (!ValidationHelper.IsValidRoomCode(roomCode))
        {
            _logger.LogWarning("Invalid room code in SendDrawingCommand: {RoomCode}", roomCode);
            return;
        }

        if (!ValidationHelper.IsValidDrawingCommand(command))
        {
            _logger.LogWarning("Invalid drawing command received from {ConnectionId}", Context.ConnectionId);
            return;
        }

        // Store in canvas history
        await _canvasService.AddDrawingCommandAsync(roomCode, command);

        // Broadcast to others
        await Clients.OthersInGroup(roomCode).SendAsync("ReceiveDrawingCommand", command);

        // Update room activity
        await _roomService.UpdateLastActivityAsync(roomCode);
    }

    /// <summary>
    /// Clears the canvas for all players in the room.
    /// </summary>
    public async Task ClearCanvas(string roomCode)
    {
        if (!ValidationHelper.IsValidRoomCode(roomCode))
        {
            _logger.LogWarning("Invalid room code in ClearCanvas: {RoomCode}", roomCode);
            return;
        }

        await _canvasService.ClearCanvasAsync(roomCode);
        await Clients.OthersInGroup(roomCode).SendAsync("CanvasCleared");

        _logger.LogInformation("Canvas cleared in room {RoomCode} by {ConnectionId}", roomCode, Context.ConnectionId);
    }

    /// <summary>
    /// Gets a list of available public rooms.
    /// </summary>
    public async Task GetPublicRooms()
    {
        var rooms = await _roomService.GetPublicRoomsAsync();

        var publicRoomDtos = rooms.Select(r => new
        {
            RoomCode = r.Id,
            PlayerCount = r.Players.Count,
            r.MaxPlayers,
            HostUsername = r.Players.FirstOrDefault(p => p.IsHost)?.Username
        }).ToList();

        await Clients.Caller.SendAsync("ReceivePublicRooms", publicRoomDtos);
    }

    /// <summary>
    /// Gets the list of players in a room.
    /// </summary>
    public async Task<List<PlayerDto>> GetPlayersInRoom(string roomCode)
    {
        if (!ValidationHelper.IsValidRoomCode(roomCode))
        {
            return [];
        }

        var room = await _roomService.GetRoomAsync(roomCode);
        return room is null ? [] : room.Players.Select(ToPlayerDto).ToList();
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);

        // Find which room the player was in
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);
        if (roomCode != null)
        {
            var player = await _roomService.GetPlayerByConnectionIdAsync(roomCode, Context.ConnectionId);
            if (player != null)
            {
                await HandlePlayerLeaving(roomCode, player);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Handles all the logic when a player leaves (either by choice or disconnect).
    /// </summary>
    private async Task HandlePlayerLeaving(string roomCode, Player player)
    {
        var wasHost = player.IsHost;
        var username = player.Username;

        await _roomService.RemovePlayerFromRoomAsync(roomCode, Context.ConnectionId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomCode);

        // Check if room still exists (might have been deleted if empty)
        var room = await _roomService.GetRoomAsync(roomCode);
        if (room == null)
        {
            _logger.LogInformation("Room {RoomCode} deleted (last player left)", roomCode);
            return;
        }

        // Notify remaining players
        await Clients.Group(roomCode).SendAsync("PlayerLeft", username);

        // If host changed, notify everyone of the new host
        if (wasHost && room.Players.Count > 0)
        {
            var newHost = room.Players.First(p => p.IsHost);
            await Clients.Group(roomCode).SendAsync("HostChanged", newHost.Username);
            _logger.LogInformation("Host migrated to {NewHost} in room {RoomCode}", newHost.Username, roomCode);
        }

        _logger.LogInformation("Player {Username} left room {RoomCode}. Remaining: {PlayerCount}",
            username, roomCode, room.Players.Count);
    }

    /// <summary>
    /// Maps a Player model to a PlayerDto.
    /// </summary>
    private static PlayerDto ToPlayerDto(Player player) => new()
    {
        Username = player.Username,
        Score = player.Score,
        IsHost = player.IsHost,
        IsConnected = player.IsConnected
    };
}
