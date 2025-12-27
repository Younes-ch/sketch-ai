import { ScorePopup } from "@/components/effects/ScorePopup";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import type { Player } from "@/models";
import { useToastStore } from "@/stores";
import { useChatStore } from "@/stores/chatStore";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const isHost = useRoomStore((s) => s.isHost);
  const kickPlayer = useRoomStore((s) => s.kickPlayer);
  const startVoteKick = useRoomStore((s) => s.startVoteKick);
  const activeVoteKick = useRoomStore((s) => s.activeVoteKick);
  const addToast = useToastStore((s) => s.addToast);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (activeVoteKick && selectedPlayer) {
      setSelectedPlayer(null);
    }
  }, [activeVoteKick, selectedPlayer]);

  // Get visible popup points for a player
  const getPopupPoints = (username: string): number => {
    return visiblePopups.get(username) ?? 0;
  };

  const handlePlayerClick = (playerUsername: string) => {
    // Don't allow actions on yourself
    if (playerUsername === currentUsername) return;
    // Don't allow actions on host
    const clickedPlayer = players.find((p) => p.username === playerUsername);
    if (clickedPlayer?.isHost) return;
    // Toggle selection
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
      addToast("Failed to kick player", "error");
    }
  };

  const handleVoteKick = async (playerUsername: string) => {
    if (activeVoteKick) {
      addToast("A votekick is already in progress", "warning");
      return;
    }
    try {
      await startVoteKick(playerUsername);
      setSelectedPlayer(null);
    } catch (error) {
      logger.error("Failed to start votekick:", error);
      addToast("Failed to start votekick", "error");
    }
  };

  // Can show player actions if not self, not host, and has enough players
  const canShowActions = (playerUsername: string) => {
    if (playerUsername === currentUsername) return false;
    const player = players.find((p) => p.username === playerUsername);
    if (player?.isHost) return false;
    return true;
  };

  // Sort players by score descending
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

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
      <div className="space-y-2 flex-1 overflow-y-auto pt-12 -mt-12 px-1">
        <AnimatePresence mode="popLayout">
          {sortedPlayers.map((player, index) => {
            const rank = index + 1;
            const isCurrentDrawer =
              player.username === currentDrawerUsername && isDrawingPhase;
            const hasGuessedCorrectly =
              playersWhoGuessed.has(player.username) && isDrawingPhase;
            const popupPoints = getPopupPoints(player.username);
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
                          <span>👢</span> Kick
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVoteKick(player.username)}
                          className="px-3 py-1.5 bg-warning rounded-lg text-white text-xs font-bold hover:bg-warning-hover transition-colors flex items-center gap-1"
                        >
                          <span>🗳️</span> Vote Kick
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rank */}
                <span className="font-mono font-bold text-white/50 w-4 text-center text-sm">
                  #{rank}
                </span>

                {/* Avatar/Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-bold text-white truncate text-sm">
                      {player.username}
                    </p>
                    {player.isHost && (
                      <span
                        className="text-[10px] bg-accent text-background px-1.5 py-0.5 rounded-md font-bold"
                        title="Room Host"
                      >
                        HOST
                      </span>
                    )}
                    {player.username === currentUsername && (
                      <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-md font-bold">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-white/70 text-xs">
                      {player.score} points
                    </p>
                    {isCurrentDrawer && (
                      <span className="text-[10px] animate-pulse">
                        ✏️ Drawing
                      </span>
                    )}
                    {hasGuessedCorrectly && (
                      <span className="text-[10px]">✓ Guessed</span>
                    )}
                  </div>
                </div>

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

                <div className="relative overflow-visible z-50">
                  <motion.span
                    key={player.score}
                    initial={
                      popupPoints > 0 ? { scale: 1.3, color: "#22c55e" } : {}
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
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 overflow-visible z-100">
                    <ScorePopup show={popupPoints > 0} points={popupPoints} />
                  </div>
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
