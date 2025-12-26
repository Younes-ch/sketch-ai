import { useState } from "react";
import ConnectionStatus from "@/components/Common/ConnectionStatus";
import { SettingsIcon } from "@/components/ui/Icons";
import SettingsModal from "./SettingsModal";

interface MobileGameHeaderProps {
  roomCode: string;
  onShare: () => void;
  onLeave: () => void;
  showCopied: boolean;
}

export default function MobileGameHeader({
  roomCode,
  onShare,
  onLeave,
  showCopied,
}: MobileGameHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="bg-card rounded-2xl p-2 flex justify-between items-center border-4 border-card-border shadow-lg">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black">
            <span className="text-accent">skribbl</span>
            <span className="text-white">.ai</span>
          </h1>
          <ConnectionStatus />
        </div>

        {/* Room Code & Settings */}
        <div className="flex items-center gap-2">
          {/* Room Code */}
          <div className="bg-background px-2 py-1 rounded-lg border-2 border-card-border">
            <span className="text-accent font-mono font-bold text-sm tracking-wider">
              {roomCode}
            </span>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg bg-card-border hover:bg-card text-white transition-colors"
            aria-label="Settings"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        roomCode={roomCode}
        onShare={onShare}
        onLeave={onLeave}
        showCopied={showCopied}
      />
    </>
  );
}
