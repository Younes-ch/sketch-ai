import { cn } from "@/lib/utils";

interface CreateRoomTabProps {
  isPublicRoom: boolean;
  onTogglePublic: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isJoining: boolean;
  isDisabled: boolean;
  error: string | null;
}

export default function CreateRoomTab({
  isPublicRoom,
  onTogglePublic,
  onSubmit,
  isJoining,
  isDisabled,
  error,
}: CreateRoomTabProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Public/Private Toggle */}
      <div className="flex items-center justify-between bg-background rounded-2xl p-4 border-2 border-card-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">{isPublicRoom ? "🌍" : "🔒"}</span>
          <div>
            <p className="text-white font-bold text-sm">
              {isPublicRoom ? "Public Room" : "Private Room"}
            </p>
            <p className="text-white/50 text-xs">
              {isPublicRoom
                ? "Anyone can find and join"
                : "Only with room code"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTogglePublic}
          className={cn(
            "relative w-14 h-8 rounded-full transition-colors duration-200",
            isPublicRoom ? "bg-success" : "bg-card-border"
          )}
        >
          <div
            className={cn(
              "absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-200",
              isPublicRoom ? "translate-x-7" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {error && (
        <div className="bg-danger/20 border-2 border-danger rounded-xl p-3 text-danger text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isJoining || isDisabled}
        className={cn(
          "py-4 mt-2 text-white border-4 rounded-2xl text-xl font-black transition-all duration-200 bg-info border-info-dark hover:bg-info-hover",
          isJoining || isDisabled
            ? "opacity-70 cursor-not-allowed"
            : "cursor-pointer hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md"
        )}
      >
        {isJoining ? "⏳ Creating..." : "🎮 CREATE & PLAY!"}
      </button>
    </form>
  );
}
