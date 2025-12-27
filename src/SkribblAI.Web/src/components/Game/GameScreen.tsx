import { motion, AnimatePresence } from "framer-motion";
import { DrawingCanvas } from "@/components/Canvas";
import {
  GameHeader,
  PlayerList,
  ChatPanel,
  MobileGameHeader,
  MobilePlayerList,
  MobileChatMessages,
  MobileChatInput,
  WordHint,
  GamePhaseIndicator,
  WordSelection,
  Podium,
} from "@/components/Game";
import { RoomSettingsPanel } from "@/components/Lobby";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { cn } from "@/lib/utils";
import { useGameActions } from "@/hooks/useGameActions";

export default function GameScreen() {
  const roomCode = useRoomStore((s) => s.roomCode);
  const username = useRoomStore((s) => s.username);
  const isHost = useRoomStore((s) => s.isHost);
  const players = useRoomStore((s) => s.players);
  const roomSettings = useRoomStore((s) => s.roomSettings);

  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const wordChoices = useGameStore((s) => s.wordChoices);
  const currentWord = useGameStore((s) => s.currentWord);

  const {
    showCopied,
    isStarting,
    isUpdatingSettings,
    handleLeaveRoom,
    handleShareRoom,
    handleStartGame,
    handleSettingsChange,
  } = useGameActions();

  const isDrawer = currentDrawer?.username === username;
  const canDraw = phase === "drawing" && isDrawer;
  const showWordSelection =
    phase === "wordSelection" && isDrawer && wordChoices;

  return (
    <div className="h-screen bg-background p-2 sm:p-3 flex flex-col overflow-hidden">
      {/* Word Selection Modal */}
      {showWordSelection && <WordSelection words={wordChoices!} />}


      {/* Desktop Layout */}
      <div className="hidden lg:flex w-full flex-1 flex-col min-h-0">
        {/* Header Bar */}
        <GameHeader
          roomCode={roomCode ?? ""}
          showCopied={showCopied}
          onShare={handleShareRoom}
          onLeave={handleLeaveRoom}
        />
        <GamePhaseIndicator />

        {/* Main Game Area */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left Sidebar - Players */}
          <div className="w-64 flex flex-col shrink-0 h-full">
            <PlayerList
              players={players}
              currentUsername={username ?? ""}
              variant="desktop"
            />
          </div>

          {/* Center - Canvas */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="bg-card rounded-2xl p-4 border-4 border-card-border shadow-lg h-full flex flex-col overflow-hidden relative">
              <AnimatePresence mode="wait">
                {/* Lobby Overlay */}
                {phase === "lobby" && (
                  <motion.div
                    key="lobby"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl overflow-auto p-4"
                  >
                    <motion.h2
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-2xl font-bold mb-2 text-white"
                    >
                      Waiting for players...
                    </motion.h2>
                    <p className="text-white/60 mb-4">
                      {players.length} player{players.length !== 1 ? "s" : ""}{" "}
                      in lobby
                    </p>

                    {/* Room Settings (Host only) */}
                    {isHost && (
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-full max-w-xs mb-4 bg-card/50 rounded-xl p-4 border border-card-border"
                      >
                        <RoomSettingsPanel
                          settings={roomSettings}
                          onChange={handleSettingsChange}
                          disabled={isUpdatingSettings}
                          compact
                        />
                      </motion.div>
                    )}

                    {/* Settings Summary (Non-host) */}
                    {!isHost && (
                      <div className="text-white/50 text-sm mb-4 text-center">
                        <p>
                          ⏱️ {roomSettings.drawTimeSeconds}s • 🔄{" "}
                          {roomSettings.totalRounds} round
                          {roomSettings.totalRounds !== 1 ? "s" : ""} • 🎯{" "}
                          {roomSettings.difficulty}
                        </p>
                      </div>
                    )}

                    {isHost ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStartGame}
                        disabled={isStarting || players.length < 2}
                        className={cn(
                          "px-8 py-3 rounded-lg font-semibold text-lg transition-all",
                          players.length < 2
                            ? "bg-card-border text-white/40 cursor-not-allowed"
                            : "bg-success text-white hover:bg-success-hover border-2 border-success-dark"
                        )}
                      >
                        {isStarting
                          ? "Starting..."
                          : players.length < 2
                          ? "Need 2+ players"
                          : "Start Game"}
                      </motion.button>
                    ) : (
                      <p className="text-white/60">
                        Waiting for host to start...
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Word Selection Waiting Overlay (for non-drawers) */}
                {phase === "wordSelection" && !isDrawer && (
                  <motion.div
                    key="wordSelection"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl"
                  >
                    <motion.h2
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className="text-2xl font-bold mb-4 text-white"
                    >
                      {currentDrawer?.username} is choosing a word...
                    </motion.h2>
                    {/* Loading spinner */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="relative w-16 h-16 mb-4"
                    >
                      <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-transparent border-t-accent rounded-full"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-2xl">
                        🎨
                      </div>
                    </motion.div>
                    <p className="text-white/50 text-sm">Get ready to guess!</p>
                  </motion.div>
                )}

                {/* Round End Overlay */}
                {phase === "roundEnd" && (
                  <motion.div
                    key="roundEnd"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl"
                  >
                    <motion.h2
                      initial={{ y: -30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className="text-2xl font-bold mb-2 text-white"
                    >
                      Round Over!
                    </motion.h2>
                    <motion.p
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.2,
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className="text-xl text-accent mb-4"
                    >
                      The word was:{" "}
                      <span className="font-bold text-2xl">{currentWord}</span>
                    </motion.p>
                    {/* Loading progress for next round */}
                    <div className="flex items-center gap-2 text-white/60">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin"></div>
                      <p>Next round starting soon...</p>
                    </div>
                  </motion.div>
                )}

                {/* Game End Overlay */}
                {phase === "gameEnd" && (
                  <motion.div
                    key="gameEnd"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl overflow-auto py-4"
                  >
                    <motion.h2
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                      }}
                      className="text-3xl font-bold mb-2 text-white"
                    >
                      🎉 Game Over! 🎉
                    </motion.h2>
                    <Podium players={players} />

                    {/* Room Settings (Host only) */}
                    {isHost && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 2.5 }}
                        className="w-full max-w-xs mt-4 bg-card/50 rounded-xl p-4 border border-card-border"
                      >
                        <RoomSettingsPanel
                          settings={roomSettings}
                          onChange={handleSettingsChange}
                          disabled={isUpdatingSettings}
                          compact
                        />
                      </motion.div>
                    )}

                    {isHost && (
                      <motion.button
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 2.7 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStartGame}
                        disabled={isStarting}
                        className="mt-4 px-8 py-3 rounded-lg font-semibold text-lg bg-success text-white hover:bg-success-hover border-2 border-success-dark transition-all"
                      >
                        {isStarting ? "Starting..." : "Play Again"}
                      </motion.button>
                    )}
                    {!isHost && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.5 }}
                        className="mt-4 text-white/60"
                      >
                        Waiting for host to start a new game...
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <WordHint />
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <DrawingCanvas disabled={!canDraw} />
              </div>
            </div>
          </div>

          {/* Right Sidebar - Chat */}
          <div className="w-72 flex flex-col shrink-0 h-full">
            <ChatPanel variant="desktop" />
          </div>
        </div>
      </div>

      {/* Mobile Layout - Grid */}
      <div className="lg:hidden grid grid-rows-[auto_1fr_minmax(100px,180px)_auto] gap-2 h-full w-full">
        {/* Row 1: Header */}
        <MobileGameHeader
          roomCode={roomCode ?? ""}
          onShare={handleShareRoom}
          onLeave={handleLeaveRoom}
          showCopied={showCopied}
        />

        {/* Row 2: Canvas */}
        <div className="min-h-0 overflow-hidden">
          <div className="bg-card rounded-xl p-2 border-4 border-card-border shadow-lg h-full flex flex-col overflow-hidden relative">
            <AnimatePresence mode="wait">
              {/* Lobby Overlay */}
              {phase === "lobby" && (
                <motion.div
                  key="lobby-mobile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl overflow-auto p-3"
                >
                  <motion.h2
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-lg font-bold mb-1 text-white"
                  >
                    Waiting for players...
                  </motion.h2>
                  <p className="text-white/60 text-sm mb-3">
                    {players.length} player{players.length !== 1 ? "s" : ""} in
                    lobby
                  </p>

                  {isHost && (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="w-full max-w-xs mb-3 bg-card/50 rounded-xl p-3 border border-card-border"
                    >
                      <RoomSettingsPanel
                        settings={roomSettings}
                        onChange={handleSettingsChange}
                        disabled={isUpdatingSettings}
                        compact
                      />
                    </motion.div>
                  )}

                  {!isHost && (
                    <div className="text-white/50 text-xs mb-3 text-center">
                      <p>
                        ⏱️ {roomSettings.drawTimeSeconds}s • 🔄{" "}
                        {roomSettings.totalRounds} round
                        {roomSettings.totalRounds !== 1 ? "s" : ""} • 🎯{" "}
                        {roomSettings.difficulty}
                      </p>
                    </div>
                  )}

                  {isHost ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleStartGame}
                      disabled={isStarting || players.length < 2}
                      className={cn(
                        "px-6 py-2 rounded-lg font-semibold transition-all",
                        players.length < 2
                          ? "bg-card-border text-white/40 cursor-not-allowed"
                          : "bg-success text-white hover:bg-success-hover border-2 border-success-dark"
                      )}
                    >
                      {isStarting
                        ? "Starting..."
                        : players.length < 2
                        ? "Need 2+ players"
                        : "Start Game"}
                    </motion.button>
                  ) : (
                    <p className="text-white/60 text-sm">
                      Waiting for host to start...
                    </p>
                  )}
                </motion.div>
              )}

              {/* Word Selection Waiting Overlay */}
              {phase === "wordSelection" && !isDrawer && (
                <motion.div
                  key="wordSelection-mobile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl"
                >
                  <motion.h2
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-lg font-bold mb-3 text-white text-center px-4"
                  >
                    {currentDrawer?.username} is choosing...
                  </motion.h2>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="relative w-12 h-12 mb-2"
                  >
                    <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-transparent border-t-accent rounded-full"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xl">
                      🎨
                    </div>
                  </motion.div>
                  <p className="text-white/50 text-xs">Get ready to guess!</p>
                </motion.div>
              )}

              {/* Round End Overlay */}
              {phase === "roundEnd" && (
                <motion.div
                  key="roundEnd-mobile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl"
                >
                  <motion.h2
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-lg font-bold mb-1 text-white"
                  >
                    Round Over!
                  </motion.h2>
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg text-accent mb-2"
                  >
                    The word was:{" "}
                    <span className="font-bold">{currentWord}</span>
                  </motion.p>
                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin"></div>
                    <p>Next round...</p>
                  </div>
                </motion.div>
              )}

              {/* Game End Overlay */}
              {phase === "gameEnd" && (
                <motion.div
                  key="gameEnd-mobile"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-xl overflow-auto py-3"
                >
                  <motion.h2
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-xl font-bold mb-2 text-white"
                  >
                    🎉 Game Over! 🎉
                  </motion.h2>
                  <Podium players={players} />

                  {isHost && (
                    <motion.button
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 2.7 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleStartGame}
                      disabled={isStarting}
                      className="mt-3 px-6 py-2 rounded-lg font-semibold bg-success text-white hover:bg-success-hover border-2 border-success-dark transition-all"
                    >
                      {isStarting ? "Starting..." : "Play Again"}
                    </motion.button>
                  )}
                  {!isHost && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2.5 }}
                      className="mt-3 text-white/60 text-sm"
                    >
                      Waiting for host...
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <WordHint />
            <GamePhaseIndicator />
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <DrawingCanvas disabled={!canDraw} />
            </div>
          </div>
        </div>

        {/* Row 3: Players & Chat side by side */}
        <div className="grid grid-cols-2 min-h-0 overflow-hidden">
          <MobilePlayerList
            players={players}
            currentUsername={username ?? ""}
          />
          <MobileChatMessages />
        </div>

        {/* Row 4: Chat Input */}
        <MobileChatInput />
      </div>
    </div>
  );
}
