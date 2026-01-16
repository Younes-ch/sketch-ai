namespace SketchAI.Api.Hubs;

/// <summary>
/// SignalR hub for real-time drawing interactions.
/// </summary>
public class DrawingHub : Hub
{
    private readonly IRoomService _roomService;
    private readonly ICanvasService _canvasService;
    private readonly IGameService _gameService;
    private readonly IWordService _wordService;
    private readonly IWordExplanationService _wordExplanationService;
    private readonly IAIDrawingService _aiDrawingService;
    private readonly IAIDrawingCancellationManager _aiCancellationManager;
    private readonly IHubContext<DrawingHub> _hubContext;
    private readonly GameSettings _gameSettings;
    private readonly ILogger<DrawingHub> _logger;


    public DrawingHub(IRoomService roomService,
        ICanvasService canvasService,
        IGameService gameService,
        IWordService wordService,
        IWordExplanationService wordExplanationService,
        IAIDrawingService aiDrawingService,
        IAIDrawingCancellationManager aiCancellationManager,
        IHubContext<DrawingHub> hubContext,
        IOptions<GameSettings> gameSettings,
        ILogger<DrawingHub> logger)
    {
        _roomService = roomService;
        _canvasService = canvasService;
        _gameService = gameService;
        _wordService = wordService;
        _wordExplanationService = wordExplanationService;
        _aiDrawingService = aiDrawingService;
        _aiCancellationManager = aiCancellationManager;
        _hubContext = hubContext;
        _gameSettings = gameSettings.Value;
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

        var isFull = _roomService.IsRoomFull(room);
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

    public async Task GetWordExplanation(string word, string targetLanguage)
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId);

        if (roomCode is null)
        {
            _logger.LogWarning("GetWordExplanation failed: Connection {ConnectionId} is not in any room", Context.ConnectionId);
            throw new HubException("You are not in a room");
        }

        var room = await _roomService.GetRoomAsync(roomCode) ?? throw new HubException("Room not found");

        if (room.Phase != GamePhase.WordSelection && room.Phase != GamePhase.Drawing)
        {
            throw new HubException("You are not in word selection or drawing phase");
        }

        if (room.Phase == GamePhase.WordSelection)
        {
            if (room.WordChoices is not null && !room.WordChoices.Contains(word, StringComparer.OrdinalIgnoreCase))
            {
                throw new HubException("Word is not from the given choices");
            }
        }
        else
        {
            if (room.CurrentWord is not null && !room.CurrentWord.Equals(word, StringComparison.OrdinalIgnoreCase))
            {
                throw new HubException("Word is not the selected word");
            }
        }

        var result = await _wordExplanationService.ExplainWordAsync(word, targetLanguage, Context.ConnectionAborted);
        await Clients.Caller.SendAsync("ReceiveWordExplanation", result);
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

        var room = await _roomService.GetRoomAsync(roomCode);
        if (room?.CurrentDrawerConnectionId != Context.ConnectionId)
        {
            _logger.LogWarning("Non-drawer attempted drawing command in room {RoomCode}", roomCode);
            return;
        }

        // Store in canvas history
        await _canvasService.AddDrawingCommandAsync(roomCode, command);

        // Broadcast to others
        await Clients.OthersInGroup(roomCode).SendAsync("ReceiveDrawingCommand", command);

