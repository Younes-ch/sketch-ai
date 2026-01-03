namespace SketchAI.Api.Services.Game;

public class WordService : IWordService
{
    private readonly Dictionary<string, List<string>> _wordsByDifficulty;

    public WordService()
    {
        var wordsFilePath = Path.Combine(AppContext.BaseDirectory, "Data", "words.json");
        var wordsFileContent = File.ReadAllText(wordsFilePath);
        _wordsByDifficulty = JsonSerializer.Deserialize<Dictionary<string, List<string>>>(wordsFileContent) ?? [];
    }

    public List<string> GetRandomWords(int count = 3, string difficulty = "mixed")
    {
        List<string> wordPool = [];
        if (difficulty != "mixed")
        {
            if (!_wordsByDifficulty.ContainsKey(difficulty.ToLower()))
            {
                throw new ArgumentException($"Invalid difficulty: {difficulty}", nameof(difficulty));
            }

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
        var hintChars = word.Select(c => char.IsWhiteSpace(c) ? ' ' : '_');
        return string.Join(" ", hintChars);
    }

    public string RevealLetter(string word, string currentHint)
    {
        var isMultiWord = word.Contains(' ');
        if (isMultiWord)
        {
            var wordParts = word.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var hintParts = currentHint.Split("   ", StringSplitOptions.RemoveEmptyEntries);

            if (hintParts.Length != wordParts.Length)
            {
                throw new InvalidOperationException(
                    $"Hint format mismatch: expected {wordParts.Length} parts but found {hintParts.Length}");
            }

            var newHintParts = new List<string>();
            var randomWordPartIndex = Random.Shared.Next(wordParts.Length);
            var randomWordPart = wordParts[randomWordPartIndex];

            for (var i = 0; i < wordParts.Length; i++)
            {
                if (i == randomWordPartIndex)
                {
                    var revealedPart = RevealLetter(randomWordPart, hintParts[i]);
                    newHintParts.Add(revealedPart);
                }
                else
                {
                    newHintParts.Add(hintParts[i]);
                }
            }

            return string.Join("   ", newHintParts);
        }

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

    public bool IsCloseGuess(string word, string guess)
    {
        if (string.IsNullOrWhiteSpace(guess)) return false;

        var normalizedWord = word.ToLowerInvariant().Trim();
        var normalizedGuess = guess.ToLowerInvariant().Trim();

        if (normalizedWord == normalizedGuess) return false;

        if (Math.Abs(normalizedWord.Length - normalizedGuess.Length) > 1) return false;

        var distance = LevenshteinDistance(normalizedWord, normalizedGuess);

        var threshold = normalizedWord.Length <= 4 ? 1 : normalizedWord.Length <= 7 ? 2 : 3;
        return distance > 0 && distance <= threshold;
    }

    private static int LevenshteinDistance(string str1, string str2)
    {
        int m = str1.Length;
        int n = str2.Length;

        // Create a matrix to store distances
        var dp = new int[m + 1, n + 1];

        // Initialize the first row and column of the matrix
        for (int i = 0; i <= m; i++)
        {
            dp[i, 0] = i; // Number of insertions required for str1 to become an empty string
        }
        for (int j = 0; j <= n; j++)
        {
            dp[0, j] = j; // Number of insertions required for an empty string to become str2
        }

        // Fill in the matrix with minimum edit distances
        for (int i = 1; i <= m; i++)
        {
            for (int j = 1; j <= n; j++)
            {
                if (str1[i - 1] == str2[j - 1])
                {
                    dp[i, j] = dp[i - 1, j - 1]; // Characters match, no operation needed
                }
                else
                {
                    // Choose the minimum of insert, delete, or replace operations
                    dp[i, j] = 1 + Math.Min(
                        dp[i, j - 1], // Insertion
                        Math.Min(
                            dp[i - 1, j], // Deletion
                            dp[i - 1, j - 1] // Replacement
                        )
                    );
                }
            }
        }
        return dp[m, n]; // Return the final edit distance
    }
}
