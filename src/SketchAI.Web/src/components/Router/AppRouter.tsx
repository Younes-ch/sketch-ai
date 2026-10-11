import { lazy, Suspense, useMemo } from "react";
import { JoinScreen } from "@/components/Lobby";
import { useRoomStore } from "@/stores/roomStore";
import { defaultRoomSettings, type RoomSettings } from "@/models";

// Loaded on demand so the landing page doesn't download/parse the game code
const loadGameScreen = () => import("@/components/Game/GameScreen");
const GameScreen = lazy(loadGameScreen);

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
    void loadGameScreen(); // download alongside the server call, not after it
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

  return (
    <Suspense fallback={null}>
      <GameScreen />
    </Suspense>
  );
}
