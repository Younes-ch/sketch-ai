import ConnectionStatus from "@/components/Common/ConnectionStatus";

interface GameHeaderProps {
  roomCode: string;
  username: string;
  isHost: boolean;
  showCopied: boolean;
  onShare: () => void;
  onLeave: () => void;
}

export default function GameHeader({
  roomCode,
  username,
  isHost,
  showCopied,
  onShare,
  onLeave,
}: GameHeaderProps) {
  return (
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
          onClick={onShare}
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
          onClick={onLeave}
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
  );
}
