import type { Player } from "@/models";
import { useGameStore } from "@/stores/gameStore";
import { cn } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  currentUsername: string;
  roomCode?: string;
  variant?: "desktop" | "mobile";
}

export default function PlayerList({
  players,
  currentUsername,
  roomCode,
  variant = "desktop",
}: PlayerListProps) {
  const isDesktop = variant === "desktop";
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const playersWhoGuessed = useGameStore((s) => s.playersWhoGuessed);

  const currentDrawerUsername = currentDrawer?.username;
  const isDrawingPhase = phase === "drawing" || phase === "wordSelection";

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-4 border-4 border-card-border flex flex-col h-full",
        isDesktop ? "shadow-none" : "shadow-lg"
      )}
    >
      <h3
        className={cn(
          "text-white font-bold mb-3 flex items-center gap-2 shrink-0",
          isDesktop ? "text-sm" : "text-lg"
        )}
      >
        <span>👥</span> PLAYERS
      </h3>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {players.map((player) => {
          const isCurrentDrawer =
            player.username === currentDrawerUsername && isDrawingPhase;
          const hasGuessedCorrectly =
            playersWhoGuessed.has(player.username) && isDrawingPhase;

          return (
            <div
              key={player.username}
              className={cn(
                "rounded-xl p-3 flex items-center",
                isDesktop ? "gap-2" : "gap-3",
                isCurrentDrawer
                  ? "bg-success"
                  : hasGuessedCorrectly
                  ? "bg-success/60"
                  : "bg-card-border"
              )}
            >
              {player.isHost && (
                <span className={isDesktop ? "text-sm" : "text-lg"}>👑</span>
              )}
              <span
                className={cn(
                  "text-white",
                  isDesktop ? "text-xl" : "text-2xl"
                )}
              >
                {isCurrentDrawer ? "🎨" : hasGuessedCorrectly ? "✓" : "👤"}
              </span>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    "text-white font-bold truncate block",
                    isDesktop ? "text-sm" : ""
                  )}
                >
                  {player.username}
                  {player.username === currentUsername && " (You)"}
                </span>
                {isCurrentDrawer && (
                  <p className="text-white/70 text-xs">Drawing...</p>
                )}
                {hasGuessedCorrectly && !isCurrentDrawer && (
                  <p className="text-white/70 text-xs">Guessed!</p>
                )}
              </div>
              <span
                className={cn(
                  "text-white font-bold",
                  isDesktop ? "text-lg" : "text-lg"
                )}
              >
                {player.score}
              </span>
            </div>
          );
        })}

        {players.length <= 1 && (
          <p
            className={cn(
              "text-white/40 text-center",
              isDesktop ? "text-xs mt-4 py-4" : "text-sm mt-6 py-8"
            )}
          >
            Waiting for more players to join...
            {!isDesktop && roomCode && (
              <>
                <br />
                Share the room code:{" "}
                <span className="text-accent font-bold">{roomCode}</span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
