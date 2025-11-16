var builder = DistributedApplication.CreateBuilder(args);

var api = builder
    .AddProject<Projects.SkribblAI_Api>("api")
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

var frontend = builder
    .AddPnpmApp("frontend", "../SkribblAI.Web", "dev")
    .WithPnpmPackageInstallation()
    .WithReference(api)
    .WithEnvironment("BROWSER", "none")
    .WithHttpEndpoint(env: "VITE_PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

api.WithReference(frontend);

builder.Build().Run();
