namespace SketchAI.Api.Services.Infrastructure;

/// <summary>
/// Background service that manages round timing, hint reveals, and round expiry.
/// </summary>
public class RoundTimerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<DrawingHub> _hubContext;
    private readonly IAIDrawingCancellationManager _aiCancellationManager;
    private readonly ILogger<RoundTimerService> _logger;

    /// <summary>
    /// Hint reveal thresholds as percentages of draw time elapsed.
    /// At 25%, 50%, and 75% of draw time, a hint letter is revealed.
    /// </summary>
    private static readonly double[] HintRevealPercentages = [0.25, 0.50, 0.75];

    public RoundTimerService(
        IServiceScopeFactory scopeFactory,
        IHubContext<DrawingHub> hubContext,
        IAIDrawingCancellationManager aiCancellationManager,
        ILogger<RoundTimerService> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _aiCancellationManager = aiCancellationManager;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RoundTimerService started");

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessActiveRoomsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error processing active rooms in RoundTimerService");
            }
        }

        _logger.LogInformation("RoundTimerService stopped");
    }

    private async Task ProcessActiveRoomsAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var roomService = scope.ServiceProvider.GetRequiredService<IRoomService>();
        var gameService = scope.ServiceProvider.GetRequiredService<IGameService>();
        var canvasService = scope.ServiceProvider.GetRequiredService<ICanvasService>();

        var activeRooms = await roomService.GetActiveDrawingRoomsAsync();

        foreach (var room in activeRooms)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                await ProcessRoomTimerAsync(room, roomService, gameService, canvasService);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing timer for room {RoomCode}", room.Id);
            }
        }
    }

    private async Task ProcessRoomTimerAsync(Room room, IRoomService roomService, IGameService gameService, ICanvasService canvasService)
    {
        if (room.RoundStartedAt is null || room.Phase != GamePhase.Drawing)
            return;

        var elapsed = DateTime.UtcNow - room.RoundStartedAt.Value;
        var drawTimeSeconds = room.Settings.DrawTimeSeconds;
        var elapsedPercentage = elapsed.TotalSeconds / drawTimeSeconds;

        if (elapsed.TotalSeconds >= drawTimeSeconds)
        {
            _logger.LogInformation("Round expired in room {RoomCode} after {DrawTime}s. Ending round.",
                room.Id, drawTimeSeconds);

            // Cancel any active AI drawing session
            _aiCancellationManager.CancelSession(room.Id);

            var word = room.CurrentWord;
            await gameService.EndRoundAsync(room.Id, isTimeout: true);

            var updatedRoom = await roomService.GetRoomAsync(room.Id);
            if (updatedRoom is null)
            {
                _logger.LogWarning("Room {RoomCode} not found after ending round", room.Id);
                return;
            }

            var gameState = updatedRoom.ToDto();

            await _hubContext.Clients.Group(room.Id).SendAsync("RoundEnded", new
            {
                GameState = gameState,
                Word = word
            });

            // Schedule next turn after delay
            _ = Task.Run(async () =>
            {
                await Task.Delay(5000);
                await AdvanceToNextTurnAsync(room.Id, roomService, gameService, canvasService);
            });

            return;
        }

        await CheckAndRevealHintAsync(room, gameService, elapsedPercentage);
    }

    private async Task AdvanceToNextTurnAsync(string roomCode, IRoomService roomService, IGameService gameService, ICanvasService canvasService)
    {
        try
        {
            await gameService.NextTurnAsync(roomCode);

            var room = await roomService.GetRoomAsync(roomCode);
            if (room is null)
            {
                _logger.LogWarning("Room {RoomCode} not found when advancing to next turn", roomCode);
                return;
            }

            switch (room.Phase)
            {
                case GamePhase.Lobby:
                    await _hubContext.Clients.Group(roomCode).SendAsync("GameReset", new
                    {
                        Players = room.Players.Select(p => p.ToDto()).ToList(),
                        Reason = "Not enough players to continue"
                    });
                    break;

                case GamePhase.GameEnd:
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

                case GamePhase.WordSelection:
                    await canvasService.ClearCanvasAsync(roomCode);
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error advancing to next turn in room {RoomCode}", roomCode);
        }
    }

    private async Task CheckAndRevealHintAsync(Room room, IGameService gameService, double elapsedPercentage)
    {
        var hintsToReveal = HintRevealPercentages.Count(p => elapsedPercentage >= p);

        if (hintsToReveal > room.LettersRevealed)
        {
            var newHint = await gameService.RevealLetterAsync(room.Id);

            if (newHint is not null)
            {
                _logger.LogDebug("Hint revealed in room {RoomCode}. Progress: {Percentage:P0}, Hint: {Hint}",
                    room.Id, elapsedPercentage, newHint);

                await _hubContext.Clients.Group(room.Id).SendAsync("HintUpdated", newHint);
            }
        }
    }
}
