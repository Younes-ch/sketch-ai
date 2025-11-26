import { useMemo } from "react";
import JoinScreen from "@/components/Lobby/JoinScreen";
import GameScreen from "@/components/Game/GameScreen";
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
  const { roomCode, createRoom, joinRoom } = useSignalR();

  // Only compute once on mount
  const inviteRoomCode = useMemo(() => getInitialRoomCode(), []);

  const handleJoinGame = async (
    name: string,
    room: string,
    isCreating: boolean
  ) => {
    if (isCreating) {
      await createRoom(name, room);
    } else {
      await joinRoom(name, room);
    }
  };

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
