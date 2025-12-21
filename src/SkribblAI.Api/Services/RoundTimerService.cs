namespace SkribblAI.Api.Services;

/// <summary>
/// Background service that manages round timing, hint reveals, and round expiry.
/// </summary>
public class RoundTimerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<DrawingHub> _hubContext;
    private readonly ILogger<RoundTimerService> _logger;

    /// <summary>
    /// Hint reveal thresholds as percentages of draw time elapsed.
    /// At 25%, 50%, and 75% of draw time, a hint letter is revealed.
    /// </summary>
    private static readonly double[] HintRevealPercentages = [0.25, 0.50, 0.75];

    public RoundTimerService(
        IServiceScopeFactory scopeFactory,
        IHubContext<DrawingHub> hubContext,
        ILogger<RoundTimerService> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
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

        var activeRooms = await roomService.GetActiveDrawingRoomsAsync();

        foreach (var room in activeRooms)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                await ProcessRoomTimerAsync(room, gameService);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing timer for room {RoomCode}", room.Id);
            }
        }
    }

    private async Task ProcessRoomTimerAsync(Room room, IGameService gameService)
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

            await gameService.EndRoundAsync(room.Id, isTimeout: true);

            await _hubContext.Clients.Group(room.Id).SendAsync("RoundEnded", new
            {
                Word = room.CurrentWord,
                Reason = "timeout"
            });

            return;
        }

        await CheckAndRevealHintAsync(room, gameService, elapsedPercentage);
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
