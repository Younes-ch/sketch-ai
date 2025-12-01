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
    <div className="bg-card rounded-2xl p-2 sm:p-3 mb-3 flex flex-wrap justify-between items-center gap-2 border-4 border-card-border shadow-lg shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-black">
          <span className="text-accent">skribbl</span>
          <span className="text-white">.ai</span>
        </h1>
        <ConnectionStatus />
      </div>

      {/* Room Info & Actions */}
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
        {/* Room Code */}
        <div className="bg-background px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl border-2 border-card-border flex items-center gap-1">
          <span className="text-accent font-mono font-bold text-sm sm:text-base tracking-wider">
            {roomCode}
          </span>
        </div>

        {/* Share Button */}
        <button
          onClick={onShare}
          className="px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-white font-bold text-sm transition-all duration-200 flex items-center gap-1 relative bg-info border-2 border-info-dark hover:bg-info-hover"
        >
          <span>🔗</span>
          <span className="hidden sm:inline">Share</span>
          {showCopied && (
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-success text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
              Link copied!
            </span>
          )}
        </button>

        {/* Player Badge */}
        <div className="bg-success px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl border-2 border-success-dark flex items-center gap-1">
          {isHost && <span className="text-sm sm:text-lg">👑</span>}
          <span className="text-white font-bold text-sm">
            👤 <span className="hidden sm:inline">{username}</span>
          </span>
        </div>

        {/* Leave Button */}
        <button
          onClick={onLeave}
          className="px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-white font-bold text-sm transition-all duration-200 flex items-center gap-1 bg-danger border-2 border-danger-dark hover:bg-danger-hover"
        >
          <span>🚪</span>
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
}