        // Update room activity
        await _roomService.UpdateLastActivityAsync(roomCode);
    }

    public async Task SendFillCommand(DrawingCommandDto command, string roomCode)
    {
        if (!ValidationHelper.IsValidRoomCode(roomCode))
        {
            _logger.LogWarning("SendFillCommand failed: Invalid room code '{RoomCode}'", roomCode);
            return;
        }

        if (!ValidationHelper.IsValidDrawingCommand(command))
        {
            _logger.LogWarning("SendFillCommand failed: Invalid fill command from {ConnectionId}", Context.ConnectionId);
            return;
        }

        var room = await _roomService.GetRoomAsync(roomCode);
        if (room?.CurrentDrawerConnectionId != Context.ConnectionId)
        {
            _logger.LogWarning("SendFillCommand failed: Non-drawer {ConnectionId} attempted fill in room {RoomCode}",
                Context.ConnectionId, roomCode);
            return;
        }

        await _canvasService.AddDrawingCommandAsync(roomCode, command);
        await Clients.OthersInGroup(roomCode).SendAsync("ReceiveFillCommand", command);
        await _roomService.UpdateLastActivityAsync(roomCode);
    }

    public async Task StartAiDrawing()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId)
            ?? throw new HubException("You are not in a room");

        var room = await _roomService.GetRoomAsync(roomCode) ?? throw new HubException("Room not found");

        if (room.CurrentDrawerConnectionId != Context.ConnectionId)
        {
            throw new HubException("Only the drawer can use AI drawing");
        }

        if (room.Phase != GamePhase.Drawing)
        {
            throw new HubException("AI drawing is only available during the drawing phase");
        }

        if (string.IsNullOrEmpty(room.CurrentWord))
        {
            throw new HubException("No word selected");
        }

        if (_aiCancellationManager.IsDrawing(roomCode))
        {
            throw new HubException("AI drawing is already in progress");
        }

        var drawerPlayer = room.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId)
            ?? throw new HubException("Player not found");

        if (drawerPlayer.AiDrawingsUsed >= _gameSettings.MaxAiDrawingsPerPlayer)
        {
            throw new HubException($"You have used all {_gameSettings.MaxAiDrawingsPerPlayer} AI drawing(s) for this game");
        }

        if (drawerPlayer.LastAiDrawingAt.HasValue)
        {
            var elapsed = DateTime.UtcNow - drawerPlayer.LastAiDrawingAt.Value;
            var cooldown = TimeSpan.FromSeconds(_gameSettings.AiDrawingCooldownSeconds);
            if (elapsed < cooldown)
            {
                var remaining = (int)Math.Ceiling((cooldown - elapsed).TotalSeconds);
                throw new HubException($"Please wait {remaining} second(s) before using AI drawing again");
            }
        }

        drawerPlayer.AiDrawingsUsed++;
        drawerPlayer.LastAiDrawingAt = DateTime.UtcNow;

        room.IsAiDrawing = true;
        await _roomService.SaveRoomAsync(room);

        await Clients.Caller.SendAsync("AIDrawingStarted");

        var ct = _aiCancellationManager.CreateSession(roomCode);

        var wordToDraw = room.CurrentWord;

        var drawerConnectionId = Context.ConnectionId;

        // Run AI drawing in background so other hub methods (StopAiDrawing, LeaveRoom) can execute
        _ = Task.Run(async () =>
        {
            var caller = _hubContext.Clients.Client(drawerConnectionId);
            var completedSuccessfully = false;

            try
            {
                await foreach (var command in _aiDrawingService.GenerateDrawingCommandAsync(wordToDraw, room.Settings.WordPreset, ct))
                {
                    // Check if cancelled before sending
                    if (ct.IsCancellationRequested)
                        break;

                    await _canvasService.AddDrawingCommandAsync(roomCode, command);

                    if (command.Type == "fill")
                    {
                        await _hubContext.Clients.Group(roomCode).SendAsync("ReceiveFillCommand", command);
                    }
                    else
                    {
                        await _hubContext.Clients.Group(roomCode).SendAsync("ReceiveDrawingCommand", command);
                    }

                    // Send to drawer for tracking stroke IDs (for undo functionality)
                    await _hubContext.Clients.Client(drawerConnectionId).SendAsync("AIDrawingCommand", command);
                }

                completedSuccessfully = !ct.IsCancellationRequested;
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("AI drawing cancelled in room {RoomCode}", roomCode);
            }
            catch (AIDrawingException ex)
            {
                _logger.LogWarning(ex, "AI drawing unavailable in room {RoomCode}", roomCode);
                await caller.SendAsync("AIDrawingError", ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AI drawing failed in room {RoomCode}", roomCode);
                await caller.SendAsync("AIDrawingError", "AI drawing failed. Please try again.");
            }
            finally
            {
                _aiCancellationManager.CancelSession(roomCode);

                var currentRoom = await _roomService.GetRoomAsync(roomCode);
                if (currentRoom is not null)
                {
                    currentRoom.IsAiDrawing = false;

                    if (!completedSuccessfully)
                    {
                        var drawer = currentRoom.Players.FirstOrDefault(p => p.ConnectionId == drawerConnectionId);
                        if (drawer is not null && drawer.AiDrawingsUsed > 0)
                        {
                            drawer.AiDrawingsUsed--;
                            drawer.LastAiDrawingAt = null;
                            _logger.LogInformation("Reset AI drawing count for drawer in room {RoomCode} (cancelled/failed)", roomCode);
                        }
                    }

                    await _roomService.SaveRoomAsync(currentRoom);
                }

                await caller.SendAsync("AIDrawingStopped");
            }
        });
    }

    public async Task StopAiDrawing()
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId)
                       ?? throw new HubException("You are not in a room");

        var room = await _roomService.GetRoomAsync(roomCode)
                   ?? throw new HubException("Room not found");

        if (room.CurrentDrawerConnectionId != Context.ConnectionId)
        {
            throw new HubException("Only the drawer can stop AI drawing");
        }

        if (!_aiCancellationManager.IsDrawing(roomCode))
        {
            return;
        }

        _aiCancellationManager.CancelSession(roomCode);

        // AIDrawingStopped will be sent by the finally block in StartAiDrawing
        _logger.LogInformation("AI drawing stopped by drawer in room {RoomCode}", roomCode);
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

                if (isCloseGuess)
                {
                    await Clients.Caller.SendAsync("ChatMessage", new
                    {
                        player.Username,
                        Message = message,
                        Timestamp = DateTime.UtcNow,
                        IsCloseGuess = true
                    });
                }
                else
                {
                    await Clients.Group(roomCode).SendAsync("ChatMessage", new
                    {
                        player.Username,
                        Message = message,
                        Timestamp = DateTime.UtcNow,
                    });
                }

            }
        }
    }

    /// <summary>
    /// Undoes the last drawing operation atomically.
    /// If the last command was AI-generated, removes ALL AI commands.
    /// Otherwise, removes all consecutive commands with the same strokeId.
    /// Always returns the updated canvas history to all clients.
    /// </summary>
    public async Task UndoLastDrawCommand(string roomCode)
    {
        if (!ValidationHelper.IsValidRoomCode(roomCode))
        {
            _logger.LogWarning("Invalid room code in UndoLastDrawCommand: {RoomCode}", roomCode);
            return;
        }

        var room = await _roomService.GetRoomAsync(roomCode);
        if (room?.CurrentDrawerConnectionId != Context.ConnectionId)
        {
            _logger.LogWarning("Non-drawer attempted undo in room {RoomCode}", roomCode);
            return;
        }

        var (removedCount, _) = await _canvasService.UndoLastDrawCommandAsync(roomCode);

        if (removedCount > 0)
        {
            var history = await _canvasService.GetCanvasHistoryAsync(roomCode);
            await Clients.Group(roomCode).SendAsync("ReceiveCanvasHistory", history);
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

    /// <summary>
    /// Kicks a player from the room. Only the host can do this.
    /// </summary>
    public async Task KickPlayer(string targetUsername)
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId)
                       ?? throw new HubException("You are not in a room");

        var (kickedPlayer, errorMessage) = await _roomService.KickPlayerAsync(roomCode, Context.ConnectionId, targetUsername);

        if (errorMessage is not null)
        {
            throw new HubException(errorMessage);
        }

        if (kickedPlayer is null)
        {
            throw new HubException("Failed to kick player");
        }

        await Clients.Client(kickedPlayer.ConnectionId).SendAsync("Kicked", "You have been kicked by the host");

        await HandlePlayerLeaving(roomCode, kickedPlayer);

        _logger.LogInformation("Player {Username} was kicked from room {RoomCode} by host",
            targetUsername, roomCode);
    }

    /// <summary>
    /// Starts a votekick against a player.
    /// </summary>
    public async Task StartVoteKick(string targetUsername)
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId)
                       ?? throw new HubException("You are not in a room");

        var (success, errorMessage) = await _roomService.StartVoteKickAsync(roomCode, Context.ConnectionId, targetUsername);

        if (!success)
        {
            throw new HubException(errorMessage ?? "Failed to start votekick");
        }

        var room = await _roomService.GetRoomAsync(roomCode);
        if (room?.ActiveVoteKick is null)
        {
            throw new HubException("Failed to start votekick");
        }

        var initiator = room.Players.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId);

        // Notify all players about the votekick
        await Clients.Group(roomCode).SendAsync("VoteKickStarted", new
        {
            TargetUsername = targetUsername,
            InitiatorUsername = initiator?.Username ?? "Unknown",
            VotesToKick = room.ActiveVoteKick.VotesToKick.Count,
            VotesToKeep = room.ActiveVoteKick.VotesToKeep.Count,
            room.ActiveVoteKick.TotalVotersNeeded
        });
    }

    /// <summary>
    /// Casts a vote in an active votekick.
    /// </summary>
    public async Task CastVoteKick(bool voteToKick)
    {
        var roomCode = await _roomService.GetRoomCodeByConnectionIdAsync(Context.ConnectionId)
                       ?? throw new HubException("You are not in a room");

        var (result, errorMessage) = await _roomService.CastVoteKickAsync(roomCode, Context.ConnectionId, voteToKick);

        if (errorMessage is not null)
        {
            throw new HubException(errorMessage);
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (result is not null)
        {
            if (result.ShouldKick)
            {
                await Clients.Client(result.TargetConnectionId).SendAsync("Kicked", "You have been kicked by vote");

                var kickedPlayer = room?.Players.FirstOrDefault(p => p.ConnectionId == result.TargetConnectionId);
                if (kickedPlayer is not null)
                {
                    await HandlePlayerLeaving(roomCode, kickedPlayer);
                }
            }

            await Clients.Group(roomCode).SendAsync("VoteKickEnded", new
            {
                result.TargetUsername,
                result.ShouldKick,
                result.VotesToKick,
                result.VotesToKeep
            });
        }
        else if (room?.ActiveVoteKick is not null)
        {
            // Update vote counts for all players
            await Clients.Group(roomCode).SendAsync("VoteKickUpdated", new
            {
                room.ActiveVoteKick.TargetUsername,
                VotesToKick = room.ActiveVoteKick.VotesToKick.Count,
                VotesToKeep = room.ActiveVoteKick.VotesToKeep.Count,
                room.ActiveVoteKick.TotalVotersNeeded
            });
        }
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

            var room = await _roomService.GetRoomAsync(roomCode);

            if (room is null || room.CurrentDrawerConnectionId == Context.ConnectionId)
            {
                _aiCancellationManager.CancelSession(roomCode);
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

        _aiCancellationManager.CancelSession(roomCode);

        _ = Task.Run(async () =>
        {
            await Task.Delay(5000);
            await AdvanceToNextTurn(roomCode);
        });
    }

    private async Task AdvanceToNextTurn(string roomCode)
    {
        _aiCancellationManager.CancelSession(roomCode);

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

            if (wasDrawer && _aiCancellationManager.IsDrawing(roomCode))
            {
                _aiCancellationManager.CancelSession(roomCode);
                _logger.LogInformation("AI drawing cancelled because drawer {Username} is leaving room {RoomCode}",
                    username, roomCode);
            }

            // Cancel any active votekick involving this player
            if (roomBeforeLeave.ActiveVoteKick is not null)
            {
                var wasVoteKickTarget = roomBeforeLeave.ActiveVoteKick.TargetConnectionId == player.ConnectionId;
                await _roomService.CancelVoteKickAsync(roomCode);

                if (wasVoteKickTarget)
                {
                    await Clients.Group(roomCode).SendAsync("VoteKickCancelled", new
                    {
                        Reason = $"{username} left the room"
                    });
                }
            }
        }

        await _roomService.RemovePlayerFromRoomAsync(roomCode, player.ConnectionId);
        await Groups.RemoveFromGroupAsync(player.ConnectionId, roomCode);

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
