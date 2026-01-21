namespace SketchAI.Api.Extensions;

public static class PlayerExtensions
{
    /// <summary>
    /// Maps a Player model to a PlayerDto.
    /// </summary>
    public static PlayerDto ToDto(this Player player) => new()
    {
        Username = player.Username,
        Score = player.Score,
        IsHost = player.IsHost,
    };

}
