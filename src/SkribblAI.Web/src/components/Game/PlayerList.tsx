import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/models";
import { useGameStore } from "@/stores/gameStore";
import { useChatStore } from "@/stores/chatStore";
import { cn } from "@/lib/utils";

interface PlayerListProps {
  players: Player[];
  currentUsername: string;
  roomCode?: string;
  variant?: "desktop" | "mobile";
}

export default function PlayerList({
  players,
  currentUsername,
  roomCode,
  variant = "desktop",
}: PlayerListProps) {
  const isDesktop = variant === "desktop";
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const playersWhoGuessed = useGameStore((s) => s.playersWhoGuessed);
  const playerBubbles = useChatStore((s) => s.playerBubbles);


  // Track previous scores for animation
  const prevScoresRef = useRef<Map<string, number>>(new Map());

  const currentDrawerUsername = currentDrawer?.username;
  const isDrawingPhase = phase === "drawing" || phase === "wordSelection";

  // Update previous scores after render
  useEffect(() => {
    const newScores = new Map<string, number>();
    players.forEach((p) => newScores.set(p.username, p.score));
    prevScoresRef.current = newScores;
  }, [players]);

  // Check if a player's score increased
  const getScoreChange = (player: Player): number => {
    const prevScore =
      prevScoresRef.current.get(player.username) ?? player.score;
    return player.score - prevScore;
  };

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-4 border-4 border-card-border flex flex-col h-full",
        isDesktop ? "shadow-none" : "shadow-lg"
      )}
    >
      <h3
        className={cn(
          "text-white font-bold mb-3 flex items-center gap-2 shrink-0",
          isDesktop ? "text-sm" : "text-lg"
        )}
      >
        <span>👥</span> PLAYERS
      </h3>
      <div className="space-y-2 flex-1 overflow-y-auto pt-8 -mt-8">
        <AnimatePresence mode="popLayout">
          {players.map((player) => {
            const isCurrentDrawer =
              player.username === currentDrawerUsername && isDrawingPhase;
            const hasGuessedCorrectly =
              playersWhoGuessed.has(player.username) && isDrawingPhase;
            const scoreChange = getScoreChange(player);
            const playerBubble = playerBubbles.get(player.username);
            const isSelected = selectedPlayer === player.username;
            const showActions = canShowActions(player.username);

            return (
              <motion.div
                key={player.username}
                layout
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  opacity: { duration: 0.2 },
                }}
                onClick={() =>
                  showActions && handlePlayerClick(player.username)
                }
                className={cn(
                  "rounded-xl p-3 flex items-center relative",
                  isDesktop ? "gap-2" : "gap-3",
                  isCurrentDrawer
                    ? "bg-success"
                    : hasGuessedCorrectly
                    ? "bg-success/60"
                    : "bg-card-border",
                  showActions &&
                    "cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all"
                )}
              >
                {/* Player Actions Menu */}
                <AnimatePresence>
                  {isSelected && !activeVoteKick && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isHost ? (
                        <button
                          onClick={() => handleKick(player.username)}
                          className="px-3 py-1.5 bg-danger rounded-lg text-white text-xs font-bold hover:bg-danger-hover transition-colors flex items-center gap-1"
                        >
                          <span>🚫</span> Kick
                        </button>
                      ) : (
                        players.length >= 3 && (
                          <button
                            onClick={() => handleVoteKick(player.username)}
                            className="px-3 py-1.5 bg-warning rounded-lg text-background text-xs font-bold hover:bg-warning/80 transition-colors flex items-center gap-1"
                          >
                            <span>🗳️</span> Vote Kick
                          </button>
                        )
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chat bubble */}
                <AnimatePresence>
                  {playerBubble && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -10 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                      className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 max-w-[90%]"
                    >
                      <div className="bg-accent text-background text-xs font-medium px-2 py-1 rounded-lg shadow-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                        {playerBubble.message}
                      </div>
                      {/* Bubble pointer */}
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-accent rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {player.isHost && (
                  <span className={isDesktop ? "text-sm" : "text-lg"}>👑</span>
                )}
                <span
                  className={cn(
                    "text-white",
                    isDesktop ? "text-xl" : "text-2xl"
                  )}
                >
                  {isCurrentDrawer ? "🎨" : hasGuessedCorrectly ? "✓" : "👤"}
                </span>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-white font-bold truncate block",
                      isDesktop ? "text-sm" : ""
                    )}
                  >
                    {player.username}
                    {player.username === currentUsername && " (You)"}
                  </span>
                  {isCurrentDrawer && (
                    <p className="text-white/70 text-xs">Drawing...</p>
                  )}
                  {hasGuessedCorrectly && !isCurrentDrawer && (
                    <p className="text-white/70 text-xs">Guessed!</p>
                  )}
                </div>
                <div className="relative">
                  <motion.span
                    key={player.score}
                    initial={
                      scoreChange > 0 ? { scale: 1.3, color: "#22c55e" } : {}
                    }
                    animate={{ scale: 1, color: "#ffffff" }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "text-white font-bold",
                      isDesktop ? "text-lg" : "text-lg"
                    )}
                  >
                    {player.score}
                  </motion.span>
                  {/* Score popup animation */}
                  <AnimatePresence>
                    {scoreChange > 0 && (
                      <motion.span
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 0, y: -20 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute -top-2 right-0 text-success font-bold text-sm pointer-events-none"
                      >
                        +{scoreChange}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {players.length <= 1 && (
          <p
            className={cn(
              "text-white/40 text-center",
              isDesktop ? "text-xs mt-4 py-4" : "text-sm mt-6 py-8"
            )}
          >
            Waiting for more players to join...
            {!isDesktop && roomCode && (
              <>
                <br />
                Share the room code:{" "}
                <span className="text-accent font-bold">{roomCode}</span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
