namespace SketchAI.Api.Dtos;

/// <summary>
/// Represents a paginated result of public rooms.
/// </summary>
public class PaginatedPublicRoomsDto
{
    public required List<PublicRoomDto> Rooms { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}

/// <summary>
/// Represents a public room in the paginated response.
/// </summary>
public class PublicRoomDto
{
    public required string RoomCode { get; set; }
    public int PlayerCount { get; set; }
    public int MaxPlayers { get; set; }
    public string? HostUsername { get; set; }
}
