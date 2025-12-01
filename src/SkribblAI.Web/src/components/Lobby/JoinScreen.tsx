import { useState } from "react";
import { parseHubError } from "@/lib/utils";

interface JoinScreenProps {
  onJoinGame: (
    username: string,
    roomCode: string,
    isCreating: boolean
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

export default function JoinScreen({
  onJoinGame,
  initialRoomCode,
}: JoinScreenProps) {
  const [username, setUsername] = useState("");
  // Initialize roomCode and isCreatingRoom based on whether we have an invite link
  const [roomCode, setRoomCode] = useState(initialRoomCode ?? "");
  const [isCreatingRoom, setIsCreatingRoom] = useState(!initialRoomCode);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        await onJoinGame(username.trim(), newRoomCode, true);
      } catch (err) {
        setError(parseHubError(err));
        setIsJoining(false);
      }
    }
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
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-lg transition-all duration-200 border-4 ${
                !isCreatingRoom
                  ? "bg-success text-white border-success-dark shadow-lg transform scale-105"
                  : "bg-card-border text-white/70 border-card-border-hover hover:bg-card-border-hover"
              }`}
              onClick={() => setIsCreatingRoom(false)}
            >
              🚪 Join Room
            </button>
            <button
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-lg transition-all duration-200 border-4 ${
                isCreatingRoom
                  ? "bg-info text-white border-info-dark shadow-lg transform scale-105"
                  : "bg-card-border text-white/70 border-card-border-hover hover:bg-card-border-hover"
              }`}
              onClick={() => setIsCreatingRoom(true)}
            >
              ✨ Create Room
            </button>
          </div>

          {/* Form */}
          <form
            onSubmit={isCreatingRoom ? handleCreateRoom : handleJoinRoom}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
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
                required
                className="px-4 py-4 bg-background border-4 border-card-border rounded-2xl text-lg text-white font-medium transition-all duration-200 focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/20 placeholder:text-white/30"
              />
            </div>

            {!isCreatingRoom && (
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
            )}

            {error && (
              <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isJoining}
              className={`py-4 mt-2 text-white border-4 rounded-2xl text-xl font-black transition-all duration-200 ${
                isJoining
                  ? "opacity-70 cursor-not-allowed"
                  : "cursor-pointer hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-md"
              } ${
                isCreatingRoom
                  ? "bg-info border-info-dark hover:bg-info-hover"
                  : "bg-success border-success-dark hover:bg-success-hover"
              }`}
            >
              {isJoining
                ? "⏳ Connecting..."
                : isCreatingRoom
                ? "🎮 CREATE & PLAY!"
                : "🚀 JOIN GAME!"}
            </button>
          </form>
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
