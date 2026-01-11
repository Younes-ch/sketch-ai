var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddRedisClient(connectionName: "redis");
builder.AddOpenAIClient("gpt-4o-mini")
       .AddKeyedChatClient("gpt-4o-mini")
       .UseFunctionInvocation();

var options = new GeminiClientOptions
{
    ApiKey = builder.Configuration["AI:ApiKey"] ?? throw new InvalidOperationException("Gemini API key is not configured."),
    ModelId = builder.Configuration["AI:ModelId"] ?? "gemini-3-flash-preview",
};

builder.Services.AddKeyedChatClient("gemini-model", new GeminiChatClient(options))
                .UseFunctionInvocation();


// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();
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

// Background services
builder.Services.AddHostedService<RoundTimerService>();
builder.Services.AddHostedService<RateLimiterCleanupService>();

// TimeProvider
builder.Services.AddSingleton(TimeProvider.System);

// SignalR
builder.Services.AddSignalR(config =>
{
    config.AddFilter<HubExceptionFilter>();
    config.AddFilter<RateLimitingHubFilter>();
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            {
                var uri = new Uri(origin);
                return uri.Host.EndsWith(".devtunnels.ms") ||
                       uri.Host == "localhost";
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Register Configuration
builder.Services.Configure<GameSettings>(builder.Configuration.GetSection("GameSettings"));
builder.Services.Configure<AiProviderSettings>(builder.Configuration.GetSection("AiProviders"));
builder.Services.Configure<RateLimiterCleanupConfig>(
    builder.Configuration.GetSection("RateLimiterCleanup"));

// Configure Forwarded Headers for proxy/load balancer scenarios
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    var proxyIps = builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>();
    if (proxyIps is not null)
    {
        foreach (var ip in proxyIps)
        {
            if (IPAddress.TryParse(ip, out var address))
            {
                options.KnownProxies.Add(address);
            }
            else
            {
                throw new InvalidOperationException($"Invalid proxy IP address in configuration: {ip}");
            }
        }
    }

    var networks = builder.Configuration.GetSection("ForwardedHeaders:KnownNetworks")
        .Get<List<NetworkConfig>>();

    if (networks is not null)
    {
        foreach (var network in networks)
        {
            if (IPAddress.TryParse(network.Prefix, out var prefix))
            {
                options.KnownIPNetworks.Add(new System.Net.IPNetwork(prefix, network.PrefixLength));
            }
            else
            {
                throw new InvalidOperationException($"Invalid network prefix in configuration: {network.Prefix}");
            }
        }
    }
});

var app = builder.Build();

// Configure the HTTP request pipeline.
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
}
app.UseForwardedHeaders();

app.UseCors("DevCorsPolicy");

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapHub<DrawingHub>("/hubs/drawing");

app.Run();
