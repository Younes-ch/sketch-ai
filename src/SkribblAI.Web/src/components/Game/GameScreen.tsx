import { useState } from "react";
import DrawingCanvas from "@/components/Canvas/DrawingCanvas";
import ConnectionStatus from "@/components/Common/ConnectionStatus";
import { useSignalR } from "@/hooks/useSignalR";

type MobileTab = "canvas" | "players" | "chat";

export default function GameScreen() {
  const { roomCode, username, isHost, leaveRoom } = useSignalR();
  const [showCopied, setShowCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("canvas");

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
    } catch (error) {
      console.error("Failed to leave room:", error);
    }
  };

  const handleShareRoom = async () => {
    const shareUrl = `${window.location.origin}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <div className="h-screen bg-[#0D1B2A] p-2 sm:p-3 flex flex-col overflow-hidden">
      <div className="w-full flex-1 flex flex-col min-h-0">
        {/* Header Bar */}
        <div className="bg-[#1B2838] rounded-2xl p-2 sm:p-3 mb-3 flex flex-wrap justify-between items-center gap-2 border-4 border-[#2A3F54] shadow-lg shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black">
              <span className="text-[#FFC71E]">skribbl</span>
              <span className="text-white">.ai</span>
            </h1>
            <ConnectionStatus />
          </div>

          {/* Room Info & Actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
            {/* Room Code */}
            <div className="bg-[#0D1B2A] px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl border-2 border-[#2A3F54] flex items-center gap-1">
              <span className="text-[#FFC71E] font-mono font-bold text-sm sm:text-base tracking-wider">
                {roomCode}
              </span>
            </div>

            {/* Share Button */}
            <button
              onClick={handleShareRoom}
              className="px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-white font-bold text-sm transition-all duration-200 flex items-center gap-1 relative"
              style={{
                backgroundColor: "#2196F3",
                border: "2px solid #1976D2",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#1E88E5")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#2196F3")
              }
            >
              <span>🔗</span>
              <span className="hidden sm:inline">Share</span>
              {showCopied && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#4CAF50] text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                  Link copied!
                </span>
              )}
            </button>

            {/* Player Badge */}
            <div className="bg-[#4CAF50] px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl border-2 border-[#45a049] flex items-center gap-1">
              {isHost && <span className="text-sm sm:text-lg">👑</span>}
              <span className="text-white font-bold text-sm">
                👤 <span className="hidden sm:inline">{username}</span>
              </span>
            </div>

            {/* Leave Button */}
            <button
              onClick={handleLeaveRoom}
              className="px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-white font-bold text-sm transition-all duration-200 flex items-center gap-1"
              style={{
                backgroundColor: "#F44336",
                border: "2px solid #D32F2F",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#E53935")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#F44336")
              }
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Left Sidebar - Players (Desktop only) */}
          <div className="w-56 bg-[#1B2838] rounded-2xl p-4 border-4 border-[#2A3F54] hidden lg:flex flex-col shrink-0">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <span>👥</span> PLAYERS
            </h3>
            <div className="space-y-2 flex-1 overflow-y-auto">
              <div className="bg-[#4CAF50] rounded-xl p-3 flex items-center gap-2">
                {isHost && <span className="text-sm">👑</span>}
                <span className="text-xl">🎨</span>
                <div className="flex-1 min-w-0">
                  <span className="text-white font-bold text-sm truncate block">
                    {username}
                  </span>
                  <p className="text-white/70 text-xs">Drawing...</p>
                </div>
                <span className="text-white font-bold text-lg">0</span>
              </div>
              <p className="text-white/40 text-xs text-center mt-4 py-4">
                Waiting for more players to join...
              </p>
            </div>
          </div>

          {/* Center - Canvas (Desktop) / Tab Content (Mobile) */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            {/* Mobile Tab Navigation */}
            <div className="lg:hidden flex gap-1 mb-2 shrink-0">
              <button
                onClick={() => setMobileTab("canvas")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 ${
                  mobileTab === "canvas"
                    ? "bg-[#FFC71E] text-[#0D1B2A]"
                    : "bg-[#1B2838] text-white/60 border-2 border-[#2A3F54]"
                }`}
              >
                <span>🎨</span> Draw
              </button>
              <button
                onClick={() => setMobileTab("players")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 ${
                  mobileTab === "players"
                    ? "bg-[#4CAF50] text-white"
                    : "bg-[#1B2838] text-white/60 border-2 border-[#2A3F54]"
                }`}
              >
                <span>👥</span> Players
              </button>
              <button
                onClick={() => setMobileTab("chat")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 ${
                  mobileTab === "chat"
                    ? "bg-[#2196F3] text-white"
                    : "bg-[#1B2838] text-white/60 border-2 border-[#2A3F54]"
                }`}
              >
                <span>💬</span> Chat
              </button>
            </div>

            {/* Canvas View (Desktop always, Mobile when tab selected) */}
            <div
              className={`flex-1 min-h-0 ${
                mobileTab !== "canvas" ? "hidden lg:flex" : "flex"
              } flex-col`}
            >
              <div className="bg-[#1B2838] rounded-2xl p-2 sm:p-4 border-4 border-[#2A3F54] shadow-lg h-full flex flex-col overflow-hidden">
                {/* Word hint area */}
                <div className="bg-[#0D1B2A] rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 text-center border-2 border-[#2A3F54] shrink-0">
                  <p className="text-white/60 text-xs sm:text-sm">DRAW THIS:</p>
                  <p className="text-[#FFC71E] text-xl sm:text-2xl font-bold tracking-widest">
                    _ _ _ _ _
                  </p>
                </div>

                {/* Canvas */}
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
              <div className="bg-[#1B2838] rounded-2xl p-4 border-4 border-[#2A3F54] shadow-lg h-full flex flex-col">
                <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2 shrink-0">
                  <span>👥</span> PLAYERS
                </h3>
                <div className="space-y-2 flex-1 overflow-y-auto">
                  <div className="bg-[#4CAF50] rounded-xl p-3 flex items-center gap-3">
                    {isHost && <span className="text-lg">👑</span>}
                    <span className="text-2xl">🎨</span>
                    <div className="flex-1">
                      <span className="text-white font-bold">{username}</span>
                      <p className="text-white/60 text-xs">Drawing...</p>
                    </div>
                    <span className="text-white font-bold text-lg">0</span>
                  </div>
                  <p className="text-white/40 text-sm text-center mt-6 py-8">
                    Waiting for more players to join...
                    <br />
                    Share the room code:{" "}
                    <span className="text-[#FFC71E] font-bold">{roomCode}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Chat View */}
            <div
              className={`flex-1 min-h-0 ${
                mobileTab !== "chat" ? "hidden" : "flex"
              } lg:hidden flex-col`}
            >
              <div className="bg-[#1B2838] rounded-2xl p-4 border-4 border-[#2A3F54] shadow-lg h-full flex flex-col">
                <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2 shrink-0">
                  <span>💬</span> CHAT
                </h3>
                <div className="flex-1 bg-[#0D1B2A] rounded-xl p-3 mb-3 border-2 border-[#2A3F54] overflow-y-auto min-h-0">
                  <p className="text-white/40 text-sm text-center py-8">
                    Chat messages will appear here...
                    <br />
                    <span className="text-xs">Type your guesses below!</span>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Type your guess..."
                    className="flex-1 min-w-0 px-4 py-3 bg-[#0D1B2A] border-2 border-[#2A3F54] rounded-xl text-white focus:outline-none focus:border-[#FFC71E] placeholder:text-white/30"
                    disabled
                  />
                  <button
                    className="px-5 py-3 bg-[#4CAF50] border-2 border-[#45a049] rounded-xl text-white font-bold hover:bg-[#43A047] transition-colors shrink-0"
                    disabled
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Chat (Desktop only) */}
          <div className="w-72 bg-[#1B2838] rounded-2xl p-4 border-4 border-[#2A3F54] hidden lg:flex flex-col shrink-0">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <span>💬</span> CHAT
            </h3>
            <div className="flex-1 bg-[#0D1B2A] rounded-xl p-3 mb-3 border-2 border-[#2A3F54] overflow-y-auto min-h-0">
              <p className="text-white/40 text-xs text-center">
                Chat messages will appear here...
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type your guess..."
                className="flex-1 min-w-0 px-3 py-2 bg-[#0D1B2A] border-2 border-[#2A3F54] rounded-xl text-white text-sm focus:outline-none focus:border-[#FFC71E] placeholder:text-white/30"
                disabled
              />
              <button
                className="px-4 py-2 bg-[#4CAF50] border-2 border-[#45a049] rounded-xl text-white font-bold hover:bg-[#43A047] transition-colors shrink-0"
                disabled
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
