namespace SketchAI.Api.Services.Game;

public class VoteKickTimerService : IVoteKickTimerService
{
    private readonly IDatabase _db;
    private readonly ILogger<VoteKickTimerService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public VoteKickTimerService(
        IConnectionMultiplexer redis,
        ILogger<VoteKickTimerService> logger)
    {
        _db = redis.GetDatabase();
        _logger = logger;
    }
    public async Task<List<Room>> GetRoomsWithActiveVoteKicksAsync()
    {
        var roomCodes = await RedisHelper.SafeExecuteAsync(
            () => _db.SetMembersAsync(RedisKeys.ActiveVoteKicks),
            _logger,
            $"GetRoomsWithActiveVoteKicks") ?? [];
        var rooms = new List<Room>();

        foreach (var roomCode in roomCodes)
        {
            var roomJson = await RedisHelper.SafeExecuteAsync(
                () => _db.StringGetAsync(RedisKeys.Room(roomCode!)),
                _logger,
                $"GetRoomWithActiveVoteKick:{roomCode}");

            if (roomJson.HasValue)
            {
                var room = JsonSerializer.Deserialize<Room>(roomJson.ToString(), JsonOptions);
                if (room?.ActiveVoteKick is not null)
                {
                    rooms.Add(room);
                }
            }
        }

        return rooms;
    }

    public async Task AddToActiveVoteKicksAsync(string roomCode)
    {
        await RedisHelper.SafeExecuteAsync(
            () => _db.SetAddAsync(RedisKeys.ActiveVoteKicks, roomCode),
            _logger,
            $"AddToActiveVoteKicks:{roomCode}");
    }

    public async Task RemoveFromActiveVoteKicksAsync(string roomCode)
    {
        await RedisHelper.SafeExecuteAsync(
            () => _db.SetRemoveAsync(RedisKeys.ActiveVoteKicks, roomCode),
            _logger,
            $"RemoveFromActiveVoteKicks:{roomCode}");
    }
}
