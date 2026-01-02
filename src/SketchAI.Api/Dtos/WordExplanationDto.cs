namespace SketchAI.Api.Dtos;

public record WordExplanationDto(
    string Word,
    string TargetLanguage,
    string Translation,
    string SimpleExplanation);
