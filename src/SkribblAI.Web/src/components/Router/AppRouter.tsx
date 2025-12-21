import { useMemo } from "react";
import { JoinScreen } from "@/components/Lobby";
import { GameScreen } from "@/components/Game";
import { useRoomStore } from "@/stores/roomStore";
import type { RoomSettings } from "@/models";

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
  const roomCode = useRoomStore((s) => s.roomCode);
  const createRoom = useRoomStore((s) => s.createRoom);
  const joinRoom = useRoomStore((s) => s.joinRoom);

  // Only compute once on mount
  const inviteRoomCode = useMemo(() => getInitialRoomCode(), []);

  const handleJoinGame = async (
    name: string,
    room: string,
    isCreating: boolean,
    isPublic: boolean = false,
    settings?: RoomSettings
  ) => {
    if (isCreating) {
      await createRoom(name, room, isPublic, settings);
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
