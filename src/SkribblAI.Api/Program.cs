var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddRedisClient(connectionName: "redis");

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<IRoomService, RoomService>();
builder.Services.AddSingleton<ICanvasService, CanvasService>();
builder.Services.AddSingleton<IWordService, WordService>();
builder.Services.AddSingleton<IGameService, GameService>();

// Background services
builder.Services.AddHostedService<RoundTimerService>();

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

// Add rate limiting
builder.Services.AddRateLimiter(options =>
{
    // Policy for drawing commands: 60 requests per second per connection
    options.AddPolicy("drawing", context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: context.Connection.Id,
            factory: _ => new SlidingWindowRateLimiterOptions()
            {
                PermitLimit = 60,
                Window = TimeSpan.FromSeconds(1),
                SegmentsPerWindow = 6,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Policy for chat/guessing: 5 messages per second per connection
    options.AddPolicy("chat", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.Id,
            factory: _ => new FixedWindowRateLimiterOptions()
            {
                PermitLimit = 5,
                Window = TimeSpan.FromSeconds(1),
                QueueLimit = 0
            }));

    // Policy for room creation: 2 per minute per IP
    options.AddPolicy("roomCreation", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions()
            {
                PermitLimit = 2,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// Register Configuration
builder.Services.Configure<GameSettings>(builder.Configuration.GetSection("GameSettings"));

var app = builder.Build();

app.UseRateLimiter();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs", options =>
    {
        options.WithTitle("SkribblAI API")
               .ForceDarkMode()
               .ShowOperationId()
               .WithTheme(ScalarTheme.BluePlanet);
    });
}

app.UseCors("DevCorsPolicy");

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapHub<DrawingHub>("/hubs/drawing");

app.Run();
