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
    private readonly IHubContext<DrawingHub> _hubContext;
    private readonly ILogger<DrawingHub> _logger;


    public DrawingHub(IRoomService roomService,
        ICanvasService canvasService,
        IGameService gameService,
        IWordService wordService,
        IHubContext<DrawingHub> hubContext,
        ILogger<DrawingHub> logger)
    {
        _roomService = roomService;
        _canvasService = canvasService;
        _gameService = gameService;
        _wordService = wordService;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Creates a new room and joins the creator as host.
    /// </summary>
    public async Task CreateRoom(string username, string roomCode, bool isPublic = true, RoomSettingsDto? roomSettings = null)
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

        if (roomSettings is not null)
        {
            var (_, errorMessage) = await _roomService.UpdateRoomSettingsAsync(roomCode, Context.ConnectionId, roomSettings);

            if (errorMessage is not null)
            {
                _logger.LogWarning("CreateRoom with custom roomSettings failed - Error: {ErrorMessage}", errorMessage);
                await _roomService.DeleteRoomAsync(roomCode);
                throw new HubException(errorMessage);
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        var players = room.Players.Select(p => p.ToDto()).ToList();
        roomSettings ??= room.Settings;
        await Clients.Caller.SendAsync("RoomCreated", roomCode, players, roomSettings);
    }

    public async Task UpdateRoomSettings(RoomSettingsDto roomSettings)
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);

        if (roomCode is null)
        {
            _logger.LogWarning("UpdateRoomSettings failed: Connection {ConnectionId} is not in any room", Context.ConnectionId);
            throw new HubException("You are not in a room");
        }

        var (_, errorMessage) = await _roomService.UpdateRoomSettingsAsync(roomCode, Context.ConnectionId, roomSettings);

        if (errorMessage is not null)
        {
            _logger.LogWarning("UpdateRoomSettings failed - Error: {ErrorMessage}", errorMessage);
            throw new HubException(errorMessage);
        }

        await Clients.Group(roomCode).SendAsync("RoomSettingsUpdated", roomSettings);
    }

    /// <summary>
    /// Starts a new game in the room associated with the current connection, if the caller is the host and the room has
    /// at least two players.
    /// </summary>
    /// <remarks>This method clears the canvas for the room before starting a new game and notifies all
    /// clients in the room. Only the host can start the game, and the room must have at least two players.</remarks>
    /// <returns>A task that represents the asynchronous operation.</returns>
    /// <exception cref="HubException">Thrown if the caller is not in a room, is not the host, there are fewer than two players in the room, or if an
    /// unexpected error occurs while starting the game.</exception>
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

        // Clear canvas from previous game (for "Play Again" scenario)
        await _canvasService.ClearCanvasAsync(roomCode);
        await Clients.Group(roomCode).SendAsync("CanvasCleared");

        var gameState = room.ToDto();
        await Clients.Group(roomCode).SendAsync("GameStarted", gameState);
        await Clients.Client(room.CurrentDrawerConnectionId).SendAsync("WordChoices", room.WordChoices);
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
            r.Settings.MaxPlayers,
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
        if (existingPlayer is not null)
        {
            throw new HubException("Username already taken in this room");
        }

        var isFull = await _roomService.IsRoomFullAsync(roomCode);
        if (isFull)
        {
            throw new HubException("Room is full");
        }

        var player = await _roomService.AddPlayerToRoomAsync(roomCode, Context.ConnectionId, username)
                     ?? throw new HubException("Failed to join room");

        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        room = await _roomService.GetRoomAsync(roomCode) ?? throw new HubException("Room not found");

        var players = room.Players.Select(p => p.ToDto()).ToList();

        await Clients.Caller.SendAsync("RoomJoined", roomCode, players, room.Settings);

        await Clients.OthersInGroup(roomCode).SendAsync("PlayerJoined", player.ToDto());

        if (room.Phase != GamePhase.Lobby)
        {
            await SendGameStateToNewPlayer(room);
        }

        var history = await _canvasService.GetCanvasHistoryAsync(roomCode);
        if (history.Count > 0)
        {
            await Clients.Caller.SendAsync("ReceiveCanvasHistory", history);
            _logger.LogDebug("Sent {Count} drawing commands to {Username} in room {RoomCode}",
                history.Count, username, roomCode);
        }
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

        var gameState = room.ToDto();
        gameState.WordHint = room.CurrentWordHint ?? _wordService.GetWordHint(room.CurrentWord);
        await Clients.Group(roomCode).SendAsync("DrawingStarted", gameState);

        await Clients.Caller.SendAsync("YourWord", room.CurrentWord);

        await Clients.OthersInGroup(roomCode).SendAsync("CanvasCleared");
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

        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId)
                       ?? throw new HubException("You are not in a room");

        var room = await _roomService.GetRoomAsync(roomCode)
                   ?? throw new HubException("Room not found");

        var player = room.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId)
            ?? throw new HubException("Player not found");

        var isCorrectGuess = await _gameService.CheckGuessAsync(roomCode, Context.ConnectionId, message);

        if (isCorrectGuess)
        {
            await Clients.Group(roomCode).SendAsync("PlayerGuessedCorrectly", player.Username);

            var updatedRoom = await _roomService.GetRoomAsync(roomCode)
                              ?? throw new HubException("Room not found");

            var players = updatedRoom.Players.Select(p => p.ToDto()).ToList();
            await Clients.Group(roomCode).SendAsync("ScoresUpdated", players);

            // Check if all players have guessed (round should end)
            var nonDrawerCount = updatedRoom.Players.Count - 1;
            if (updatedRoom.PlayersWhoGuessed.Count >= nonDrawerCount)
            {
                await EndRoundAndNotify(roomCode);
            }
        }
        else
        {
            var hasAlreadyGuessed = room.PlayersWhoGuessed.Contains(Context.ConnectionId);

            if (!hasAlreadyGuessed)
            {
                var isCloseGuess = room.CurrentWord is not null &&
                                   room.Phase == GamePhase.Drawing &&
                                   _wordService.IsCloseGuess(room.CurrentWord, message);

                await Clients.Client(Context.ConnectionId).SendAsync("ChatMessage", new
                {
                    player.Username,
                    Message = message,
                    Timestamp = DateTime.UtcNow,
                    IsCloseGuess = isCloseGuess
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

    public async Task EndRound()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId)
                       ?? throw new HubException("You are not in a room");

        var room = await _roomService.GetRoomAsync(roomCode)
                   ?? throw new HubException("Room not found");

        if (room.Phase is not GamePhase.Drawing) return;

        if (room.CurrentDrawerConnectionId != Context.ConnectionId)
        {
            throw new HubException("Only the drawer can end the round");
        }

        await EndRoundAndNotify(roomCode);
    }

    public async Task LeaveRoom()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);
        if (roomCode is null) return;

        var player = await _roomService.GetPlayerByConnectionIdAsync(roomCode, Context.ConnectionId);
        if (player is null) return;

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

        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);
        if (roomCode is not null)
        {
            var player = await _roomService.GetPlayerByConnectionIdAsync(roomCode, Context.ConnectionId);
            if (player is not null)
            {
                await HandlePlayerLeaving(roomCode, player);
            }
        }

        // Clean up rate limiters for this connection
        RateLimitingHubFilter.CleanupConnection(Context.ConnectionId);

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Ends the current round and notifies all players.
    /// </summary>
    private async Task EndRoundAndNotify(string roomCode)
    {
        await _gameService.EndRoundAsync(roomCode);

        var room = await _roomService.GetRoomAsync(roomCode)
                   ?? throw new HubException("Room not found");

        var gameState = room.ToDto();

        // Reveal the word to everyone at round end
        await Clients.Group(roomCode).SendAsync("RoundEnded", new
        {
            GameState = gameState,
            Word = room.CurrentWord
        });

        _ = Task.Run(async () =>
        {
            await Task.Delay(5000);
            await AdvanceToNextTurn(roomCode);
        });
    }

    private async Task AdvanceToNextTurn(string roomCode)
    {
        await _gameService.NextTurnAsync(roomCode);

        var room = await _roomService.GetRoomAsync(roomCode)
                   ?? throw new HubException("Room not found");

        switch (room.Phase)
        {
            case GamePhase.Lobby:
                {
                    // Game was reset to lobby due to not enough players
                    await _hubContext.Clients.Group(roomCode).SendAsync("GameReset", new
                    {
                        Players = room.Players.Select(p => p.ToDto()).ToList(),
                        Reason = "Not enough players to continue"
                    });
                    break;
                }
            case GamePhase.GameEnd:
                {
                    var topThreeWinnerUsernames = room.Players
                        .OrderByDescending(p => p.Score)
                        .Take(3)
                        .Select(p => p.Username)
                        .ToList();

                    await _hubContext.Clients.Group(roomCode).SendAsync("GameEnded", new
                    {
                        Players = room.Players.Select(p => p.ToDto()).ToList(),
                        WinnerUsernames = topThreeWinnerUsernames
                    });
                    break;
                }
            case GamePhase.WordSelection:
                {
                    await _canvasService.ClearCanvasAsync(roomCode);
                    await _hubContext.Clients.Group(roomCode).SendAsync("CanvasCleared");

                    var gameState = room.ToDto();
                    await _hubContext.Clients.Group(roomCode).SendAsync("NextTurnStarted", gameState);

                    if (room.CurrentDrawerConnectionId is not null)
                    {
                        await _hubContext.Clients.Client(room.CurrentDrawerConnectionId).SendAsync("WordChoices", room.WordChoices);
                    }
                    break;
                }
        }
    }

    /// <summary>
    /// Handles all the logic when a player leaves (either by choice or disconnect).
    /// </summary>
    private async Task HandlePlayerLeaving(string roomCode, Player player)
    {
        var wasHost = player.IsHost;
        var wasDrawer = false;
        var username = player.Username;

        var roomBeforeLeave = await _roomService.GetRoomAsync(roomCode);

        if (roomBeforeLeave is not null)
        {
            wasDrawer = roomBeforeLeave.CurrentDrawerConnectionId == player.ConnectionId;
        }

        await _roomService.RemovePlayerFromRoomAsync(roomCode, Context.ConnectionId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomCode);

        // Check if room still exists (might have been deleted if empty)
        var room = await _roomService.GetRoomAsync(roomCode);
        if (room is null)
        {
            return;
        }

        await Clients.Group(roomCode).SendAsync("PlayerLeft", username);

        if (wasHost && room.Players.Count > 0)
        {
            var newHost = room.Players.First(p => p.IsHost);
            await Clients.Group(roomCode).SendAsync("HostChanged", newHost.Username);
        }

        if (room.Players.Count < 2 && room.Phase != GamePhase.Lobby)
        {
            await _gameService.ResetToLobbyAsync(roomCode);

            await Clients.Group(roomCode).SendAsync("GameReset", new
            {
                Players = room.Players.Select(p => p.ToDto()).ToList(),
                Reason = "Not enough players to continue"
            });

            return;
        }

        if (wasDrawer && room.Players.Count > 0 &&
            (room.Phase == GamePhase.WordSelection || room.Phase == GamePhase.Drawing))
        {
            _logger.LogInformation("Drawer {Username} left during {Phase} phase, advancing to next turn in room {RoomCode}",
                username, room.Phase, roomCode);

            await Clients.Group(roomCode).SendAsync("DrawerLeft", username);

            _ = Task.Run(async () =>
            {
                await Task.Delay(2000);
                await AdvanceToNextTurn(roomCode);
            });
        }
    }

    /// <summary>
    /// Sends the current game state to a player who just joined during an active game.
    /// </summary>
    private async Task SendGameStateToNewPlayer(Room room)
    {
        var gameState = room.ToDto();

        switch (room.Phase)
        {
            case GamePhase.WordSelection:
                await Clients.Caller.SendAsync("GameStarted", gameState);
                _logger.LogDebug("Sent WordSelection game state to new player");
                break;

            case GamePhase.Drawing:
                gameState.WordHint = room.CurrentWordHint ?? (room.CurrentWord is not null
                    ? _wordService.GetWordHint(room.CurrentWord)
                    : null);
                await Clients.Caller.SendAsync("DrawingStarted", gameState);
                _logger.LogDebug("Sent Drawing game state to new player");
                break;

            case GamePhase.RoundEnd:
                await Clients.Caller.SendAsync("RoundEnded", new
                {
                    GameState = gameState,
                    Word = room.CurrentWord ?? ""
                });
                _logger.LogDebug("Sent RoundEnd game state to new player");
                break;

            case GamePhase.GameEnd:
                var topThreeWinnerUsernames = room.Players
                    .OrderByDescending(p => p.Score)
                    .Take(3)
                    .Select(p => p.Username)
                    .ToList();
                await Clients.Caller.SendAsync("GameEnded", new
                {
                    Players = room.Players.Select(p => p.ToDto()).ToList(),
                    WinnerUsernames = topThreeWinnerUsernames
                });
                _logger.LogDebug("Sent GameEnd state to new player");
                break;
        }
    }
}
