var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddRedisClient(connectionName: "redis");
builder.AddOpenAIClient("gpt-4o-mini")
       .AddKeyedChatClient("gpt-4o-mini")
       .UseFunctionInvocation();

builder.Services.AddGoogleModels(builder.Configuration);

// Controllers & OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Application Services
builder.Services.AddSingleton<IDistributedLockProvider, RedisDistributedLockProvider>();
builder.Services.AddSingleton<IRoomService, RoomService>();
builder.Services.AddSingleton<ICanvasService, CanvasService>();
builder.Services.AddSingleton<IWordService, WordService>();
builder.Services.AddSingleton<IGameService, GameService>();
builder.Services.AddSingleton<IAIWordExplanationService, AIWordExplanationService>();
builder.Services.AddSingleton<IAIProviderSelector, AIProviderSelector>();
builder.Services.AddSingleton<IAIDrawingService, AIDrawingService>();
builder.Services.AddSingleton<IWordExplanationService, WordExplanationService>();
builder.Services.AddSingleton<IAIDrawingCancellationManager, AIDrawingCancellationManager>();
builder.Services.AddSingleton<IImageHintService, ImageHintService>();
builder.Services.AddSingleton<IVoteKickTimerService, VoteKickTimerService>();

// HTTP clients for external APIs
builder.Services.AddHttpClient("SerperClient", client =>
{
    var serperApiKey = builder.Configuration["SERPER_API_KEY"]
        ?? throw new InvalidOperationException("Serper Api Key is not configured");
    client.BaseAddress = new Uri("https://google.serper.dev");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.DefaultRequestHeaders.Add("X-API-KEY", serperApiKey);
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Background services
builder.Services.AddHostedService<RoundTimerBackgroundService>();
builder.Services.AddHostedService<VoteKickBackgroundService>();
builder.Services.AddHostedService<RateLimiterCleanupService>();

// TimeProvider
builder.Services.AddSingleton(TimeProvider.System);

// SignalR
builder.Services.AddSignalR(config =>
{
    config.AddFilter<HubExceptionFilter>();
    config.AddFilter<RateLimitingHubFilter>();
});

// CORS - allow frontend to connect
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            var uri = new Uri(origin);

            // Development: localhost and dev tunnels
            if (uri.Host == "localhost" || uri.Host.EndsWith(".devtunnels.ms"))
                return true;

            // Production: Azure Container Apps
            if (uri.Host.EndsWith(".azurecontainerapps.io"))
                return true;

            return false;
        })
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

// Configuration
builder.Services.Configure<GameSettings>(builder.Configuration.GetSection("GameSettings"));
builder.Services.Configure<AiProviderSettings>(builder.Configuration.GetSection("AiProviders"));
builder.Services.Configure<RateLimiterCleanupConfig>(builder.Configuration.GetSection("RateLimiterCleanup"));

// Forwarded Headers - for reverse proxy scenarios (Azure Container Apps, nginx, etc.)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // In containerized environments, trust all proxies since IPs are dynamic
    options.ForwardLimit = null;
    options.KnownProxies.Clear();
    options.KnownIPNetworks.Clear();
});

var app = builder.Build();

// Middleware pipeline
app.UseForwardedHeaders();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs", options =>
    {
        options.WithTitle("SketchAI API")
               .ForceDarkMode()
               .ShowOperationId()
               .WithTheme(ScalarTheme.BluePlanet);
    });

    app.UseHttpsRedirection();
}

app.UseAuthorization();
app.MapControllers();
app.MapHub<DrawingHub>("/hubs/drawing");
app.MapDefaultEndpoints();

app.Run();
