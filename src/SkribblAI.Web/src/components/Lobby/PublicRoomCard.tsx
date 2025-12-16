import type { PublicRoom } from "@/models";
import { cn } from "@/lib/utils";

interface PublicRoomCardProps {
  room: PublicRoom;
  onJoin: (room: PublicRoom) => void;
  isDisabled: boolean;
}

export default function PublicRoomCard({
  room,
  onJoin,
  isDisabled,
}: PublicRoomCardProps) {
  return (
    <button
      onClick={() => onJoin(room)}
      disabled={isDisabled}
      className={cn(
        "w-full bg-background rounded-xl p-4 border-2 border-card-border hover:border-accent hover:bg-background/80 transition-all text-left flex items-center justify-between",
        isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <div>
        <p className="text-white font-bold flex items-center gap-2">
          <span>👑</span> {room.hostUsername}'s Game
        </p>
        <p className="text-white/50 text-sm font-mono">{room.roomCode}</p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "font-bold",
            room.playerCount >= room.maxPlayers - 1
              ? "text-warning"
              : "text-success"
          )}
        >
          {room.playerCount}/{room.maxPlayers}
        </p>
        <p className="text-white/40 text-xs">players</p>
      </div>
    </button>
  );
}
