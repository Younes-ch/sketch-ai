namespace SketchAI.Api.Services.Game;

public interface IWordService
{
    /// <summary> 
    /// Gets random words for the drawer to choose from. 
    /// </summary> 
    /// <param name="count">Number of words to return (usually 3).</param> 
    /// <param name="difficulty">Optional difficulty filter.</param> 
    /// <returns>List of random words.</returns> 
    List<string> GetRandomWords(int count = 3, string difficulty = "mixed");

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
