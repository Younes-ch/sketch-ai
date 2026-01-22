namespace SketchAI.Api.Services.Captcha;

/// <summary>
/// Service interface for verifying CAPTCHA tokens.
/// </summary>
public interface ICaptchaService
{
    /// <summary>
    /// Verifies a CAPTCHA token.
    /// </summary>
    /// <param name="token">The CAPTCHA token from the client.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>True if the token is valid, false otherwise.</returns>
    Task<bool> VerifyAsync(string? token, CancellationToken ct = default);
}
