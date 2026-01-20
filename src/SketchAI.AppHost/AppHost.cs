var builder = DistributedApplication.CreateBuilder(args);

// ===== Parameters (Secrets) =====
var githubModelsApiKey = builder.AddParameter("gh-models-api-key", secret: true);
var googleGeminiApiKey = builder.AddParameter("google-gemini-api-key", secret: true);
var serperApiKey = builder.AddParameter("serper-api-key", secret: true);

// ===== Infrastructure =====
// Redis: Container locally, Azure Managed Redis in production
IResourceBuilder<IResourceWithConnectionString> redis;

if (builder.ExecutionContext.IsRunMode)
{
    // Local development: Redis container with RedisInsight
    var redisContainer = builder.AddRedis("redis");
    redisContainer.WithRedisInsight(r => r
        .WithHostPort(5540)
        .WithLifetime(ContainerLifetime.Persistent));
    redis = redisContainer;
}
else
{
    // Production: Azure Managed Redis
    redis = builder.AddAzureManagedRedis("redis");
}

// GitHub Models (AI)
var gpt4OMini = builder
    .AddGitHubModel("gpt-4o-mini", Aspire.Hosting.GitHub.GitHubModel.OpenAI.OpenAIGpt4oMini)
    .WithApiKey(githubModelsApiKey);

// ===== API Service =====
var apiService = builder
    .AddProject<Projects.SketchAI_Api>("sketchai-api")
    .WithExternalHttpEndpoints()
    .WithReference(redis).WaitFor(redis)
    .WithReference(gpt4OMini)
    .WithEnvironment("GOOGLE_GEMINI_KEY", googleGeminiApiKey)
    .WithEnvironment("SERPER_API_KEY", serperApiKey);

// ===== Web Frontend =====
if (builder.ExecutionContext.IsPublishMode)
{
    // Production: Docker container with nginx
    builder.AddDockerfile("sketch-ai", "../SketchAI.Web", "Dockerfile")
        .WithHttpEndpoint(targetPort: 80, name: "http")
        .WithExternalHttpEndpoints()
        .WithEnvironment("PORT", "80")
        .WithEnvironment("API_URL", apiService.GetEndpoint("https"))
        .WithReference(apiService).WaitFor(apiService);
}
else
{
    // Development: Vite dev server with proxy
    builder.AddViteApp("webfrontend", "../SketchAI.Web")
        .WithNpm()
        .WithExternalHttpEndpoints()
        .WithEnvironment("BROWSER", "none")
        .WithReference(apiService).WaitFor(apiService);
}

builder.Build().Run();
