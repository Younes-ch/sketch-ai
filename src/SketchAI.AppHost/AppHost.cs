using Aspire.Hosting.Azure;

var builder = DistributedApplication.CreateBuilder(args);

// ===== Parameters (Secrets) =====
var p_githubModelsApiKey = builder.AddParameter("gh-models-api-key", secret: true);
var p_googleGeminiApiKey = builder.AddParameter("google-gemini-api-key", secret: true);
var p_serperApiKey = builder.AddParameter("serper-api-key", secret: true);
var p_turnstileSiteKey = builder.AddParameter("turnstile-site-key", secret: false);
var p_turnstileSecretKey = builder.AddParameter("turnstile-secret-key", secret: true);

#pragma warning disable ASPIRECOMPUTE003
// ===== Azure Infrastructure (for deployment) =====
var containerRegistry = builder.AddAzureContainerRegistry("sketchai-acr");
var acaEnv = builder.AddAzureContainerAppEnvironment("sketchai-aca-env")
    .WithContainerRegistry(containerRegistry);
#pragma warning restore ASPIRECOMPUTE003

IResourceBuilder<AzureApplicationInsightsResource>? appInsights = null;
if (builder.ExecutionContext.IsPublishMode)
{
    appInsights = builder.AddAzureApplicationInsights("sketchai-appinsights");
}

// ===== Infrastructure =====
var redis = builder.AddRedis("redis")
    .WithLifetime(ContainerLifetime.Persistent)
    .WithDataVolume("redis-data");

if (builder.ExecutionContext.IsRunMode)
{
    // Local development: add RedisInsight for debugging
    redis.WithRedisInsight(r => r
        .WithHostPort(5540)
        .WithLifetime(ContainerLifetime.Persistent));
}

// GitHub Models (AI)
var gpt4OMini = builder
    .AddGitHubModel("gpt-4o-mini", Aspire.Hosting.GitHub.GitHubModel.OpenAI.OpenAIGpt4oMini)
    .WithApiKey(p_githubModelsApiKey);

// ===== API Service =====
var apiService = builder
    .AddProject<Projects.SketchAI_Api>("sketchai-api")
    .WithExternalHttpEndpoints()
    .WithReference(redis).WaitFor(redis)
    .WithReference(gpt4OMini)
    .WithChildRelationship(gpt4OMini)
    .WithEnvironment("GOOGLE_GEMINI_KEY", p_googleGeminiApiKey)
    .WithEnvironment("SERPER_API_KEY", p_serperApiKey)
    .WithEnvironment("TURNSTILE_SITE_KEY", p_turnstileSiteKey)
    .WithEnvironment("TURNSTILE_SECRET_KEY", p_turnstileSecretKey);

// ===== Web Frontend =====
if (builder.ExecutionContext.IsPublishMode)
{
    // Production: Docker container with nginx
    var webDockerfile = builder.AddDockerfile("sketchai-web", "../SketchAI.Web", "Dockerfile")
        .WithHttpEndpoint(targetPort: 80, name: "http")
        .WithExternalHttpEndpoints()
        .WithEnvironment("PORT", "80")
        .WithEnvironment("API_URL", apiService.GetEndpoint("https"))
        .WithEnvironment("TURNSTILE_SITE_KEY", p_turnstileSiteKey)
        .WithReference(apiService).WaitFor(apiService);

    if (appInsights != null)
    {
        webDockerfile.WithReference(appInsights);
        apiService.WithReference(appInsights);
    }
}
else
{
    // Development: Vite dev server with proxy
    builder.AddViteApp("sketchai-web", "../SketchAI.Web")
        .WithNpm()
        .WithExternalHttpEndpoints()
        .WithEndpoint("http", e => e.Port = 9081)
        .WithEnvironment("BROWSER", "none")
        .WithEnvironment("TURNSTILE_SITE_KEY", p_turnstileSiteKey)
        .WithReference(apiService).WaitFor(apiService);

    // ===== OpenAPI Docs Annotation =====
    apiService.WithUrls(context =>
    {
        foreach (var url in context.Urls)
        {
            url.DisplayLocation = UrlDisplayLocation.DetailsOnly;
        }

        context.Urls.Add(new ResourceUrlAnnotation
        {
            Url = "/docs",
            DisplayText = "OpenAPI Docs",
            Endpoint = context.GetEndpoint("https")
        });
    });
}

builder.Build().Run();
