import type { PublicRoom } from "@/models";
import { PublicRoomCard } from "@/components/Lobby";
import { Button } from "@/components/ui";

interface PublicRoomsTabProps {
  publicRooms: PublicRoom[];
  isLoadingRooms: boolean;
  onRefresh: () => void;
  onJoinRoom: (room: PublicRoom) => void;
  isJoining: boolean;
  hasUsername: boolean;
  error: string | null;
}

export default function PublicRoomsTab({
  publicRooms,
  isLoadingRooms,
  onRefresh,
  onJoinRoom,
  isJoining,
  hasUsername,
  error,
}: PublicRoomsTabProps) {
  const isDisabled = isJoining || !hasUsername;

  return (
    <div className="flex flex-col gap-4">
      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <p className="text-white/60 text-sm">
          {publicRooms.length} room{publicRooms.length !== 1 ? "s" : ""}{" "}
          available
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoadingRooms}
          leftIcon={
            <span className={isLoadingRooms ? "animate-spin" : ""}>🔄</span>
          }
        >
          Refresh
        </Button>
      </div>

      {/* Room List */}
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {isLoadingRooms ? (
          <div className="text-center py-8">
            <div className="text-4xl animate-bounce mb-2">🔍</div>
            <p className="text-white/60">Finding games...</p>
          </div>
        ) : publicRooms.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">😴</div>
            <p className="text-white/60">No public games available</p>
            <p className="text-white/40 text-sm mt-1">
              Create one and invite friends!
            </p>
          </div>
        ) : (
          publicRooms.map((room) => (
            <PublicRoomCard
              key={room.roomCode}
              room={room}
              onJoin={onJoinRoom}
              isDisabled={isDisabled}
            />
          ))
        )}
      </div>

      {error && (
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!hasUsername && publicRooms.length > 0 && (
        <p className="text-warning text-sm text-center">
          ⚠️ Enter your name above to join a game
        </p>
      )}
    </div>
  );
}
