namespace SketchAI.Api.Services;

public interface IWordExplanationService
{
    Task<WordExplanationDto> ExplainWordAsync(string word, string targetLanguage, CancellationToken ct = default);
}
