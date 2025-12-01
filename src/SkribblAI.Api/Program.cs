using SkribblAI.Api.Hubs.Filters;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddRedisClient(connectionName: "redis");

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<IRoomService, RoomService>();
builder.Services.AddSingleton<ICanvasService, CanvasService>();

// SignalR
builder.Services.AddSignalR(config =>
{
    config.AddFilter<HubExceptionFilter>();
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

var app = builder.Build();

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

app.UseHttpsRedirection();

app.UseCors("DevCorsPolicy");

app.UseAuthorization();

app.MapControllers();

app.MapHub<DrawingHub>("/hubs/drawing");

app.Run();
