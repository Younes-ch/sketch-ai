import { useAudioStore } from "@/stores/audioStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

interface MuteButtonProps {
  className?: string;
}

export function MuteButton({ className }: MuteButtonProps) {
  const isMuted = useAudioStore((s) => s.isMuted);
  const toggleMute = useAudioStore((s) => s.toggleMute);

  return (
    <Tooltip content={isMuted ? "Unmute sounds" : "Mute sounds"}>
      <button
        onClick={toggleMute}
        className={cn(
          "px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-white font-bold text-sm transition-all duration-200 flex items-center gap-1 border-2 cursor-pointer",
          isMuted
            ? "bg-card-border border-card-border hover:bg-card"
            : "bg-accent border-accent-dark hover:bg-accent/80",
          className
        )}
        aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
      >
        <span className="text-lg">{isMuted ? "🔇" : "🔊"}</span>
      </button>
    </Tooltip>
  );
}
