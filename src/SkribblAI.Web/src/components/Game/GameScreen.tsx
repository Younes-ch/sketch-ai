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
} from "@/components/Game";
import { useSignalR } from "@/hooks/useSignalR";
import { logger } from "@/lib/logger";

export default function GameScreen() {
  const { roomCode, username, isHost, players, leaveRoom } = useSignalR();
  const [showCopied, setShowCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");

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

  return (
    <div className="h-screen bg-background p-2 sm:p-3 flex flex-col overflow-hidden">
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

        {/* Main Game Area */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left Sidebar - Players (Desktop only) */}
          <div className="w-56 hidden lg:flex flex-col shrink-0">
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
              className={`flex-1 min-h-0 ${
                mobileTab !== "canvas" ? "hidden lg:flex" : "flex"
              } flex-col`}
            >
              <div className="bg-card rounded-2xl p-2 sm:p-4 border-4 border-card-border shadow-lg h-full flex flex-col overflow-hidden">
                <WordHint />
                <div className="flex-1 min-h-0 flex items-center justify-center">
                  <DrawingCanvas />
                </div>
              </div>
            </div>

            {/* Mobile Players View */}
            <div
              className={`flex-1 min-h-0 ${
                mobileTab !== "players" ? "hidden" : "flex"
              } lg:hidden flex-col`}
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
              className={`flex-1 min-h-0 ${
                mobileTab !== "chat" ? "hidden" : "flex"
              } lg:hidden flex-col`}
            >
              <ChatPanel variant="mobile" />
            </div>
          </div>

          {/* Right Sidebar - Chat (Desktop only) */}
          <div className="w-72 hidden lg:flex flex-col shrink-0">
            <ChatPanel variant="desktop" />
          </div>
        </div>
      </div>
    </div>
  );
}
