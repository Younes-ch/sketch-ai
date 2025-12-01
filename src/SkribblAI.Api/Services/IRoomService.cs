namespace SkribblAI.Api.Services;

public interface IRoomService
{
    Task<Room> CreateRoomAsync(string roomCode, bool isPublic, string hostConnectionId, string hostUsername);
    Task<Room?> GetRoomAsync(string roomCode);
    Task<List<Room>> GetPublicRoomsAsync();
    Task<bool> IsRoomFullAsync(string roomCode);
    Task<bool> RoomExistsAsync(string roomCode);
    Task<Player?> AddPlayerToRoomAsync(string roomCode, string connectionId, string username);
    Task<bool> RemovePlayerFromRoomAsync(string roomCode, string connectionId);
    Task<bool> DeleteRoomAsync(string roomCode);
    Task UpdateLastActivityAsync(string roomCode);
    Task<Player?> GetPlayerByConnectionIdAsync(string roomCode, string connectionId);
    Task<string?> GetRoomCodeByConnectionIdAsync(string connectionId);
}
