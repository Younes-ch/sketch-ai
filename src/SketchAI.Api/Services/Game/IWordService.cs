namespace SketchAI.Api.Services.Game;

public interface IWordService
{
    /// <summary> 
    /// Gets random words for the drawer to choose from. 
    /// </summary> 
    /// <param name="count">Number of words to return.</param> 
    /// <param name="difficulty">Optional difficulty filter.</param> 
    /// <returns>List of random words.</returns> 
    List<string> GetRandomWordsByDifficulty(int count = 3, string difficulty = "mixed");

    /// <summary>
    /// Gets random words from a specific preset category.
    /// </summary>
    /// <param name="presetName">The name of the preset (e.g., "lol-champions", "animals").</param>
    /// <param name="count">Number of words to return.</param>
    /// <returns>List of random words from the preset.</returns>
    List<string> GetRandomWordsFromPreset(string presetName, int count = 3);

    /// <summary>
    /// Gets random words from a custom word list.
    /// </summary>
    /// <param name="customWords">Comma-separated list of custom words.</param>
    /// <param name="count">Number of words to return.</param>
    /// <returns>List of random words from the custom list.</returns>
    List<string> GetRandomWordsFromCustomList(string customWords, int count = 3);

    /// <summary>
    /// Gets random words based on room settings (handles difficulty, presets, or custom words).
    /// </summary>
    /// <param name="settings">Room settings containing word configuration.</param>
    /// <returns>List of random words.</returns>
    List<string> GetRandomWordsForRoom(RoomSettingsDto settings);

    /// <summary>
    /// Gets all available word preset names.
    /// </summary>
    /// <returns>List of preset names.</returns>
    List<string> GetAvailablePresets();

    /// <summary> 
    /// Generates a hint string with all letters hidden. 
    /// Example: "apple" → "_ _ _ _ _"
    /// </summary>
    string GetWordHint(string word);

    /// <summary> 
    /// Reveals one random unrevealed letter in the hint. 
    /// Example: "_ _ _ _ _" with word "apple" → "a _ _ _ _" 
    /// </summary> 
    string RevealLetter(string word, string currentHint);

    /// <summary> 
    /// Checks if a guess matches the word (case-insensitive). 
    /// </summary> 
    bool CheckGuess(string word, string guess);

    /// <summary>
    /// Checks if a guess is close to the word (contains most characters).
    /// </summary>
    bool IsCloseGuess(string word, string guess);
}
