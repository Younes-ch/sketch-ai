import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Player } from "@/models";
import { useConfetti } from "@/components/effects/Confetti";

interface PodiumProps {
  players: Player[];
}

export default function Podium({ players }: PodiumProps) {
  const { fireMultiple } = useConfetti();
  const [revealedPositions, setRevealedPositions] = useState<number[]>([]);

  // Sort players by score and get top 3
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const topThree = sortedPlayers.slice(0, 3);

  // Podium positions: [1st place, 2nd place, 3rd place]
  // But we display them as [2nd, 1st, 3rd] for visual layout
  const first = topThree[0];
  const second = topThree[1];
  const third = topThree[2];

  // Sequential reveal animation
  useEffect(() => {
    setRevealedPositions([]);

    // Reveal 3rd place after 500ms
    const timer1 = setTimeout(() => {
      setRevealedPositions((prev) => [...prev, 3]);
    }, 500);

    // Reveal 2nd place after 1200ms
    const timer2 = setTimeout(() => {
      setRevealedPositions((prev) => [...prev, 2]);
    }, 1200);

    // Reveal 1st place after 2000ms
    const timer3 = setTimeout(() => {
      setRevealedPositions((prev) => [...prev, 1]);
    }, 2000);

    // Fire confetti after 1st place reveal
    const timer4 = setTimeout(() => {
      fireMultiple();
    }, 2200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [fireMultiple]);

  const getMedalEmoji = (position: number) => {
    switch (position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  const getPodiumHeight = (position: number) => {
    switch (position) {
      case 1:
        return 96; // h-24
      case 2:
        return 64; // h-16
      case 3:
        return 48; // h-12
      default:
        return 32;
    }
  };

  const getPodiumColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-t from-yellow-600 to-yellow-400";
      case 2:
        return "bg-gradient-to-t from-gray-500 to-gray-300";
      case 3:
        return "bg-gradient-to-t from-amber-700 to-amber-500";
      default:
        return "bg-card-border";
    }
  };

  const renderPodiumPosition = (
    player: Player | undefined,
    position: number
  ) => {
    if (!player) return null;

    const isRevealed = revealedPositions.includes(position);
    const podiumHeight = getPodiumHeight(position);

    return (
      <div className="flex flex-col items-center">
        <AnimatePresence>
          {isRevealed && (
            <>
              {/* Player info */}
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.1,
                }}
                className="mb-2 text-center"
              >
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    delay: 0.2,
                  }}
                  className="text-3xl mb-1"
                >
                  {getMedalEmoji(position)}
                </motion.div>
                <p
                  className={cn(
                    "font-bold truncate max-w-[100px]",
                    position === 1
                      ? "text-lg text-yellow-400"
                      : "text-sm text-white"
                  )}
                >
                  {player.username}
                </p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    "font-mono",
                    position === 1 ? "text-yellow-300" : "text-white/70"
                  )}
                >
                  {player.score} pts
                </motion.p>
              </motion.div>

              {/* Podium block */}
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: podiumHeight, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 100,
                  damping: 15,
                }}
                className={cn(
                  "w-20 sm:w-24 rounded-t-lg flex items-end justify-center pb-2",
                  getPodiumColor(position)
                )}
              >
                <span className="text-2xl font-bold text-white/80">
                  {position}
                </span>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4 py-4 min-h-[200px]">
      {/* 2nd place (left) */}
      {renderPodiumPosition(second, 2)}
      {/* 1st place (center) */}
      {renderPodiumPosition(first, 1)}
      {/* 3rd place (right) */}
      {renderPodiumPosition(third, 3)}
    </div>
  );
}
