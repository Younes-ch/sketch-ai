import { useState } from "react";
import { DrawingCanvas } from "@/components/Canvas";
import {
  GameHeader,
  PlayerList,
  ChatPanel,
  MobileTabNav,
  type MobileTab,
  WordHint,
  GamePhaseIndicator,
  WordSelection,
  Podium,
} from "@/components/Game";
import { RoomSettingsPanel } from "@/components/Lobby";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

export default function GameScreen() {
  const roomCode = useRoomStore((s) => s.roomCode);
  const username = useRoomStore((s) => s.username);
  const isHost = useRoomStore((s) => s.isHost);
  const players = useRoomStore((s) => s.players);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const roomSettings = useRoomStore((s) => s.roomSettings);
  const updateRoomSettings = useRoomStore((s) => s.updateRoomSettings);

  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const wordChoices = useGameStore((s) => s.wordChoices);
  const currentWord = useGameStore((s) => s.currentWord);
  const startGame = useGameStore((s) => s.startGame);

  const [showCopied, setShowCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");
  const [isStarting, setIsStarting] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  const isDrawer = currentDrawer?.username === username;
  const canDraw = phase === "drawing" && isDrawer;
  const showWordSelection =
    phase === "wordSelection" && isDrawer && wordChoices;

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
    } catch (error) {
      logger.error("Failed to leave room", error);
    }
  };

  const handleShareRoom = async () => {
    const shareUrl = `${window.location.origin}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      logger.error("Failed to copy link", error);
    }
  };

  const handleStartGame = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      await startGame();
    } catch (error) {
      logger.error("Failed to start game", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSettingsChange = async (
    updates: Partial<typeof roomSettings>
  ) => {
    if (isUpdatingSettings) return;
    setIsUpdatingSettings(true);
    try {
      await updateRoomSettings(updates);
    } catch (error) {
      logger.error("Failed to update room settings", error);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  return (
    <div className="h-screen bg-background p-2 sm:p-3 flex flex-col overflow-hidden">
      {/* Word Selection Modal */}
      {showWordSelection && <WordSelection words={wordChoices!} />}

      <div className="w-full flex-1 flex flex-col min-h-0">
        {/* Header Bar */}
        <GameHeader
          roomCode={roomCode ?? ""}
          username={username ?? ""}
          isHost={isHost}
          showCopied={showCopied}
          onShare={handleShareRoom}
          onLeave={handleLeaveRoom}
        />
        <GamePhaseIndicator />

        {/* Main Game Area */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left Sidebar - Players (Desktop only) */}
          <div className="w-56 hidden lg:flex flex-col shrink-0 h-full">
            <PlayerList
              players={players}
              currentUsername={username ?? ""}
              variant="desktop"
            />
          </div>

          {/* Center - Canvas (Desktop) / Tab Content (Mobile) */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* Mobile Tab Navigation */}
            <MobileTabNav activeTab={mobileTab} onTabChange={setMobileTab} />

            {/* Canvas View (Desktop always, Mobile when tab selected) */}
            <div
              className={cn(
                "flex-1 min-h-0 flex-col",
                mobileTab !== "canvas" ? "hidden lg:flex" : "flex"
              )}
            >
              <div className="bg-card rounded-2xl p-2 sm:p-4 border-4 border-card-border shadow-lg h-full flex flex-col overflow-hidden relative">
                {/* Lobby Overlay */}
                {phase === "lobby" && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl overflow-auto p-4">
                    <h2 className="text-2xl font-bold mb-2 text-white">
                      Waiting for players...
                    </h2>
                    <p className="text-white/60 mb-4">
                      {players.length} player{players.length !== 1 ? "s" : ""}{" "}
                      in lobby
                    </p>

                    {/* Room Settings (Host only) */}
                    {isHost && (
                      <div className="w-full max-w-xs mb-4 bg-card/50 rounded-xl p-4 border border-card-border">
                        <RoomSettingsPanel
                          settings={roomSettings}
                          onChange={handleSettingsChange}
                          disabled={isUpdatingSettings}
                          compact
                        />
                      </div>
                    )}

                    {/* Settings Summary (Non-host) */}
                    {!isHost && (
                      <div className="text-white/50 text-sm mb-4 text-center">
                        <p>
                          ⏱️ {roomSettings.drawTimeSeconds}s • 🔄{" "}
                          {roomSettings.totalRounds} rounds • 🎯{" "}
                          {roomSettings.difficulty}
                        </p>
                      </div>
                    )}

                    {isHost ? (
                      <button
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
                      </button>
                    ) : (
                      <p className="text-white/60">
                        Waiting for host to start...
                      </p>
                    )}
                  </div>
                )}

                {/* Word Selection Waiting Overlay (for non-drawers) */}
                {phase === "wordSelection" && !isDrawer && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl">
                    <h2 className="text-2xl font-bold mb-4 text-white">
                      {currentDrawer?.username} is choosing a word...
                    </h2>
                    {/* Loading spinner */}
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-transparent border-t-accent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-2xl">
                        🎨
                      </div>
                    </div>
                    <p className="text-white/50 text-sm">Get ready to guess!</p>
                  </div>
                )}

                {/* Round End Overlay */}
                {phase === "roundEnd" && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl">
                    <h2 className="text-2xl font-bold mb-2 text-white">
                      Round Over!
                    </h2>
                    <p className="text-xl text-accent mb-4">
                      The word was:{" "}
                      <span className="font-bold">{currentWord}</span>
                    </p>
                    {/* Loading progress for next round */}
                    <div className="flex items-center gap-2 text-white/60">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin"></div>
                      <p>Next round starting soon...</p>
                    </div>
                  </div>
                )}

                {/* Game End Overlay */}
                {phase === "gameEnd" && (
                  <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-2xl overflow-auto py-4">
                    <h2 className="text-3xl font-bold mb-2 text-white">
                      🎉 Game Over! 🎉
                    </h2>
                    <Podium players={players} />

                    {/* Room Settings (Host only) */}
                    {isHost && (
                      <div className="w-full max-w-xs mt-4 bg-card/50 rounded-xl p-4 border border-card-border">
                        <RoomSettingsPanel
                          settings={roomSettings}
                          onChange={handleSettingsChange}
                          disabled={isUpdatingSettings}
                          compact
                        />
                      </div>
                    )}

                    {isHost && (
                      <button
                        onClick={handleStartGame}
                        disabled={isStarting}
                        className="mt-4 px-8 py-3 rounded-lg font-semibold text-lg bg-success text-white hover:bg-success-hover border-2 border-success-dark transition-all"
                      >
                        {isStarting ? "Starting..." : "Play Again"}
                      </button>
                    )}
                    {!isHost && (
                      <p className="mt-4 text-white/60">
                        Waiting for host to start a new game...
                      </p>
                    )}
                  </div>
                )}

                <WordHint />
                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <DrawingCanvas disabled={!canDraw} />
                </div>
              </div>
            </div>

            {/* Mobile Players View */}
            <div
              className={cn(
                "flex-1 min-h-0 lg:hidden flex-col",
                mobileTab !== "players" ? "hidden" : "flex"
              )}
            >
              <PlayerList
                players={players}
                currentUsername={username ?? ""}
                roomCode={roomCode ?? ""}
                variant="mobile"
              />
            </div>

            {/* Mobile Chat View */}
            <div
              className={cn(
                "flex-1 min-h-0 lg:hidden flex-col",
                mobileTab !== "chat" ? "hidden" : "flex"
              )}
            >
              <ChatPanel variant="mobile" />
            </div>
          </div>

          {/* Right Sidebar - Chat (Desktop only) */}
          <div className="w-72 hidden lg:flex flex-col shrink-0 h-full">
            <ChatPanel variant="desktop" />
          </div>
        </div>
      </div>
    </div>
  );
}
