import type { Player } from "@/models";

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

  return (
    <div
      className={`bg-card rounded-2xl p-4 border-4 border-card-border flex flex-col ${
        isDesktop ? "shadow-none" : "shadow-lg h-full"
      }`}
    >
      <h3
        className={`text-white font-bold mb-3 flex items-center gap-2 shrink-0 ${
          isDesktop ? "text-sm" : "text-lg"
        }`}
      >
        <span>👥</span> PLAYERS
      </h3>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {players.map((player) => (
          <div
            key={player.username}
            className={`${
              player.isHost ? "bg-success" : "bg-card-border"
            } rounded-xl p-3 flex items-center ${
              isDesktop ? "gap-2" : "gap-3"
            }`}
          >
            {player.isHost && (
              <span className={isDesktop ? "text-sm" : "text-lg"}>👑</span>
            )}
            <span className={isDesktop ? "text-xl" : "text-2xl"}>
              {player.username === currentUsername ? "🎨" : "👤"}
            </span>
            <div className="flex-1 min-w-0">
              <span
                className={`text-white font-bold truncate block ${
                  isDesktop ? "text-sm" : ""
                }`}
              >
                {player.username}
              </span>
              {player.username === currentUsername && (
                <p
                  className={`text-white/70 ${
                    isDesktop ? "text-xs" : "text-xs"
                  }`}
                >
                  Drawing...
                </p>
              )}
            </div>
            <span
              className={`text-white font-bold ${
                isDesktop ? "text-lg" : "text-lg"
              }`}
            >
              {player.score}
            </span>
          </div>
        ))}

        {players.length <= 1 && (
          <p
            className={`text-white/40 text-center ${
              isDesktop ? "text-xs mt-4 py-4" : "text-sm mt-6 py-8"
            }`}
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
