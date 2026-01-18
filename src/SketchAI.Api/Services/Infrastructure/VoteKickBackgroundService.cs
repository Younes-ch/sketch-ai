
namespace SketchAI.Api.Services.Infrastructure;

public class VoteKickBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<DrawingHub> _hubContext;
    private readonly ILogger<VoteKickBackgroundService> _logger;

    public VoteKickBackgroundService(
        IServiceScopeFactory scopeFactory,
        IHubContext<DrawingHub> hubContext,
        ILogger<VoteKickBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("VoteKickBackgroundService started");

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessActiveVoteKicksAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Error processing vote kicks in VoteKickBackgroundService");
            }
        }

        _logger.LogInformation("VoteKickbackgroundService stopped");
    }

    private async Task ProcessActiveVoteKicksAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var voteKickTimerService = scope.ServiceProvider.GetRequiredService<IVoteKickTimerService>();
        var roomService = scope.ServiceProvider.GetRequiredService<IRoomService>();

        var roomsWithActiveVoteKicks = await voteKickTimerService.GetRoomsWithActiveVoteKicksAsync();

        foreach (var room in roomsWithActiveVoteKicks)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                await ProcessVoteKickAsync(room, voteKickTimerService, roomService);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing vote kick for room {RoomCode}", room.Id);
            }
        }
    }

    private async Task ProcessVoteKickAsync(
        Room room,
        IVoteKickTimerService voteKickTimerService,
        IRoomService roomService)
    {
        var result = await voteKickTimerService.ProcessVoteKickExpirationAsync(room);

        if (result is null)
            return;

        await roomService.CancelVoteKickAsync(room.Id);
        await voteKickTimerService.RemoveFromActiveVoteKicksAsync(room.Id);

        if (result.ShouldKick)
        {
            await _hubContext.Clients.Client(result.TargetConnectionId).SendAsync("Kicked", "You have been kicked by vote");
            await roomService.RemovePlayerFromRoomAsync(room.Id, result.TargetConnectionId);

            await _hubContext.Clients.Group(room.Id).SendAsync("PlayerLeft", result.TargetUsername);
        }

        await _hubContext.Clients.Group(room.Id).SendAsync("VoteKickEnded", new
        {
            result.TargetUsername,
            result.ShouldKick,
            result.VotesToKick,
            result.VotesToKeep,
            TimedOut = true
        });
    }

}
