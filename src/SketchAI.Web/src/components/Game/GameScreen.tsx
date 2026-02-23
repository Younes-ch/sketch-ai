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
        <div className="flex gap-4 flex-1 min-h-0 pt-2">
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
            <div className="bg-card rounded-2xl p-1 border-4 border-card-border shadow-lg h-full flex flex-col overflow-hidden relative">
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
              <div className="flex-1 min-h-0 flex items-center justify-center bg-white/5 rounded-lg overflow-hidden m-1">
                {/* Canvas Container */}
                <DrawingCanvas disabled={!canDraw} layout="desktop" />
              </div>
            </div>
          </div>

          {/* Right Sidebar - Chat */}
          <div className="w-80 flex flex-col shrink-0 h-full">
            <ChatPanel variant="desktop" />
          </div>
        </div>
      </div>

      {/* **************************************************************************************************** */}

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-full w-full overflow-hidden bg-background">
        {/* Row 1: Header */}
        <div className="shrink-0 w-full">
          <MobileGameHeader
            roomCode={roomCode ?? ""}
            onShare={handleShareRoom}
            onLeave={handleLeaveRoom}
            showCopied={showCopied}
          />
        </div>

        {/* Row 2: Phase Indicator */}
        <div className="shrink-0 w-full">
          <GamePhaseIndicator />
        </div>

        {/* Row 3: Word Hint */}
        <div className="shrink-0 w-full">
          <WordHint />
        </div>

        {/* Row 4: Canvas (Flexible Height) */}
        <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
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

          {/* Canvas */}
          <div className="w-full h-full flex items-center justify-center border-t-2 border-card-border">
            <DrawingCanvas disabled={!canDraw} layout="mobile" />
          </div>
        </div>

        {/* Row 5: Players & Chat (Fixed Height, Equal Columns) */}
        <div className="h-45 shrink-0 grid grid-cols-2 overflow-hidden border-t-2 border-card-border">
          <MobilePlayerList
            players={players}
            currentUsername={username ?? ""}
          />
          <MobileChatMessages />
        </div>

        {/* Row 6: Chat Input */}
        <div className="shrink-0 bg-card">
          <MobileChatInput />
        </div>
      </div>
    </div>
  );
}
