import type { PublicRoom } from "@/models";
import { PublicRoomCard } from "@/components/Lobby";
import { Button } from "@/components/ui";

interface PublicRoomsPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PublicRoomsTabProps {
  publicRooms: PublicRoom[];
  isLoadingRooms: boolean;
  pagination: PublicRoomsPagination;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onJoinRoom: (room: PublicRoom) => void;
  isJoining: boolean;
  hasUsername: boolean;
  error: string | null;
}

export default function PublicRoomsTab({
  publicRooms,
  isLoadingRooms,
  pagination,
  onRefresh,
  onPageChange,
  onJoinRoom,
  isJoining,
  hasUsername,
  error,
}: PublicRoomsTabProps) {
  const isDisabled = isJoining || !hasUsername;

  const handlePreviousPage = () => {
    if (pagination.hasPreviousPage && !isLoadingRooms) {
      onPageChange(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage && !isLoadingRooms) {
      onPageChange(pagination.page + 1);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header with room count and refresh */}
      <div className="flex justify-between items-center">
        <p className="text-white/60 text-sm">
          {pagination.totalCount} room{pagination.totalCount !== 1 ? "s" : ""}{" "}
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
      <div className="min-h-64 max-h-64 overflow-y-auto space-y-2 pr-1">
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

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!pagination.hasPreviousPage || isLoadingRooms}
            leftIcon={<span>◀️</span>}
          >
            Prev
          </Button>

          <div className="flex items-center gap-1">
            {/* Page indicator */}
            <span className="text-white/80 text-sm font-medium px-3 py-1 bg-white/10 rounded-lg">
              {pagination.page} / {pagination.totalPages}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextPage}
            disabled={!pagination.hasNextPage || isLoadingRooms}
            rightIcon={<span>▶️</span>}
          >
            Next
          </Button>
        </div>
      )}

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
