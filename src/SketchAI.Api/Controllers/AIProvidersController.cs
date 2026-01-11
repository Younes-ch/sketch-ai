namespace SketchAI.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIProvidersController : ControllerBase
{
    private readonly IAIProviderSelector _providerSelector;
    private readonly ILogger<AIProvidersController> _logger;

    public AIProvidersController(
        IAIProviderSelector providerSelector,
        ILogger<AIProvidersController> logger)
    {
        _providerSelector = providerSelector;
        _logger = logger;
    }

    /// <summary>
    /// Gets the status of all AI providers including their rate limit status.
    /// </summary>
    [HttpGet("status")]
    public ActionResult<IReadOnlyDictionary<string, ProviderStatus>> GetStatus()
    {
        var statuses = _providerSelector.GetProviderStatuses();
        return Ok(statuses);
    }

    /// <summary>
    /// Resets the rate limit status for a specific provider.
    /// </summary>
    /// <param name="serviceKey">The service key of the provider to reset (e.g., "gemini-model", "gpt-41")</param>
    [HttpPost("{serviceKey}/reset")]
    public IActionResult ResetProvider(string serviceKey)
    {
        _logger.LogInformation("Manual reset requested for provider: {ServiceKey}", serviceKey);
        _providerSelector.ResetProviderStatus(serviceKey);
        return Ok(new { message = $"Provider {serviceKey} rate limit status reset" });
    }

    /// <summary>
    /// Resets the rate limit status for all providers.
    /// </summary>
    [HttpPost("reset-all")]
    public IActionResult ResetAllProviders()
    {
        _logger.LogInformation("Manual reset requested for all providers");
        _providerSelector.ResetAllProviders();
        return Ok(new { message = "All providers rate limit status reset" });
    }

    /// <summary>
    /// Gets which provider would be selected for the next request.
    /// </summary>
    [HttpGet("current")]
    public ActionResult<object> GetCurrentProvider()
    {
        var (client, serviceKey) = _providerSelector.GetAvailableProvider();

        if (client is null)
        {
            return Ok(new
            {
                available = false,
                message = "No providers available"
            });
        }

        var statuses = _providerSelector.GetProviderStatuses();
        var currentStatus = statuses.TryGetValue(serviceKey!, out var status) ? status : null;

        return Ok(new
        {
            available = true,
            serviceKey,
            name = currentStatus?.Name,
            priority = currentStatus?.Priority
        });
    }
}
