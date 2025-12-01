import { useState, useEffect } from "react";
import { parseHubError } from "@/lib/utils";
import { useSignalR } from "@/hooks/useSignalR";
import type { PublicRoom } from "@/models/publicRoom";

interface JoinScreenProps {
  onJoinGame: (
    username: string,
    roomCode: string,
    isCreating: boolean,
    isPublic?: boolean
  ) => Promise<void>;
  initialRoomCode?: string | null;
}

// Skribbl-style color palette for decorative elements
const COLORS = [
  "bg-accent",
  "bg-success",
  "bg-info",
  "bg-danger",
  "bg-[#9C27B0]",
  "bg-warning",
  "bg-[#E91E63]",
  "bg-[#00BCD4]",
];

type TabType = "join" | "create" | "public";

export default function JoinScreen({
  onJoinGame,
  initialRoomCode,
}: JoinScreenProps) {
  const { getPublicRooms, onReceivePublicRooms, connectionState } =
    useSignalR();

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");
  const [activeTab, setActiveTab] = useState<TabType>(
    initialRoomCode ? "join" : "create"
  );
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isPublicRoom, setIsPublicRoom] = useState(true);

  // Fetch public rooms when switching to public tab
  useEffect(() => {
    if (activeTab === "public" && connectionState === "Connected") {
      setIsLoadingRooms(true);
      getPublicRooms();
    }
  }, [activeTab, connectionState, getPublicRooms]);

  // Subscribe to public rooms updates
  useEffect(() => {
    const unsubscribe = onReceivePublicRooms((rooms) => {
      setPublicRooms(rooms);
      setIsLoadingRooms(false);
    });
    return unsubscribe;
  }, [onReceivePublicRooms]);

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
    setIsLoadingRooms(true);
    getPublicRooms();
  };

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
            {COLORS.map((colorClass, i) => (
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
            <button
              className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-base transition-all duration-200 border-4 ${
                activeTab === "join"
                  ? "bg-success text-white border-success-dark shadow-lg transform scale-105"
                  : "bg-card-border text-white/70 border-card-border-hover hover:bg-card-border-hover"
              }`}
              onClick={() => setActiveTab("join")}
            >
              🚪 Join
            </button>
            <button
              className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-base transition-all duration-200 border-4 ${
                activeTab === "create"
                  ? "bg-info text-white border-info-dark shadow-lg transform scale-105"
                  : "bg-card-border text-white/70 border-card-border-hover hover:bg-card-border-hover"
              }`}
              onClick={() => setActiveTab("create")}
            >
              ✨ Create
            </button>
            <button
              className={`flex-1 py-2.5 px-3 rounded-2xl font-bold text-base transition-all duration-200 border-4 ${
                activeTab === "public"
                  ? "bg-accent text-background border-accent-hover shadow-lg transform scale-105"
                  : "bg-card-border text-white/70 border-card-border-hover hover:bg-card-border-hover"
              }`}
              onClick={() => setActiveTab("public")}
            >
              🌍 Public
            </button>
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

          {/* Join Room Tab */}
          {activeTab === "join" && (
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
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
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
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
                disabled={isJoining || !username.trim()}
                className={`py-4 mt-2 text-white border-4 rounded-2xl text-xl font-black transition-all duration-200 bg-success border-success-dark hover:bg-success-hover ${
                  isJoining || !username.trim()
                    ? "opacity-70 cursor-not-allowed"
                    : "cursor-pointer hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md"
                }`}
              >
                {isJoining ? "⏳ Connecting..." : "🚀 JOIN GAME!"}
              </button>
            </form>
          )}

          {/* Create Room Tab */}
          {activeTab === "create" && (
            <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
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
                  onClick={() => setIsPublicRoom(!isPublicRoom)}
                  className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                    isPublicRoom ? "bg-success" : "bg-card-border"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 ${
                      isPublicRoom ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {error && (
                <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isJoining || !username.trim()}
                className={`py-4 mt-2 text-white border-4 rounded-2xl text-xl font-black transition-all duration-200 bg-info border-info-dark hover:bg-info-hover ${
                  isJoining || !username.trim()
                    ? "opacity-70 cursor-not-allowed"
                    : "cursor-pointer hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md"
                }`}
              >
                {isJoining ? "⏳ Creating..." : "🎮 CREATE & PLAY!"}
              </button>
            </form>
          )}

          {/* Public Rooms Tab */}
          {activeTab === "public" && (
            <div className="flex flex-col gap-4">
              {/* Refresh Button */}
              <div className="flex justify-between items-center">
                <p className="text-white/60 text-sm">
                  {publicRooms.length} room{publicRooms.length !== 1 ? "s" : ""}{" "}
                  available
                </p>
                <button
                  onClick={refreshPublicRooms}
                  disabled={isLoadingRooms}
                  className="text-accent hover:text-accent-hover text-sm font-bold flex items-center gap-1 transition-colors"
                >
                  <span className={isLoadingRooms ? "animate-spin" : ""}>
                    🔄
                  </span>
                  Refresh
                </button>
              </div>

              {/* Room List */}
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
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
                    <button
                      key={room.roomCode}
                      onClick={() => handleJoinPublicRoom(room)}
                      disabled={isJoining || !username.trim()}
                      className={`w-full bg-background rounded-xl p-4 border-2 border-card-border hover:border-accent hover:bg-background/80 transition-all text-left flex items-center justify-between ${
                        isJoining || !username.trim()
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                    >
                      <div>
                        <p className="text-white font-bold flex items-center gap-2">
                          <span>👑</span> {room.hostUsername}'s Game
                        </p>
                        <p className="text-white/50 text-sm font-mono">
                          {room.roomCode}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            room.playerCount >= room.maxPlayers - 1
                              ? "text-warning"
                              : "text-success"
                          }`}
                        >
                          {room.playerCount}/{room.maxPlayers}
                        </p>
                        <p className="text-white/40 text-xs">players</p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {error && (
                <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {!username.trim() && publicRooms.length > 0 && (
                <p className="text-warning text-sm text-center">
                  ⚠️ Enter your name above to join a game
                </p>
              )}
            </div>
          )}
        </div>

        {/* How to Play */}
        <div className="mt-6 bg-card/80 rounded-2xl p-5 border-2 border-card-border">
          <h3 className="text-white font-bold text-lg mb-3 text-center">
            📖 How to Play
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">🎨</div>
              <p className="text-white/80 text-sm font-medium">
                One player draws
              </p>
            </div>
            <div className="bg-background rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">💬</div>
              <p className="text-white/80 text-sm font-medium">
                Others guess the word
              </p>
            </div>
            <div className="bg-background rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">⚡</div>
              <p className="text-white/80 text-sm font-medium">
                Fast guesses = more points
              </p>
            </div>
            <div className="bg-background rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">🤖</div>
              <p className="text-white/80 text-sm font-medium">
                AI joins the fun!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
