import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { cn } from "@/lib/utils";

export default function GamePhaseIndicator() {
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const roundNumber = useGameStore((s) => s.roundNumber);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const players = useRoomStore((s) => s.players);

  const getPhaseContent = () => {
    switch (phase) {
      case "lobby":
        return {
          icon: "⏳",
          title: "Waiting for players...",
          subtitle:
            players.length < 2
              ? "Need at least 2 players to start"
              : "Host can start the game!",
          color: "text-white/70",
          bgColor: "bg-card-border",
        };

      case "wordSelection":
        return {
          icon: "🤔",
          title: `${
            currentDrawer?.username || "Someone"
          } is choosing a word...`,
          subtitle: "Get ready to guess!",
          color: "text-info",
          bgColor: "bg-info/20",
        };

      case "drawing":
        return {
          icon: "🎨",
          title: `Round ${roundNumber} of ${totalRounds}`,
          subtitle: `${currentDrawer?.username || "Someone"} is drawing`,
          color: "text-success",
          bgColor: "bg-success/20",
          showTimer: true,
        };

      case "roundEnd":
        return {
          icon: "✨",
          title: "Round Complete!",
          subtitle: "See who guessed correctly",
          color: "text-accent",
          bgColor: "bg-accent/20",
        };

      case "gameEnd":
        return {
          icon: "🏆",
          title: "Game Over!",
          subtitle: "Final scores are in",
          color: "text-warning",
          bgColor: "bg-warning/20",
        };

      default:
        return {
          icon: "🎮",
          title: "Loading...",
          subtitle: "",
          color: "text-white/50",
          bgColor: "bg-card-border",
        };
    }
  };

  const content = getPhaseContent();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? `${mins}:${secs.toString().padStart(2, "0")}`
      : `${secs}s`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-300 mb-3",
        content.bgColor
      )}
    >
      <span className="text-2xl">{content.icon}</span>
      <div className="flex-1">
        <p className={cn("font-bold text-sm", content.color)}>
          {content.title}
        </p>
        {content.subtitle && (
          <p className="text-white/50 text-xs">{content.subtitle}</p>
        )}
      </div>
      {content.showTimer && timeRemaining > 0 && (
        <motion.div
          key={timeRemaining <= 10 ? "warning" : "normal"}
          initial={timeRemaining <= 10 ? { scale: 1.1 } : {}}
          animate={
            timeRemaining <= 10
              ? {
                  scale: [1, 1.1, 1],
                  transition: { repeat: Infinity, duration: 0.5 },
                }
              : { scale: 1 }
          }
          className={cn(
            "px-3 py-1 rounded-lg font-mono font-bold text-lg",
            timeRemaining <= 10
              ? "bg-danger text-white"
              : timeRemaining <= 30
              ? "bg-warning text-background"
              : "bg-success text-white"
          )}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={timeRemaining}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              {formatTime(timeRemaining)}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
