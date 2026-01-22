using System.Text.Json;

namespace SketchAI.Api.Services.Captcha;

/// <summary>
/// Cloudflare Turnstile CAPTCHA verification service.
/// </summary>
public class TurnstileCaptchaService : ICaptchaService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TurnstileCaptchaService> _logger;
    private const string VerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public TurnstileCaptchaService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<TurnstileCaptchaService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> VerifyAsync(string? token, CancellationToken ct = default)
    {
        var secretKey = _configuration["TURNSTILE_SECRET_KEY"];

        // If CAPTCHA is not configured, allow all requests (development mode)
        if (string.IsNullOrEmpty(secretKey))
        {
            _logger.LogDebug("CAPTCHA not configured - allowing request");
            return true;
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("CAPTCHA verification failed: empty token");
            return false;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var payload = new Dictionary<string, string>
            {
                ["secret"] = secretKey,
                ["response"] = token
            };

            var response = await client.PostAsync(
                VerifyUrl,
                new FormUrlEncodedContent(payload),
                ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("CAPTCHA verification request failed with status {StatusCode}", response.StatusCode);
                return false;
            }

            var content = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<TurnstileResponse>(content, JsonOptions);

            if (result?.Success == true)
            {
                _logger.LogDebug("CAPTCHA verification successful");
                return true;
            }

            _logger.LogWarning("CAPTCHA verification failed: {ErrorCodes}",
                string.Join(", ", result?.ErrorCodes ?? []));
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CAPTCHA verification error");
            // Fail open in case of service issues to not block legitimate users
            // You can change this to fail closed (return false) for stricter security
            return true;
        }
    }

    private sealed class TurnstileResponse
    {
        public bool Success { get; set; }
        public string? ChallengeTs { get; set; }
        public string? Hostname { get; set; }
        public List<string>? ErrorCodes { get; set; }
    }
}
