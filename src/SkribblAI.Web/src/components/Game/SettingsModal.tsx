import { motion, AnimatePresence } from "framer-motion";
import { CloseIcon, VolumeOnIcon, VolumeOffIcon } from "@/components/ui/Icons";
import { useAudioStore } from "@/stores/audioStore";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  onShare: () => void;
  onLeave: () => void;
  showCopied: boolean;
}

export default function SettingsModal({
  isOpen,
  onClose,
  roomCode,
  onShare,
  onLeave,
  showCopied,
}: SettingsModalProps) {
  const isMuted = useAudioStore((s) => s.isMuted);
  const volume = useAudioStore((s) => s.volume);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setMuted(false);
    } else if (newVolume === 0 && !isMuted) {
      setMuted(true);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setMuted(false);
      if (volume === 0) setVolume(0.5);
    } else {
      setMuted(true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm"
          >
            <div className="bg-card rounded-2xl border-4 border-card-border shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b-2 border-card-border">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>⚙️</span> Settings
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-card-border hover:bg-card-border/80 text-white transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Room Code */}
                <div className="bg-background rounded-xl p-3 border-2 border-card-border">
                  <p className="text-white/60 text-xs mb-1">Room Code</p>
                  <p className="text-accent font-mono font-bold text-lg tracking-wider">
                    {roomCode}
                  </p>
                </div>

                {/* Share Button */}
                <button
                  onClick={onShare}
                  className="w-full px-4 py-3 rounded-xl text-white font-bold transition-all duration-200 flex items-center justify-center gap-2 bg-info border-2 border-info-dark hover:bg-info-hover relative"
                >
                  <span>🔗</span>
                  Share Room Link
                  {showCopied && (
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-success text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      Link copied!
                    </span>
                  )}
                </button>

                {/* Volume Control */}
                <div className="bg-background rounded-xl p-3 border-2 border-card-border">
                  <p className="text-white/60 text-xs mb-3">Sound Volume</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleMute}
                      className="p-2 rounded-lg bg-card-border hover:bg-card text-white transition-colors shrink-0"
                      aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeOffIcon size={20} />
                      ) : (
                        <VolumeOnIcon size={20} />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="flex-1 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <span className="text-white/60 text-sm w-10 text-right">
                      {isMuted ? "0" : Math.round(volume * 100)}%
                    </span>
                  </div>
                </div>

                {/* Leave Button */}
                <button
                  onClick={onLeave}
                  className="w-full px-4 py-3 rounded-xl text-white font-bold transition-all duration-200 flex items-center justify-center gap-2 bg-danger border-2 border-danger-dark hover:bg-danger-hover"
                >
                  <span>🚪</span>
                  Leave Room
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
