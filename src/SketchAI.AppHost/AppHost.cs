var builder = DistributedApplication.CreateBuilder(args);

var redis = builder
    .AddRedis("redis")
    .WithRedisInsight();

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
