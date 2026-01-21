import { useState } from "react";
import ConnectionStatus from "@/components/Common/ConnectionStatus";
import { MuteButton } from "@/components/Common/MuteButton";
import { Button } from "@/components/ui";
import { SettingsIcon } from "@/components/ui/Icons";
import SettingsModal from "./SettingsModal";

interface GameHeaderProps {
  roomCode: string;
  showCopied: boolean;
  onShare: () => void;
  onLeave: () => void;
}

export default function GameHeader({
  roomCode,
  showCopied,
  onShare,
  onLeave,
}: GameHeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="bg-card rounded-2xl p-2 sm:p-3 mb-3 flex justify-between items-center border-4 border-card-border shadow-lg shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-black">
            <span className="text-accent">sketch</span>
            <span className="text-white">.ai</span>
          </h1>
          <ConnectionStatus />
        </div>

        {/* Room Code & Settings */}
        <div className="flex items-center gap-2">
          {/* Room Code */}
          <div className="bg-background px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl border-2 border-card-border">
            <span className="text-accent font-mono font-bold text-sm sm:text-base tracking-wider">
              {roomCode}
            </span>
          </div>

          {/* Mute Button */}
          <MuteButton />

          {/* Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(true)}
            className="bg-card-border hover:bg-card"
            aria-label="Settings"
          >
            <SettingsIcon size={24} />
          </Button>
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
