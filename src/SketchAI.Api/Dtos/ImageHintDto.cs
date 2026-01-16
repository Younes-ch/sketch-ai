namespace SketchAI.Api.Dtos;

public record ImageHintDto(string Word, string? Preset, List<string> ImageUrls);
