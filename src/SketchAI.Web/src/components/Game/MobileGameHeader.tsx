import { useState } from "react";
import ConnectionStatus from "@/components/Common/ConnectionStatus";
import { MuteButton } from "@/components/Common/MuteButton";
import { Button } from "@/components/ui";
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
      <div className="bg-card w-full p-2 flex justify-between items-center border-b-2 border-card-border">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black">
            <span className="text-accent">sketch</span>
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
            <SettingsIcon size={20} />
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
