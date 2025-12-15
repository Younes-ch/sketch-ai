namespace SkribblAI.Api.Services;

public class WordService : IWordService
{
    private readonly Dictionary<string, List<string>> _wordsByDifficulty;

    public WordService()
    {
        var wordsFilePath = Path.Combine(AppContext.BaseDirectory, "Data", "words.json");
        var wordsFileContent = File.ReadAllText(wordsFilePath);
        _wordsByDifficulty = JsonSerializer.Deserialize<Dictionary<string, List<string>>>(wordsFileContent) ?? [];
    }

    public List<string> GetRandomWords(int count = 3, string? difficulty = null)
    {
        List<string> wordPool = [];
        if (difficulty is not null)
        {
            wordPool = _wordsByDifficulty[difficulty.ToLower()];
        }
        else
        {
            foreach (var diff in _wordsByDifficulty.Keys)
            {
                wordPool.AddRange(_wordsByDifficulty[diff]);
            }
        }

        return wordPool.Shuffle().Take(count).ToList();
    }

    public string GetWordHint(string word)
    {
        return string.Join(" ", word.Select(_ => "_"));
    }

    public string RevealLetter(string word, string currentHint)
    {
        var currentHintCharArray = currentHint.Split(" ", StringSplitOptions.RemoveEmptyEntries);
        var concatenatedCurrentHint = string.Join("", currentHintCharArray);
        List<int> underscoreIndexes = [];
        for (var i = 0; i < concatenatedCurrentHint.Length; i++)
        {
            if (concatenatedCurrentHint[i] == '_')
            {
                underscoreIndexes.Add(i);
            }
        }

        var letterIndexToReveal = underscoreIndexes.Shuffle().First();
        var newHint = concatenatedCurrentHint.Select((c, i) => i == letterIndexToReveal ? word[letterIndexToReveal] : c);
        return string.Join(" ", newHint);
    }

    public bool CheckGuess(string word, string guess)
    {
        return string.Equals(word, guess, StringComparison.OrdinalIgnoreCase);
    }
}
