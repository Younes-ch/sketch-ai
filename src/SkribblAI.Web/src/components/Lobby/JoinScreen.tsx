import {
  CreateRoomTab,
  HowToPlay,
  JoinRoomTab,
  PublicRoomsTab,
  TabButton,
} from "@/components/Lobby";
import { DECORATIVE_COLORS } from "@/constants/colors";
import { parseHubError } from "@/lib/utils";
import type { PublicRoom } from "@/models";
import { useConnectionStore } from "@/stores/connectionStore";
import { useRoomStore } from "@/stores/roomStore";
import { useState } from "react";

interface JoinScreenProps {
  onJoinGame: (
    username: string,
    roomCode: string,
    isCreating: boolean,
    isPublic?: boolean
  ) => Promise<void>;
  initialRoomCode?: string | null;
}

type TabType = "join" | "create" | "public";

export default function JoinScreen({
  onJoinGame,
  initialRoomCode,
}: JoinScreenProps) {
  const connectionState = useConnectionStore((s) => s.connectionState);
  const publicRooms = useRoomStore((s) => s.publicRooms);
  const isLoadingRooms = useRoomStore((s) => s.isLoadingRooms);
  const getPublicRooms = useRoomStore((s) => s.getPublicRooms);

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");
  const [activeTab, setActiveTab] = useState<TabType>(
    initialRoomCode ? "join" : "create"
  );
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublicRoom, setIsPublicRoom] = useState(true);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "public" && connectionState === "Connected") {
      getPublicRooms();
    }
  };

  const generateRoomCode = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return result;
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && roomCode.trim()) {
      setIsJoining(true);
      setError(null);
      try {
        await onJoinGame(username.trim(), roomCode.trim().toUpperCase(), false);
      } catch (err) {
        setError(parseHubError(err));
        setIsJoining(false);
      }
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsJoining(true);
      setError(null);
      try {
        const newRoomCode = generateRoomCode();
        await onJoinGame(username.trim(), newRoomCode, true, isPublicRoom);
      } catch (err) {
        setError(parseHubError(err));
        setIsJoining(false);
      }
    }
  };

  const handleJoinPublicRoom = async (room: PublicRoom) => {
    if (!username.trim()) {
      setError("Please enter your name first");
      return;
    }
    setIsJoining(true);
    setError(null);
    try {
      await onJoinGame(username.trim(), room.roomCode, false);
    } catch (err) {
      setError(parseHubError(err));
      setIsJoining(false);
    }
  };

  const refreshPublicRooms = () => {
    getPublicRooms();
  };

  const hasUsername = username.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Floating decorative elements */}
      <div
        className="absolute top-10 left-10 text-6xl animate-bounce"
        style={{ animationDelay: "0s" }}
      >
        ✏️
      </div>
      <div
        className="absolute top-20 right-20 text-5xl animate-bounce"
        style={{ animationDelay: "0.5s" }}
      >
        🎨
      </div>
      <div
        className="absolute bottom-20 left-20 text-5xl animate-bounce"
        style={{ animationDelay: "1s" }}
      >
        🖌️
      </div>
      <div
        className="absolute bottom-10 right-10 text-6xl animate-bounce"
        style={{ animationDelay: "1.5s" }}
      >
        🎯
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="text-7xl font-black tracking-tight mb-2 drop-shadow-lg">
            <span className="text-accent">skribbl</span>
            <span className="text-white">.ai</span>
          </h1>
          <div className="flex justify-center gap-1 mb-2">
            {DECORATIVE_COLORS.map((colorClass, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transform hover:scale-125 transition-transform cursor-pointer ${colorClass}`}
              />
            ))}
          </div>
          <p className="text-white/70 text-lg font-medium">
            Draw, Guess & Have Fun! 🎉
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-3xl p-6 shadow-2xl border-4 border-card-border">
          {/* Tab Buttons */}
          <div className="flex gap-2 mb-6">
            <TabButton
              label="Join"
              icon="🚪"
              isActive={activeTab === "join"}
              activeColor="success"
              onClick={() => handleTabChange("join")}
            />
            <TabButton
              label="Create"
              icon="✨"
              isActive={activeTab === "create"}
              activeColor="info"
              onClick={() => handleTabChange("create")}
            />
            <TabButton
              label="Public"
              icon="🌍"
              isActive={activeTab === "public"}
              activeColor="accent"
              onClick={() => handleTabChange("public")}
            />
          </div>

          {/* Username Input - Always Visible */}
          <div className="flex flex-col gap-2 mb-4">
            <label
              htmlFor="username"
              className="font-bold text-white text-sm flex items-center gap-2"
            >
              <span>👤</span> YOUR NAME
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a cool nickname..."
              maxLength={20}
              className="px-4 py-4 bg-background border-4 border-card-border rounded-2xl text-lg text-white font-medium transition-all duration-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/20 placeholder:text-white/30"
            />
          </div>

          {/* Tab Content */}
          {activeTab === "join" && (
            <JoinRoomTab
              roomCode={roomCode}
              onRoomCodeChange={setRoomCode}
              onSubmit={handleJoinRoom}
              isJoining={isJoining}
              isDisabled={!hasUsername}
              error={error}
            />
          )}

          {activeTab === "create" && (
            <CreateRoomTab
              isPublicRoom={isPublicRoom}
              onTogglePublic={() => setIsPublicRoom(!isPublicRoom)}
              onSubmit={handleCreateRoom}
              isJoining={isJoining}
              isDisabled={!hasUsername}
              error={error}
            />
          )}

          {activeTab === "public" && (
            <PublicRoomsTab
              publicRooms={publicRooms}
              isLoadingRooms={isLoadingRooms}
              onRefresh={refreshPublicRooms}
              onJoinRoom={handleJoinPublicRoom}
              isJoining={isJoining}
              hasUsername={hasUsername}
              error={error}
            />
          )}
        </div>

        {/* How to Play */}
        <HowToPlay />
      </div>
    </div>
  );
}
