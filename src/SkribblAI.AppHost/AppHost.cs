var builder = DistributedApplication.CreateBuilder(args);

var redis = builder
    .AddRedis("redis")
    .WithRedisInsight();

var apiService = builder
    .AddProject<Projects.SkribblAI_Api>("apiservice")
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
    });

var webfrontend = builder
    .AddViteApp("webfrontend", "../SkribblAI.Web", "pnpm")
    .WithPnpmPackageInstallation()
    .WithEndpoint("http", e => e.Port = 9081)
    .WithEnvironment("BROWSER", "none")
    .WithUrl("", "Skribbl UI")
    .WithReference(apiService)
    .PublishAsDockerFile();

apiService
    .WithReference(webfrontend)
    .WithReference(redis);

var publicDevTunnel = builder
    .AddDevTunnel("public-dev-tunnel")
    .WithAnonymousAccess()
    .WithReference(webfrontend);

builder.Build().Run();
