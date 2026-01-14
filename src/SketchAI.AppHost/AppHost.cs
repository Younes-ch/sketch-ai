var builder = DistributedApplication.CreateBuilder(args);

var redis = builder
    .AddRedis("redis")
    .WithRedisInsight(resourceBuilder => resourceBuilder.WithHostPort(5540));

var p_githubModelsApiKey = builder.AddParameter("gh-models-api-key", secret: true);
var p_googleGeminiApiKey = builder.AddParameter("google-gemini-api-key", secret: true);
var p_googleGeminiModelId = builder.AddParameter("google-gemini-model-id");

var gpt4OMini = builder
    .AddGitHubModel("gpt-4o-mini", Aspire.Hosting.GitHub.GitHubModel.OpenAI.OpenAIGpt4oMini)
    .WithApiKey(p_githubModelsApiKey);

var apiService = builder
    .AddProject<Projects.SketchAI_Api>("apiservice")
    .WithUrls(context =>
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
    })
    .WithReference(redis)
    .WithReference(gpt4OMini)
    .WithEnvironment("GOOGLE_GEMINI_KEY", p_googleGeminiApiKey)
    .WithEnvironment("GOOGLE_GEMINI_MODEL_ID", p_googleGeminiModelId)
    .WaitFor(redis);

var webfrontend = builder
    .AddViteApp("webfrontend", "../SketchAI.Web")
    .WithPnpm()
    .WithEndpoint("http", e => e.Port = 9081)
    .WithEnvironment("BROWSER", "none")
    .WithUrl("", "Sketch UI")
    .WithReference(apiService)
    .WaitFor(apiService)
    .PublishAsDockerFile();

var publicDevTunnel = builder
    .AddDevTunnel("public-dev-tunnel")
    .WithAnonymousAccess()
    .WithReference(webfrontend)
    .WaitFor(webfrontend);

builder.Build().Run();
