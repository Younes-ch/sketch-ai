import { useMemo } from "react";
import { JoinScreen } from "@/components/Lobby";
import { GameScreen } from "@/components/Game";
import { useRoomStore } from "@/stores/roomStore";
import { defaultRoomSettings, type RoomSettings } from "@/models";

// Get invite room code from URL once (outside component to avoid re-running)
function getInitialRoomCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get("room");
  if (roomParam) {
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
    roomName: string,
    room: string,
    isCreating: boolean,
    isPublic: boolean = false,
    settings: RoomSettings = defaultRoomSettings,
    captchaToken?: string,
  ) => {
    if (isCreating) {
      await createRoom(name, roomName, room, isPublic, settings, captchaToken);
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
