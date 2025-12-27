import { motion } from "framer-motion";
import { RoomSettingsPanel } from "@/components/Lobby";
import { cn } from "@/lib/utils";
import type { Player, RoomSettings } from "@/models";

interface LobbyOverlayProps {
  players: Player[];
  isHost: boolean;
  roomSettings: RoomSettings;
  isUpdatingSettings: boolean;
  isStarting: boolean;
  onSettingsChange: (settings: Partial<RoomSettings>) => void;
  onStartGame: () => void;
  variant?: "desktop" | "mobile";
}

export function LobbyOverlay({
  players,
  isHost,
  roomSettings,
  isUpdatingSettings,
  isStarting,
  onSettingsChange,
  onStartGame,
  variant = "desktop",
}: LobbyOverlayProps) {
  const isMobile = variant === "mobile";

  return (
    <motion.div
      key={`lobby-${variant}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 overflow-auto",
        isMobile ? "rounded-xl p-3" : "rounded-2xl p-4"
      )}
    >
      <motion.h2
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "font-bold text-white",
          isMobile ? "text-lg mb-1" : "text-2xl mb-2"
        )}
      >
        Waiting for players...
      </motion.h2>
      <p className={cn("text-white/60", isMobile ? "text-sm mb-3" : "mb-4")}>
        {players.length} player{players.length !== 1 ? "s" : ""} in lobby
      </p>

      {/* Room Settings (Host only) */}
      {isHost && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "w-full max-w-xs bg-card/50 rounded-xl p-4 border border-card-border",
            isMobile ? "mb-3 p-3" : "mb-4"
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

      {/* Settings Summary (Non-host) */}
      {!isHost && (
        <div
          className={cn(
            "text-white/50 text-center",
            isMobile ? "text-xs mb-3" : "text-sm mb-4"
          )}
        >
          <p>
            ⏱️ {roomSettings.drawTimeSeconds}s • 🔄 {roomSettings.totalRounds}{" "}
            round
            {roomSettings.totalRounds !== 1 ? "s" : ""} • 🎯{" "}
            {roomSettings.difficulty}
          </p>
        </div>
      )}

      {isHost ? (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartGame}
          disabled={isStarting || players.length < 2}
          className={cn(
            "rounded-lg font-semibold transition-all",
            isMobile ? "px-6 py-2" : "px-8 py-3 text-lg",
            players.length < 2
              ? "bg-card-border text-white/40 cursor-not-allowed"
              : "bg-success text-white hover:bg-success-hover border-2 border-success-dark"
          )}
        >
          {isStarting
            ? "Starting..."
            : players.length < 2
            ? "Need 2+ players"
            : "Start Game"}
        </motion.button>
      ) : (
        <p className={cn("text-white/60", isMobile && "text-sm")}>
          Waiting for host to start...
        </p>
      )}
    </motion.div>
  );
}
