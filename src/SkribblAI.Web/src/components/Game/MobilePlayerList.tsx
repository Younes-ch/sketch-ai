import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/models";
import { useGameStore } from "@/stores/gameStore";
import { useChatStore } from "@/stores/chatStore";
import { useRoomStore } from "@/stores/roomStore";
import { ScorePopup } from "@/components/effects/ScorePopup";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface MobilePlayerListProps {
  players: Player[];
  currentUsername: string;
}

export default function MobilePlayerList({
  players,
  currentUsername,
}: MobilePlayerListProps) {
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const playersWhoGuessed = useGameStore((s) => s.playersWhoGuessed);
  const playerBubbles = useChatStore((s) => s.playerBubbles);
  const isHost = useRoomStore((s) => s.isHost);
  const kickPlayer = useRoomStore((s) => s.kickPlayer);
  const startVoteKick = useRoomStore((s) => s.startVoteKick);
  const activeVoteKick = useRoomStore((s) => s.activeVoteKick);

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  // Track score popups that should be visible (persists for animation duration)
  const [visiblePopups, setVisiblePopups] = useState<Map<string, number>>(
    new Map()
  );
  // Track previous scores for animation
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  // Track pending timeout
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentDrawerUsername = currentDrawer?.username;
  const isDrawingPhase = phase === "drawing" || phase === "wordSelection";

  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  // Callback to show popups - can be called from effect
  const showPopups = useCallback((changes: Map<string, number>) => {
    // Clear any existing timeout
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    setVisiblePopups(changes);

    // Clear after animation duration
    popupTimeoutRef.current = setTimeout(() => {
      setVisiblePopups(new Map());
      popupTimeoutRef.current = null;
    }, 1200);
  }, []);

  // Detect score changes and show popups
  useEffect(() => {
    const changes = new Map<string, number>();

    players.forEach((player) => {
      const prevScore = prevScoresRef.current.get(player.username);
      if (prevScore !== undefined && player.score > prevScore) {
        changes.set(player.username, player.score - prevScore);
      }
    });

    // Update previous scores for next comparison
    const newScores = new Map<string, number>();
    players.forEach((p) => newScores.set(p.username, p.score));
    prevScoresRef.current = newScores;

    // Show popups if there are changes
    if (changes.size > 0) {
      showPopups(changes);
    }
  }, [players, showPopups]);

  // Get visible popup points for a player
  const getPopupPoints = (username: string): number => {
    return visiblePopups.get(username) ?? 0;
  };

  const handlePlayerClick = (playerUsername: string) => {
    if (playerUsername === currentUsername) return;
    const clickedPlayer = players.find((p) => p.username === playerUsername);
    if (clickedPlayer?.isHost) return;
    setSelectedPlayer(
      selectedPlayer === playerUsername ? null : playerUsername
    );
  };

  const handleKick = async (playerUsername: string) => {
    try {
      await kickPlayer(playerUsername);
      setSelectedPlayer(null);
    } catch (error) {
      logger.error("Failed to kick player:", error);
    }
  };

  const handleVoteKick = async (playerUsername: string) => {
    try {
      await startVoteKick(playerUsername);
      setSelectedPlayer(null);
    } catch (error) {
      logger.error("Failed to start votekick:", error);
    }
  };

  const canShowActions = (playerUsername: string) => {
    if (playerUsername === currentUsername) return false;
    const player = players.find((p) => p.username === playerUsername);
    if (player?.isHost) return false;
    return true;
  };

  // Sort players by score descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-card rounded-xl p-2 border-4 border-card-border h-full flex flex-col overflow-hidden">
      <h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1 shrink-0">
        <span>👥</span> PLAYERS
      </h3>
      <div className="space-y-1 flex-1 overflow-y-auto pt-6 -mt-6">
        <AnimatePresence mode="popLayout">
          {sortedPlayers.map((player, index) => {
            const rank = index + 1;
            const isCurrentDrawer =
              player.username === currentDrawerUsername && isDrawingPhase;
            const hasGuessedCorrectly =
              playersWhoGuessed.has(player.username) && isDrawingPhase;
            const playerBubble = playerBubbles.get(player.username);
            const isSelected = selectedPlayer === player.username;
            const showActions = canShowActions(player.username);

            const popupPoints = getPopupPoints(player.username);

            return (
              <motion.div
                key={player.username}
                layout
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 10, scale: 0.95 }}
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
                  "rounded-lg p-1.5 flex items-center gap-1.5 relative",
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
                      className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isHost ? (
                        <button
                          onClick={() => handleKick(player.username)}
                          className="px-2 py-1 bg-danger rounded-lg text-white text-[10px] font-bold hover:bg-danger-hover transition-colors flex items-center gap-0.5"
                        >
                          <span>👢</span> Kick
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVoteKick(player.username)}
                          className="px-2 py-1 bg-warning rounded-lg text-white text-[10px] font-bold hover:bg-warning-hover transition-colors flex items-center gap-0.5"
                        >
                          <span>🗳️</span> Vote
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Chat bubble - positioned above player row */}
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
                      className="absolute -top-6 left-1/2 -translate-x-1/2 z-10 max-w-[90%]"
                    >
                      <div className="bg-accent text-background text-[10px] font-medium px-1.5 py-0.5 rounded-lg shadow-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">
                        {playerBubble.message}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-1.5 h-1.5 bg-accent rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rank */}
                <span className="font-mono font-bold text-white/50 w-4 text-center text-[10px]">
                  #{rank}
                </span>

                {/* Avatar/Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-bold text-white truncate text-[11px]">
                      {player.username}
                    </p>
                    {player.isHost && (
                      <span
                        className="text-[8px] bg-accent text-background px-1 py-0.5 rounded font-bold"
                        title="Room Host"
                      >
                        HOST
                      </span>
                    )}
                    {player.username === currentUsername && (
                      <span className="text-[8px] bg-white/20 text-white px-1 py-0.5 rounded font-bold">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-white/70 text-[10px]">
                      {player.score} pts
                    </p>
                    {isCurrentDrawer && (
                      <span className="text-[9px] animate-pulse">
                        ✏️ Drawing
                      </span>
                    )}
                    {hasGuessedCorrectly && (
                      <span className="text-[9px]">✓ Guessed</span>
                    )}
                  </div>
                </div>

                {/* Score with popup animation */}
                <div className="relative overflow-visible z-50">
                  <motion.span
                    key={player.score}
                    initial={
                      popupPoints > 0 ? { scale: 1.3, color: "#22c55e" } : {}
                    }
                    animate={{ scale: 1, color: "#ffffff" }}
                    transition={{ duration: 0.3 }}
                    className="text-white font-bold text-sm"
                  >
                    {player.score}
                  </motion.span>
                  {/* Score popup animation */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 overflow-visible z-100">
                    <ScorePopup show={popupPoints > 0} points={popupPoints} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
