# SketchAI

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Younes-ch/sketch-ai)

A real-time multiplayer drawing and guessing game powered by AI. Players take turns drawing words while others try to guess them. The game features AI-assisted drawing capabilities, intelligent word explanations, and image hints to enhance the gaming experience.

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Technologies](#technologies)
- [Algorithms and Mechanisms](#algorithms-and-mechanisms)
  - [AI Tool Calling](#ai-tool-calling)
  - [Prompt Engineering](#prompt-engineering)
  - [AI Provider Fallback with Circuit Breaker](#ai-provider-fallback-with-circuit-breaker)
  - [Caching Strategy](#caching-strategy)
  - [Real-time Communication with SignalR](#real-time-communication-with-signalr)
  - [Background Services](#background-services)
  - [Douglas-Peucker Algorithm](#douglas-peucker-algorithm)
  - [Levenshtein Distance](#levenshtein-distance)
  - [Flood Fill Algorithm](#flood-fill-algorithm)
  - [Distributed Locking](#distributed-locking)
  - [Rate Limiting](#rate-limiting)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Running with Aspire CLI](#running-with-aspire-cli)
- [Configuration](#configuration)
- [Important Notice](#important-notice)
- [License](#license)

---

## Features

- **Real-time Multiplayer**: Create or join rooms with 2-20 players
- **AI Drawing Assistant**: Let AI draw the word for you using function calling
- **Image Hints**: Get visual hints from web image search
- **Word Translation**: AI-powered word explanations in multiple languages
- **Customizable Games**: Configure rounds, draw time, difficulty, and word presets
- **Public/Private Rooms**: Browse public rooms or create private games
- **Vote Kick System**: Democratic player removal with timed voting
- **Responsive Design**: Works on desktop and mobile devices
- **CAPTCHA Protection**: Cloudflare Turnstile integration for bot prevention

---

## Architecture Overview

SketchAI is built using a modern cloud-native architecture with .NET Aspire for orchestration:

```
+------------------+     +------------------+     +------------------+
|   SketchAI.Web   |     |  SketchAI.Api    |     |      Redis       |
|  (React + Vite)  |<--->|  (ASP.NET Core)  |<--->|  (State + Cache) |
+------------------+     +------------------+     +------------------+
                               |
                               v
                    +--------------------+
                    |   AI Providers     |
                    | (GitHub Models,    |
                    |  Google Gemini)    |
                    +--------------------+
```

---

## Technologies

### Backend (.NET 10)

| Technology | Purpose |
| ------------ | --------- |
| ASP.NET Core | Web API and SignalR hub |
| .NET Aspire | Cloud-native orchestration and service discovery |
| SignalR | Real-time bidirectional communication |
| Redis | Distributed caching, state management, and pub/sub |
| Microsoft.Extensions.AI | Unified AI abstraction layer |
| Polly | Resilience and circuit breaker patterns |

### Frontend (React 19)

| Technology | Purpose |
| ------------ | --------- |
| React 19 | UI framework |
| TypeScript | Type-safe JavaScript |
| Vite (Rolldown) | Build tool and dev server |
| Zustand | State management |
| TailwindCSS 4 | Utility-first styling |
| Framer Motion | Animations |
| SignalR Client | Real-time communication |

### AI Services

| Provider | Models | Purpose |
| ---------- | -------- | --------- |
| Google Gemini | gemini-3-flash-preview, gemini-2.5-flash, gemini-2.5-flash-lite | AI drawing generation |
| GitHub Models | gpt-4o-mini | Word explanations and translations |

### Infrastructure

| Service | Purpose |
| --------- | --------- |
| Redis | Session state, canvas history, caching, distributed locks |
| Cloudflare Turnstile | CAPTCHA verification |
| Serper API | Image search for hints |
| Docker | Containerization and deployment |
| Azure | Cloud hosting and services |

---

## Algorithms and Mechanisms

### AI Tool Calling

The AI drawing feature uses function calling to generate drawing commands. Instead of generating images, the AI calls drawing functions that produce strokes and fills:

```csharp
var strokeTool = AIFunctionFactory.Create(
    (PointDto[] points, string color, int width) => DrawStroke(queue, points, color, width),
    name: "draw_stroke",
    description: "Draw a stroke on the canvas with the given points");

var fillTool = AIFunctionFactory.Create(
    (PointDto point, string color) => DrawFill(queue, point, color),
    name: "draw_fill",
    description: "Fill an area on the canvas starting from a point");
```

The AI model receives these tools and calls them to construct drawings programmatically, which are then streamed to clients in real-time.

### Prompt Engineering

Carefully crafted prompts guide the AI to produce quality drawings:

- **System prompt**: Restricts the AI to only call drawing functions, never output text
- **User prompt**: Provides canvas coordinates, drawing instructions, and the word to draw
- **Tool constraints**: Uses `ChatToolMode.RequireAny` to force function calling

The prompt includes:

- Normalized coordinate system (0.0-1.0) for resolution independence
- Suggested drawing approach (outlines first, then fills)
- Color and stroke width guidelines
- Critical rules to prevent text output

### AI Provider Fallback with Circuit Breaker

Multiple AI providers are configured with priority-based fallback:

```json
{
  "AiProviders": {
    "FallbackCooldownMinutes": 60,
    "Providers": [
      { "Name": "Google Gemini 3 Flash", "Priority": 1 },
      { "Name": "Google Gemini 2.5 Flash", "Priority": 2 },
      { "Name": "Google Gemini 2.5 Flash Lite", "Priority": 3 }
    ]
  }
}
```

When a provider hits rate limits or fails:

1. The `AIProviderSelector` marks it as unavailable
2. Requests automatically route to the next priority provider
3. Providers recover after the cooldown period

HTTP clients use Polly for resilience:

- Circuit breaker to prevent cascading failures
- Retry with exponential backoff
- Timeout handling

### Caching Strategy

Redis is used for multi-level caching:

| Cache Type | Key Pattern | TTL | Purpose |
| ------------ | ----------- | --- | ------- |
| Word Explanations | `word_explanation:{word}:{language}` | 7 Days | Cache AI translations |
| Image Hints | `image_hints:{word}:{preset}?` | 7 Days | Cache search results |
| Canvas History | `canvas:history:{roomCode}` | 1 hour | Store drawing commands |
| Room State | `room:{roomCode}` | 1 hour | Game state persistence |

### Real-time Communication with SignalR

SignalR enables real-time multiplayer functionality:

**Hub Methods**:

- `CreateRoom`, `JoinRoom` - Room management
- `SendDrawingCommand`, `ClearCanvas`, `Undo` - Canvas operations
- `SendGuess` - Chat and guessing
- `StartGame`, `SelectWord` - Game flow
- `RequestAIDrawing`, `RequestImageHint` - AI features
- `VoteKick`, `CastVoteKickVote` - Moderation

**Client Events**:

- `ReceiveDrawingCommand`, `CanvasCleared` - Canvas updates
- `GameStarted`, `RoundEnded`, `GameEnded` - Game state
- `PlayerJoined`, `PlayerLeft` - Player updates
- `CorrectGuess`, `CloseGuess` - Guess feedback

**Scaling**: Redis backplane enables horizontal scaling across multiple server instances.

### Background Services

Three hosted services handle asynchronous game logic:

**RoundTimerBackgroundService**:

- Monitors active drawing rooms every second
- Reveals hint letters at 25%, 50%, and 75% of draw time
- Ends rounds on timeout and advances to next turn
- Cancels AI drawing sessions when rounds end

**VoteKickBackgroundService**:

- Processes active vote kick sessions
- Expires votes after configured duration
- Executes kick if threshold reached

**RateLimiterCleanupService**:

- Periodically cleans up idle rate limiters
- Prevents memory leaks from abandoned connections

### Douglas-Peucker Algorithm

The frontend uses the Douglas-Peucker algorithm (via `simplify-js`) to reduce drawing complexity:

```typescript
import simplify from 'simplify-js';

// Reduce points while preserving shape
const simplified = simplify(points, tolerance, highQuality);
```

**Purpose**:

- Reduces network bandwidth by sending fewer points
- Maintains visual fidelity of strokes
- Improves rendering performance
- Configurable tolerance for quality vs. size trade-off

### Levenshtein Distance

The Levenshtein distance algorithm detects "close guesses" - when a player almost guessed correctly:

```csharp
public bool IsCloseGuess(string word, string guess)
{
    var distance = LevenshteinDistance(normalizedWord, normalizedGuess);
    var threshold = normalizedWord.Length <= 4 ? 1 
                  : normalizedWord.Length <= 7 ? 2 
                  : 3;
    return distance > 0 && distance <= threshold;
}
```

**Dynamic thresholds**:

- Words 1-4 characters: 1 edit allowed
- Words 5-7 characters: 2 edits allowed
- Words 8+ characters: 3 edits allowed

This provides helpful feedback without revealing the answer.

### Flood Fill Algorithm

The bucket tool uses an optimized scanline flood fill algorithm:

```typescript
// Uint32Array bitmap for O(1) visited checks
const visited = new Uint32Array(Math.ceil((width * height) / 32));

// Scanline approach fills entire rows at once
while (stack.length > 0) {
    const [parentX1, parentX2, y] = stack.pop()!;
    // Find and fill connected spans...
}
```

**Optimizations**:

- Bitset for visited tracking (vs. `Set<string>`)
- Scanline filling for cache locality
- Color tolerance for anti-aliased edges
- 20-50x faster than naive stack-based approach

### Distributed Locking

Redis-based distributed locks prevent race conditions in concurrent operations:

```csharp
await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
    RedisKeys.RoomLock(roomCode),
    RedisKeys.RoomLockExpiry);

if (lockHandle is null)
{
    _logger.LogWarning("Could not acquire lock for room {RoomCode}", roomCode);
    return false;
}

// Critical section - only one instance can execute
await _roomService.SaveRoomAsync(room);
```

Used for:

- Game state transitions
- Score calculations
- Player join/leave operations
- Canvas undo operations (Lua scripts for atomicity)

### Rate Limiting

SignalR hub methods are rate-limited per connection or IP:

| Method | Policy | Limit | Window |
| -------- | -------- | ------- | -------- |
| SendDrawingCommand | drawing | High frequency | 1 second |
| SendGuess | chat | 2 requests | 1 second |
| CreateRoom | roomCreation | 1 request | 60 seconds |

Rate limiters are automatically cleaned up after idle periods.

---

## Project Structure

```
sketch-ai/
├── src/
│   ├── SketchAI.Api/           # Backend API
│   │   ├── Configuration/      # Settings classes
│   │   ├── Constants/          # Redis keys, TTL expiry, etc.
│   │   ├── Dtos/               # Data transfer objects
│   │   ├── Exceptions/         # Custom exceptions
│   │   ├── Extensions/         # Extension methods
│   │   ├── Helpers/            # Utility classes
│   │   ├── Controllers/        # REST endpoints
│   │   ├── Hubs/               # SignalR hub and filters
│   │   ├── Models/             # Domain models
│   │   ├── Services/           # Business logic
│   │   │   ├── AI/             # AI drawing, explanations, hints
│   │   │   ├── Game/           # Game logic, words, canvas
│   │   │   └── Infrastructure/ # Background services, locks
│   │   │   └── Captcha/        # Turnstile verification
│   │   ├── Validation/         # Input validators
│   │   └── Data/               # Word lists and presets
│   │
│   ├── SketchAI.Web/           # Frontend SPA
│   │   └── src/
│   │       ├── components/     # React components
│   │       ├── hooks/          # Custom React hooks
│   │       ├── stores/         # Zustand state stores
│   │       ├── models/         # TypeScript interfaces
│   │       └── lib/            # Utilities (canvas, etc.)
│   │
│   ├── SketchAI.AppHost/       # Aspire orchestration
│   └── SketchAI.ServiceDefaults/ # Shared service configuration
│
└── Directory.Packages.props    # Centralized NuGet versions
```

---

## Getting Started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 22+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Redis)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)

### Running with Aspire CLI

1. **Install the Aspire CLI**:

   Follow the installation instructions at: <https://aspire.dev/get-started/install-cli/>

2. **Clone the repository**:

   ```bash
   git clone https://github.com/Younes-ch/sketch-ai.git
   cd sketch-ai
   ```

3. **Configure secrets** (for AI features):

   ```bash
   cd src/SketchAI.AppHost
   dotnet user-secrets set "Parameters:gh-models-api-key" "<your-github-token>"
   dotnet user-secrets set "Parameters:google-gemini-api-key" "<your-gemini-key>"
   dotnet user-secrets set "Parameters:serper-api-key" "<your-serper-key>"
   dotnet user-secrets set "Parameters:turnstile-site-key" "<your-turnstile-site-key>"
   dotnet user-secrets set "Parameters:turnstile-secret-key" "<your-turnstile-secret-key>"
   ```

4. **Run the application**:

   ```bash
   aspire run
   ```

5. **Open the Aspire Dashboard**:

   The dashboard URL will be displayed in the terminal. From there, you can:
   - Access the web frontend
   - View API documentation (Scalar)
   - Monitor Redis with RedisInsight
   - View logs and traces

---

## Configuration

Key settings in `appsettings.json`:

```json
{
  "GameSettings": {
    "DefaultMaxPlayers": 8,
    "DefaultRounds": 3,
    "DefaultDrawTime": 80,
    "MaxAiDrawingsPerPlayer": 1,
    "MaxImageHintsPerPlayer": 2,
    "AiDrawingCooldownSeconds": 30,
    "AiDrawingTimeoutSeconds": 20
  }
}
```

---

## Important Notice

This project is not monetized and relies on free-tier AI services. As a result:

- **AI Drawing** feature may be temporarily unavailable due to rate limits on free API tiers
- **Image Hints** depend on external search APIs with usage quotas
- **Word Translation** uses GitHub Models with token limits

The application implements automatic fallback between providers and graceful degradation when services are unavailable. Players can always continue playing manually without AI assistance.

---

## License

This project is licensed under the MIT License. See [LICENSE.txt](LICENSE.txt) for details.
