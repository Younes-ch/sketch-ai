namespace SkribblAI.Api.Services;

public interface IGameService
{
    /// <summary> 
    /// Starts the game. Only host can call this. 
    /// </summary> 
    Task<bool> StartGameAsync(string roomCode, string connectionId);

    /// <summary> 
    /// Gets word choices for the current drawer. 
    /// </summary> 
    Task<List<string>?> GetWordChoicesAsync(string roomCode, string connectionId);

    /// <summary> 
    /// Drawer selects a word to draw. 
    /// </summary> 
    Task<bool> SelectWordAsync(string roomCode, string connectionId, string word);

    /// <summary> 
    /// Checks a player's guess. Returns true if correct. 
    /// </summary> 
    Task<bool> CheckGuessAsync(string roomCode, string connectionId, string guess);

    /// <summary> 
    /// Reveals a letter in the word hint for guessers.
    /// Returns the updated hint or null if not applicable.
    /// </summary> 
    Task<string?> RevealLetterAsync(string roomCode);

    /// <summary> 
    /// Called when round timer expires. 
    /// </summary> 
    Task EndRoundAsync(string roomCode);

    /// <summary> 
    /// Advances to next drawer or ends game. 
    /// </summary> 
    Task NextTurnAsync(string roomCode);

    /// <summary> 
    /// Gets the next drawer in rotation. 
    /// </summary> 
    Task<Player?> GetNextDrawerAsync(string roomCode);
}
