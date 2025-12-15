namespace SkribblAI.Api.Hubs;

/// <summary>
/// SignalR hub for real-time drawing interactions.
/// </summary>
public class DrawingHub : Hub
{
    private readonly IRoomService _roomService;
    private readonly ICanvasService _canvasService;
    private readonly IGameService _gameService;
    private readonly IWordService _wordService;
    private readonly ILogger<DrawingHub> _logger;


    public DrawingHub(IRoomService roomService,
        ICanvasService canvasService,
        IGameService gameService,
        IWordService wordService,
        ILogger<DrawingHub> logger)
    {
        _roomService = roomService;
        _canvasService = canvasService;
        _gameService = gameService;
        _wordService = wordService;
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

    public async Task StartGame()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);

        if (roomCode is null)
        {
            _logger.LogWarning("StartGame failed: Connection {ConnectionId} is not in any room", Context.ConnectionId);
            throw new HubException("You are not in a room");
        }

        var success = await _gameService.StartGameAsync(roomCode, Context.ConnectionId);

        if (!success)
        {
            throw new HubException("Failed to start game. Make sure you are the host and have at least 2 players.");
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room?.CurrentDrawerConnectionId is null)
        {
            _logger.LogError("StartGame inconsistency: Room {RoomCode} or drawer is null after successful start", roomCode);
            throw new HubException("An unexpected error occurred");
        }

        var gameState = ToGameStateDto(room);
        await Clients.Group(roomCode).SendAsync("GameStarted", gameState);
        await Clients.Client(room.CurrentDrawerConnectionId).SendAsync("WordChoices", room.WordChoices);

        _logger.LogInformation("Game started notification sent to room {RoomCode}", roomCode);
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

    /// <summary>
    /// Called by the drawer to select a word from the choices.
    /// </summary>
    public async Task SelectWord(string word)
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);

        if (roomCode is null)
        {
            _logger.LogWarning("SelectWord failed: Connection {ConnectionId} is not in any room", Context.ConnectionId);
            throw new HubException("You are not in a room");
        }

        var success = await _gameService.SelectWordAsync(roomCode, Context.ConnectionId, word);

        if (!success)
        {
            throw new HubException("Failed to select word. Make sure you are the drawer and the word is valid.");
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room?.CurrentWord is null)
        {
            _logger.LogError("SelectWord inconsistency: Room {RoomCode} or word is null after successful selection", roomCode);
            throw new HubException("An unexpected error occurred");
        }

        await _canvasService.ClearCanvasAsync(roomCode);

        var gameState = ToGameStateDto(room);
        gameState.WordHint = room.CurrentWordHint ?? _wordService.GetWordHint(room.CurrentWord);
        await Clients.Group(roomCode).SendAsync("DrawingStarted", gameState);

        await Clients.Caller.SendAsync("YourWord", room.CurrentWord);

        await Clients.OthersInGroup(roomCode).SendAsync("CanvasCleared");

        _logger.LogInformation("Drawing started in room {RoomCode}. Word hint: {WordHint}",
            roomCode, gameState.WordHint);
    }

    /// <summary>
    /// Reveals a letter in the word hint. Can be called periodically during drawing phase.
    /// </summary>
    public async Task RevealLetter()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);

        if (roomCode is null)
        {
            return;
        }

        var newHint = await _gameService.RevealLetterAsync(roomCode);

        if (newHint is not null)
        {
            await Clients.Group(roomCode).SendAsync("HintUpdated", newHint);
        }
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
    /// Called by players to submit a guess or send a chat message.
    /// </summary>
    public async Task SendGuess(string message)
    {
        if (string.IsNullOrWhiteSpace(message) || message.Length > 100)
        {
            return;
        }

        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);

        if (roomCode is null)
        {
            throw new HubException("You are not in a room");
        }

        var room = await _roomService.GetRoomAsync(roomCode);
        if (room is null)
        {
            throw new HubException("Room not found");
        }

        var player = room.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId);
        if (player is null)
        {
            throw new HubException("Player not found");
        }

        var isCorrectGuess = await _gameService.CheckGuessAsync(roomCode, Context.ConnectionId, message);

        if (isCorrectGuess)
        {
            await Clients.Group(roomCode).SendAsync("PlayerGuessedCorrectly", player.Username);

            // Send updated scores to everyone
            var updatedRoom = await _roomService.GetRoomAsync(roomCode);
            if (updatedRoom is not null)
            {
                var players = updatedRoom.Players.Select(ToPlayerDto).ToList();
                await Clients.Group(roomCode).SendAsync("ScoresUpdated", players);

                // Check if all players have guessed (round should end)
                var nonDrawerCount = updatedRoom.Players.Count - 1;
                if (updatedRoom.PlayersWhoGuessed.Count >= nonDrawerCount)
                {
                    await EndRoundAndNotify(roomCode);
                }
            }
        }
        else
        {
            var hasAlreadyGuessed = room.PlayersWhoGuessed.Contains(Context.ConnectionId);

            if (!hasAlreadyGuessed)
            {
                await Clients.Group(roomCode).SendAsync("ChatMessage", new
                {
                    player.Username,
                    Message = message,
                    Timestamp = DateTime.UtcNow
                });
            }
        }
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

    public async Task LeaveRoom()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);
        if (roomCode == null) return;

        var player = await _roomService.GetPlayerByConnectionIdAsync(roomCode, Context.ConnectionId);
        if (player == null) return;

        await HandlePlayerLeaving(roomCode, player);
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
    /// Ends the current round and notifies all players.
    /// </summary>
    private async Task EndRoundAndNotify(string roomCode)
    {
        await _gameService.EndRoundAsync(roomCode);

        var room = await _roomService.GetRoomAsync(roomCode);
        if (room is null) return;

        var gameState = ToGameStateDto(room);

        // Reveal the word to everyone at round end
        await Clients.Group(roomCode).SendAsync("RoundEnded", new
        {
            GameState = gameState,
            Word = room.CurrentWord
        });

        _logger.LogInformation("Round ended in room {RoomCode}. Word was: {Word}", roomCode, room.CurrentWord);
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

    /// <summary>
    /// Maps a Room model to a GameStateDto (safe to send to all players).
    /// </summary>
    private static GameStateDto ToGameStateDto(Room room)
    {
        var drawer = room.Players.FirstOrDefault(p => p.ConnectionId == room.CurrentDrawerConnectionId);

        return new GameStateDto
        {
            RoomCode = room.Id,
            Phase = room.Phase.ToString(),
            CurrentDrawerUsername = drawer?.Username ?? "Unknown",
            RoundNumber = room.RoundNumber,
            TotalRounds = room.TotalRounds,
            Players = room.Players.Select(ToPlayerDto).ToList(),
            WordHint = null, // Set by caller when in Drawing phase
            RoundStartedAt = room.RoundStartedAt
        };
    }
}
