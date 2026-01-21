#pragma warning disable ASPIRECOMPUTE003 // Preview APIs for Azure Container Apps

var builder = DistributedApplication.CreateBuilder(args);

// ===== Parameters (Secrets) =====
var githubModelsApiKey = builder.AddParameter("gh-models-api-key", secret: true);
var googleGeminiApiKey = builder.AddParameter("google-gemini-api-key", secret: true);
var serperApiKey = builder.AddParameter("serper-api-key", secret: true);

// ===== Azure Infrastructure (for deployment) =====
var containerRegistry = builder.AddAzureContainerRegistry("sketchai-acr");
var acaEnv = builder.AddAzureContainerAppEnvironment("sketchai-aca-env")
    .WithContainerRegistry(containerRegistry);

// ===== Infrastructure =====
// Redis container (works on both local and Azure Container Apps)
var redis = builder.AddRedis("redis");

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
    builder.AddDockerfile("sketchai-web", "../SketchAI.Web", "Dockerfile")
        .WithHttpEndpoint(targetPort: 80, name: "http")
        .WithExternalHttpEndpoints()
        .WithEnvironment("PORT", "80")
        .WithEnvironment("API_URL", apiService.GetEndpoint("https"))
        .WithReference(apiService).WaitFor(apiService);
}
else
{
    // Development: Vite dev server with proxy
    builder.AddViteApp("sketchai-web", "../SketchAI.Web")
        .WithNpm()
        .WithExternalHttpEndpoints()
        .WithEnvironment("BROWSER", "none")
        .WithReference(apiService).WaitFor(apiService);
}

builder.Build().Run();
