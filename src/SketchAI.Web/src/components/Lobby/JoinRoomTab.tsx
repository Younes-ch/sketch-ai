import { Button, Input } from "@/components/ui";

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
      <Input
        id="roomCode"
        label="ROOM CODE"
        leftIcon={<span>🔑</span>}
        value={roomCode}
        onChange={(e) => onRoomCodeChange(e.target.value.toUpperCase())}
        placeholder="Enter 6-character code..."
        maxLength={6}
        required
        className="font-mono font-bold tracking-widest text-lg h-14"
      />

      {error && (
        <div className="bg-danger/20 border-2 border-danger rounded-xl p-3 text-danger text-sm animate-in slide-in-from-top-2 fade-in-0">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="success"
        size="lg"
        isLoading={isJoining}
        disabled={isDisabled}
        className="mt-2 text-xl font-black w-full"
      >
        {isJoining ? "Connecting..." : "JOIN GAME!"}
      </Button>
    </form>
  );
}
