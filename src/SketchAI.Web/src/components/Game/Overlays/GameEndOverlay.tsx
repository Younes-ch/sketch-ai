import { motion } from "framer-motion";
import { RoomSettingsPanel } from "@/components/Lobby";
import { Podium } from "@/components/Game";
import { cn } from "@/lib/utils";
import type { Player, RoomSettings } from "@/models";

interface GameEndOverlayProps {
  players: Player[];
  isHost: boolean;
  roomSettings: RoomSettings;
  isUpdatingSettings: boolean;
  isStarting: boolean;
  onSettingsChange: (settings: Partial<RoomSettings>) => void;
  onStartGame: () => void;
  variant?: "desktop" | "mobile";
}

export function GameEndOverlay({
  players,
  isHost,
  roomSettings,
  isUpdatingSettings,
  isStarting,
  onSettingsChange,
  onStartGame,
  variant = "desktop",
}: GameEndOverlayProps) {
  const isMobile = variant === "mobile";

  return (
    <motion.div
      key={`gameEnd-${variant}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 overflow-auto",
        isMobile ? "rounded-xl py-3" : "rounded-2xl py-4"
      )}
    >
      <motion.h2
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
        className={cn(
          "font-bold text-white",
          isMobile ? "text-xl mb-2" : "text-3xl mb-2"
        )}
      >
        🎉 Game Over! 🎉
      </motion.h2>
      <Podium players={players} />

      {/* Room Settings (Host only) */}
      {isHost && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 2.5 }}
          className={cn(
            "w-full max-w-xs bg-card/50 rounded-xl p-4 border border-card-border",
            isMobile ? "mt-3" : "mt-4"
          )}
        >
          <RoomSettingsPanel
            settings={roomSettings}
            onChange={onSettingsChange}
            disabled={isUpdatingSettings}
            compact
          />
        </motion.div>
      )}

      {isHost && (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 2.7 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartGame}
          disabled={isStarting}
          className={cn(
            "rounded-lg font-semibold bg-success text-white hover:bg-success-hover border-2 border-success-dark transition-all",
            isMobile ? "mt-3 px-6 py-2" : "mt-4 px-8 py-3 text-lg"
          )}
        >
          {isStarting ? "Starting..." : "Play Again"}
        </motion.button>
      )}
      {!isHost && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className={cn("text-white/60", isMobile ? "mt-3 text-sm" : "mt-4")}
        >
          {isMobile
            ? "Waiting for host..."
            : "Waiting for host to start a new game..."}
        </motion.p>
      )}
    </motion.div>
  );
}
