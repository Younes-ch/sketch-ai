using SkribblAI.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// SignalR
builder.Services.AddSignalR();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCorsPolicy", policy =>
    {
        var frontendUrl = builder.Configuration["services:frontend:http:0"] ?? "http://localhost:5173";

        policy.WithOrigins(frontendUrl)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // Required for SignalR
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
