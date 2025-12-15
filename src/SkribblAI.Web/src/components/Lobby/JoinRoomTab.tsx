interface JoinRoomTabProps {
  roomCode: string;
  onRoomCodeChange: (code: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isJoining: boolean;
  isDisabled: boolean;
  error: string | null;
}

export default function JoinRoomTab({
  roomCode,
  onRoomCodeChange,
  onSubmit,
  isJoining,
  isDisabled,
  error,
}: JoinRoomTabProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="roomCode"
          className="font-bold text-white text-sm flex items-center gap-2"
        >
          <span>🔑</span> ROOM CODE
        </label>
        <input
          type="text"
          id="roomCode"
          value={roomCode}
          onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
          placeholder="Enter 6-character code..."
          maxLength={6}
          required
          className="px-4 py-4 bg-background border-4 border-card-border rounded-2xl text-lg text-white font-mono font-bold tracking-widest transition-all duration-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/20 placeholder:text-white/30 placeholder:font-normal placeholder:tracking-normal"
        />
      </div>

      {error && (
        <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isJoining || isDisabled}
        className={`py-4 mt-2 text-white border-4 rounded-2xl text-xl font-black transition-all duration-200 bg-success border-success-dark hover:bg-success-hover ${
          isJoining || isDisabled
            ? "opacity-70 cursor-not-allowed"
            : "cursor-pointer hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md"
        }`}
      >
        {isJoining ? "⏳ Connecting..." : "🚀 JOIN GAME!"}
      </button>
    </form>
  );
}
