namespace SketchAI.Api.Services.Game;

public class GameService : IGameService
{
    private readonly IRoomService _roomService;
    private readonly IWordService _wordService;
    private readonly ILogger<GameService> _logger;
    private readonly IDistributedLockProvider _lockProvider;

    public GameService(
        IRoomService roomService,
        IWordService wordService,
        ILogger<GameService> logger,
        IDistributedLockProvider lockProvider)
    {
        _roomService = roomService;
        _wordService = wordService;
        _logger = logger;
        _lockProvider = lockProvider;
    }

    public async Task<bool> StartGameAsync(string roomCode, string connectionId)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("StartGame failed: Could not acquire lock for room {RoomCode}", roomCode);
            return false;
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("StartGame failed: Room {RoomCode} not found", roomCode);
            return false;
        }

        var isHost = room.HostConnectionId == connectionId;
        var isAtLeast2Players = room.Players.Count >= 2;

        if (!isHost)
        {
            _logger.LogWarning("StartGame failed: Non-host {ConnectionId} attempted to start game in room {RoomCode}",
                connectionId, roomCode);
            return false;
        }

        if (!isAtLeast2Players)
        {
            _logger.LogWarning("StartGame failed: Room {RoomCode} has only {PlayerCount} player(s)",
                roomCode, room.Players.Count);
            return false;
        }

        var drawer = room.Players.First(p => p.IsHost);
        room.Phase = GamePhase.WordSelection;
        room.WordChoices = _wordService.GetRandomWordsForRoom(room.Settings);
        room.CurrentDrawerConnectionId = drawer.ConnectionId;
        room.RoundNumber = 1;
        room.CurrentWord = null;
        room.CurrentWordHint = null;
        room.LettersRevealed = 0;
        room.PlayersWhoGuessed.Clear();
        room.RoundStartedAt = null;

        foreach (var player in room.Players)
        {
            player.Score = 0;
            player.AiDrawingsUsed = 0;
            player.ImageHintsUsed = 0;
            player.LastAiDrawingAt = null;
        }

        await _roomService.SaveRoomAsync(room);

        _logger.LogInformation("Game started in room {RoomCode}. First drawer: {DrawerUsername}",
            roomCode, drawer.Username);

        return true;
    }

    public async Task<bool> SelectWordAsync(string roomCode, string connectionId, string word)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("SelectWord failed: Could not acquire lock for room {RoomCode}", roomCode);
            return false;
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("SelectWord failed: Room {RoomCode} not found", roomCode);
            return false;
        }

        if (room.Phase != GamePhase.WordSelection)
        {
            _logger.LogWarning("SelectWord failed: Room {RoomCode} in {GamePhase} phase - expected WordSelection",
                roomCode, nameof(room.Phase));
            return false;
        }

        var isCurrentDrawer = room.CurrentDrawerConnectionId == connectionId;

        if (!isCurrentDrawer)
        {
            _logger.LogWarning("SelectWord failed: Non-drawer {ConnectionId} attempted to select a word in room {RoomCode}",
                connectionId, roomCode);
            return false;
        }

        if (room.WordChoices is null || !room.WordChoices.Contains(word))
        {
            _logger.LogWarning("SelectWord failed: Word '{Word}' not in available choices for room {RoomCode}",
                word, roomCode);
            return false;
        }

        room.CurrentWord = word;
        room.CurrentWordHint = _wordService.GetWordHint(word);
        room.LettersRevealed = 0;
        room.Phase = GamePhase.Drawing;
        room.RoundStartedAt = DateTime.UtcNow;
        room.WordChoices.Clear();

        await _roomService.SaveRoomAsync(room);
        await _roomService.AddToDrawingPhaseAsync(roomCode);

        var drawer = room.Players.First(p => p.ConnectionId == connectionId);
        _logger.LogInformation("Drawer {DrawerUsername} selected the word {SelectedWord} in room {RoomCode}.",
            drawer.Username, word, roomCode);

        return true;
    }

    public async Task<string?> RevealLetterAsync(string roomCode)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("RevealLetter failed: Could not acquire lock for room {RoomCode}", roomCode);
            return null;
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null || room.Phase != GamePhase.Drawing || room.CurrentWord is null || room.CurrentWordHint is null)
        {
            return null;
        }

        var hiddenCount = room.CurrentWordHint.Count(c => c == '_');
        if (hiddenCount <= 1)
        {
            // Don't reveal the last letter - keep at least one hidden
            return room.CurrentWordHint;
        }

        room.CurrentWordHint = _wordService.RevealLetter(room.CurrentWord, room.CurrentWordHint);
        room.LettersRevealed++;

        await _roomService.SaveRoomAsync(room);

        _logger.LogInformation("Letter revealed in room {RoomCode}. Hint is now: {WordHint}",
            roomCode, room.CurrentWordHint);

        return room.CurrentWordHint;
    }

    public async Task<bool> CheckGuessAsync(string roomCode, string connectionId, string guess)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("CheckGuess failed: Could not acquire lock for room {RoomCode}", roomCode);
            return false;
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("CheckGuess failed: Room {RoomCode} not found", roomCode);
            return false;
        }

        if (room.Phase != GamePhase.Drawing)
        {
            _logger.LogDebug("CheckGuess ignored: Room {RoomCode} is not in Drawing phase", roomCode);
            return false;
        }

        if (connectionId == room.CurrentDrawerConnectionId)
        {
            _logger.LogDebug("CheckGuess ignored: Drawer cannot guess in room {RoomCode}", roomCode);
            return false;
        }

        if (room.PlayersWhoGuessed.Contains(connectionId))
        {
            _logger.LogDebug("CheckGuess ignored: Player {ConnectionId} already guessed correctly in room {RoomCode}",
                connectionId, roomCode);
            return false;
        }

        var isCorrect = _wordService.CheckGuess(room.CurrentWord!, guess);

        if (!isCorrect)
        {
            return false;
        }

        room.PlayersWhoGuessed.Add(connectionId);

        // Calculate score based on time remaining and guess order
        var player = room.Players.First(p => p.ConnectionId == connectionId);
        var timeElapsed = DateTime.UtcNow - room.RoundStartedAt!.Value;
        var maxRoundTime = room.Settings.DrawTimeSeconds;
        var timeRemaining = Math.Max(0, maxRoundTime - timeElapsed.TotalSeconds);
        var timeBonus = (int)(timeRemaining * 10);
        var orderBonus = (room.Players.Count - room.PlayersWhoGuessed.Count) * 50; // Bonus for guessing early
        var score = 100 + timeBonus + orderBonus; // Base 100 + bonuses

        player.Score += score;

        // Also give points to the drawer for each correct guess (if still in room)
        var drawer = room.Players.FirstOrDefault(p => p.ConnectionId == room.CurrentDrawerConnectionId);
        drawer?.Score += 50;

        await _roomService.SaveRoomAsync(room);

        _logger.LogInformation("Player {Username} guessed correctly in room {RoomCode} (+{Score} points)",
            player.Username, roomCode, score);

        // Check if all non-drawer players have guessed (end round early)
        var nonDrawerCount = room.Players.Count - 1;
        if (room.PlayersWhoGuessed.Count >= nonDrawerCount)
        {
            _logger.LogInformation("All players guessed in room {RoomCode}, ending round early", roomCode);
        }

        return true;
    }

    public async Task<List<string>?> GetWordChoicesAsync(string roomCode, string connectionId)
    {
        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("GetWordChoices failed: Room {RoomCode} not found", roomCode);
            return null;
        }

        if (room.CurrentDrawerConnectionId != connectionId)
        {
            _logger.LogWarning("GetWordChoices failed: Non-drawer {ConnectionId} requested word choices in room {RoomCode}",
                connectionId, roomCode);
            return null;
        }

        if (room.Phase != GamePhase.WordSelection)
        {
            _logger.LogDebug("GetWordChoices failed: Room {RoomCode} is not in WordSelection phase", roomCode);
            return null;
        }

        return room.WordChoices;
    }

    public async Task EndRoundAsync(string roomCode, bool isTimeout = false)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("EndRound failed: Could not acquire lock for room {RoomCode}", roomCode);
            return;
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("EndRound failed: Room {RoomCode} not found", roomCode);
            return;
        }

        room.Phase = GamePhase.RoundEnd;
        room.PlayersWhoGuessed.Clear();

        await _roomService.SaveRoomAsync(room);
        await _roomService.RemoveFromDrawingPhaseAsync(roomCode);

        var reason = isTimeout ? "timeout" : "manual";
        _logger.LogInformation("Round {RoundNumber} ended in room {RoomCode} ({Reason}). Word was: {Word}",
            room.RoundNumber, roomCode, reason, room.CurrentWord);
    }

    public async Task NextTurnAsync(string roomCode)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("NextTurn failed: Could not acquire lock for room {RoomCode}", roomCode);
            return;
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("NextTurn failed: Room {RoomCode} not found", roomCode);
            return;
        }

        if (room.Players.Count < 2)
        {
            _logger.LogInformation("Not enough players in room {RoomCode}, resetting to lobby", roomCode);
            await ResetToLobbyAsync(roomCode);
            return;
        }

        var nextDrawer = await GetNextDrawerAsync(roomCode);

        if (nextDrawer is null)
        {
            room.RoundNumber++;

            if (room.RoundNumber > room.Settings.TotalRounds)
            {
                room.Phase = GamePhase.GameEnd;
                room.CurrentWord = null;
                room.CurrentDrawerConnectionId = null;

                await _roomService.SaveRoomAsync(room);

                _logger.LogInformation("Game ended in room {RoomCode} after {TotalRounds} rounds",
                    roomCode, room.Settings.TotalRounds);
                return;
            }

            nextDrawer = room.Players.OrderBy(p => p.JoinedAt).First();
            _logger.LogInformation("Starting round {RoundNumber} in room {RoomCode}",
                room.RoundNumber, roomCode);
        }

        // Set up next turn
        room.Phase = GamePhase.WordSelection;
        room.CurrentDrawerConnectionId = nextDrawer.ConnectionId;
        room.CurrentWord = null;
        room.WordChoices = _wordService.GetRandomWordsForRoom(room.Settings);
        room.PlayersWhoGuessed.Clear();
        room.RoundStartedAt = null;

        await _roomService.SaveRoomAsync(room);

        _logger.LogInformation("Next turn in room {RoomCode}. New drawer: {DrawerUsername}",
            roomCode, nextDrawer.Username);
    }

    public async Task<Player?> GetNextDrawerAsync(string roomCode)
    {
        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            return null;
        }

        var orderedPlayers = room.Players.OrderBy(p => p.JoinedAt).ToList();

        var currentDrawerIndex = orderedPlayers.FindIndex(p => p.ConnectionId == room.CurrentDrawerConnectionId);

        if (currentDrawerIndex == -1)
        {
            return orderedPlayers.FirstOrDefault();
        }

        var nextIndex = currentDrawerIndex + 1;

        return nextIndex >= orderedPlayers.Count ? null : orderedPlayers[nextIndex];
    }

    public async Task ResetToLobbyAsync(string roomCode)
    {
        await using var lockHandle = await _lockProvider.TryAcquireLockAsync(
            RedisKeys.RoomLock(roomCode),
            RedisKeys.RoomLockExpiry);

        if (lockHandle is null)
        {
            _logger.LogWarning("ResetToLobby failed: Could not acquire lock for room {RoomCode}", roomCode);
            return;
        }

        var room = await _roomService.GetRoomAsync(roomCode);

        if (room is null)
        {
            _logger.LogWarning("ResetToLobby failed: Room {RoomCode} not found", roomCode);
            return;
        }

        room.Phase = GamePhase.Lobby;
        room.CurrentWord = null;
        room.CurrentWordHint = null;
        room.CurrentDrawerConnectionId = null;
        room.WordChoices?.Clear();
        room.PlayersWhoGuessed.Clear();
        room.RoundNumber = 0;
        room.RoundStartedAt = null;
        room.LettersRevealed = 0;

        foreach (var player in room.Players)
        {
            player.Score = 0;
        }

        await _roomService.SaveRoomAsync(room);

        _logger.LogInformation("Room {RoomCode} reset to lobby phase", roomCode);
    }
}
