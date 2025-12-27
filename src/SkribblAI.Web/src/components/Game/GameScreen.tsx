import { AnimatePresence } from "framer-motion";
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
  VoteKickModal,
} from "@/components/Game";
import {
  LobbyOverlay,
  WordSelectionOverlay,
  RoundEndOverlay,
  GameEndOverlay,
} from "./Overlays";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
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

      {/* Vote Kick Modal */}
      <VoteKickModal />

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
                  <LobbyOverlay
                    players={players}
                    isHost={isHost}
                    roomSettings={roomSettings}
                    isUpdatingSettings={isUpdatingSettings}
                    isStarting={isStarting}
                    onSettingsChange={handleSettingsChange}
                    onStartGame={handleStartGame}
                    variant="desktop"
                  />
                )}

                {/* Word Selection Waiting Overlay (for non-drawers) */}
                {phase === "wordSelection" && !isDrawer && (
                  <WordSelectionOverlay
                    currentDrawer={currentDrawer}
                    variant="desktop"
                  />
                )}

                {/* Round End Overlay */}
                {phase === "roundEnd" && (
                  <RoundEndOverlay
                    currentWord={currentWord}
                    variant="desktop"
                  />
                )}

                {/* Game End Overlay */}
                {phase === "gameEnd" && (
                  <GameEndOverlay
                    players={players}
                    isHost={isHost}
                    roomSettings={roomSettings}
                    isUpdatingSettings={isUpdatingSettings}
                    isStarting={isStarting}
                    onSettingsChange={handleSettingsChange}
                    onStartGame={handleStartGame}
                    variant="desktop"
                  />
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
                <LobbyOverlay
                  players={players}
                  isHost={isHost}
                  roomSettings={roomSettings}
                  isUpdatingSettings={isUpdatingSettings}
                  isStarting={isStarting}
                  onSettingsChange={handleSettingsChange}
                  onStartGame={handleStartGame}
                  variant="mobile"
                />
              )}

              {/* Word Selection Waiting Overlay */}
              {phase === "wordSelection" && !isDrawer && (
                <WordSelectionOverlay
                  currentDrawer={currentDrawer}
                  variant="mobile"
                />
              )}

              {/* Round End Overlay */}
              {phase === "roundEnd" && (
                <RoundEndOverlay currentWord={currentWord} variant="mobile" />
              )}

              {/* Game End Overlay */}
              {phase === "gameEnd" && (
                <GameEndOverlay
                  players={players}
                  isHost={isHost}
                  roomSettings={roomSettings}
                  isUpdatingSettings={isUpdatingSettings}
                  isStarting={isStarting}
                  onSettingsChange={handleSettingsChange}
                  onStartGame={handleStartGame}
                  variant="mobile"
                />
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
