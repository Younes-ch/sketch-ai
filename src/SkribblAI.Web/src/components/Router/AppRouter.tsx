import { useEffect, useMemo, useState } from "react";
import { JoinScreen } from "@/components/Lobby";
import { GameScreen } from "@/components/Game";
import { useSignalR } from "@/hooks/useSignalR";

// Get invite room code from URL once (outside component to avoid re-running)
function getInitialRoomCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get("room");
  if (roomParam) {
    // Clean up URL without reload
    window.history.replaceState({}, "", window.location.pathname);
    return roomParam.toUpperCase();
  }
  return null;
}

export default function AppRouter() {
  const {
    roomCode,
    connectionState,
    isReconnecting,
    createRoom,
    joinRoom,
    attemptReconnect,
  } = useSignalR();
  const [hasAttemptedReconnect, setHasAttemptedReconnect] = useState(false);

  // Only compute once on mount
  const inviteRoomCode = useMemo(() => getInitialRoomCode(), []);

  // Attempt to reconnect to previous session on mount
  useEffect(() => {
    // Only attempt once, when connected, and if no invite link is present
    if (
      hasAttemptedReconnect ||
      connectionState !== "Connected" ||
      inviteRoomCode
    ) {
      return;
    }

    setHasAttemptedReconnect(true);
    attemptReconnect();
  }, [
    connectionState,
    hasAttemptedReconnect,
    inviteRoomCode,
    attemptReconnect,
  ]);

  const handleJoinGame = async (
    name: string,
    room: string,
    isCreating: boolean,
    isPublic: boolean = false
  ) => {
    if (isCreating) {
      await createRoom(name, room, isPublic);
    } else {
      await joinRoom(name, room);
    }
  };

  // Show reconnecting state
  if (isReconnecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="bg-card rounded-3xl p-8 shadow-2xl border-4 border-card-border text-center">
          <div className="text-6xl mb-4 animate-bounce">🔄</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Reconnecting...
          </h1>
          <p className="text-white/60">Getting you back into the game!</p>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <JoinScreen
        onJoinGame={handleJoinGame}
        initialRoomCode={inviteRoomCode}
      />
    );
  }

  return <GameScreen />;
}
