namespace SketchAI.Api.Services.AI;

public interface IWordExplanationService
{
    Task<WordExplanationDto> ExplainWordAsync(string word, string targetLanguage, CancellationToken ct = default);
}
