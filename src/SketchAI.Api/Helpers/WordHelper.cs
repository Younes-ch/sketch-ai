namespace SketchAI.Api.Helpers;

public static class WordHelper
{
    /// <summary>
    /// Sanitizes word input by limiting length and removing potentially dangerous characters.
    /// </summary>
    public static string SanitizeWord(string word)
    {
        // Maximum allowed length for word input
        const int maxWordLength = 50;

        if (string.IsNullOrWhiteSpace(word))
            return string.Empty;

        var sanitized = word.Trim();
        if (sanitized.Length > maxWordLength)
            sanitized = sanitized[..maxWordLength];

        sanitized = new string(sanitized.Where(c =>
            char.IsLetterOrDigit(c) || c == ' ' || c == '-' || c == '\'').ToArray());

        return sanitized.Trim();
    }
}
