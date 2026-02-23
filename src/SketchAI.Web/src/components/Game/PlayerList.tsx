import { ScorePopup } from "@/components/effects/ScorePopup";
import { Button } from "@/components/ui";
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
  const [visiblePopups, setVisiblePopups] = useState<Map<string, number>>(
    new Map(),
  );
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentDrawerUsername = currentDrawer?.username;
  const isDrawingPhase = phase === "drawing" || phase === "wordSelection";

  const showPopups = useCallback((changes: Map<string, number>) => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    setVisiblePopups(changes);

    popupTimeoutRef.current = setTimeout(() => {
      setVisiblePopups(new Map());
      popupTimeoutRef.current = null;
    }, 1200);
  }, []);

  useEffect(() => {
    const changes = new Map<string, number>();

    players.forEach((player) => {
      const prevScore = prevScoresRef.current.get(player.username);
      if (prevScore !== undefined && player.score > prevScore) {
        changes.set(player.username, player.score - prevScore);
      }
    });

    const newScores = new Map<string, number>();
    players.forEach((p) => newScores.set(p.username, p.score));
    prevScoresRef.current = newScores;

    if (changes.size > 0) {
      queueMicrotask(() => showPopups(changes));
    }
  }, [players, showPopups]);

  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  const getPopupPoints = (username: string): number => {
    return visiblePopups.get(username) ?? 0;
  };

  const handlePlayerClick = useCallback(
    (playerUsername: string) => {
      if (playerUsername === currentUsername) return;
      const clickedPlayer = players.find((p) => p.username === playerUsername);
      if (clickedPlayer?.isHost) return;
      setSelectedPlayer(
        selectedPlayer === playerUsername ? null : playerUsername,
      );
    },
    [currentUsername, players, selectedPlayer],
  );

  const handleKick = useCallback(
    async (playerUsername: string) => {
      try {
        await kickPlayer(playerUsername);
        setSelectedPlayer(null);
      } catch (error) {
        logger.error("Failed to kick player:", error);
        addToast("Failed to kick player", "error");
      }
    },
    [kickPlayer, addToast],
  );

  const handleVoteKick = useCallback(
    async (playerUsername: string) => {
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
    },
    [activeVoteKick, startVoteKick, addToast],
  );

  const canShowActions = (playerUsername: string) => {
    if (playerUsername === currentUsername) return false;
    const player = players.find((p) => p.username === playerUsername);
    if (player?.isHost) return false;
    return true;
  };

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-4 border-4 border-card-border flex flex-col h-full overflow-hidden",
        isDesktop ? "shadow-none" : "shadow-lg",
      )}
    >
      <h3
        className={cn(
          "text-white font-bold flex items-center gap-2 shrink-0 z-10 bg-card relative",
          isDesktop ? "text-sm" : "text-lg",
        )}
      >
        <span>👥</span> PLAYERS
      </h3>
      <div className="space-y-2 flex-1 overflow-y-auto px-1 pt-3 pb-2 custom-scrollbar min-h-0">
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
                tabIndex={showActions ? 0 : -1}
                onKeyDown={(e) => {
                  if (showActions && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    handlePlayerClick(player.username);
                  }
                }}
                role="button"
                aria-label={`Actions for ${player.username}`}
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
                    "cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all",
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
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleKick(player.username)}
                          leftIcon={<span>👢</span>}
                        >
                          Kick
                        </Button>
                      ) : (
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleVoteKick(player.username)}
                          leftIcon={<span>🗳️</span>}
                        >
                          Vote Kick
                        </Button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rank */}
                <span className="font-mono font-bold text-white/50 w-4 text-center text-sm shrink-0">
                  #{rank}
                </span>

                {/* Avatar/Name */}
                <div className="flex-1 min-w-0 pr-2 flex flex-col justify-center">
                  <p className="font-bold text-white truncate text-sm leading-tight">
                    {player.username}
                  </p>
                  {(player.isHost ||
                    player.username === currentUsername ||
                    isCurrentDrawer ||
                    hasGuessedCorrectly) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {player.isHost && (
                        <span
                          className="text-[9px] bg-accent text-background px-1.5 py-0.5 rounded font-black tracking-wide shrink-0"
                          title="Room Host"
                        >
                          HOST
                        </span>
                      )}
                      {player.username === currentUsername && (
                        <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded font-black tracking-wide shrink-0">
                          YOU
                        </span>
                      )}
                      {isCurrentDrawer && (
                        <span className="text-[10px] animate-pulse whitespace-nowrap shrink-0 text-white/90 bg-black/20 px-1.5 py-0.5 rounded-md font-medium">
                          ✏️ Drawing
                        </span>
                      )}
                      {hasGuessedCorrectly && (
                        <span className="text-[10px] whitespace-nowrap shrink-0 text-white/90 bg-black/20 px-1.5 py-0.5 rounded-md font-medium">
                          ✓ Guessed
                        </span>
                      )}
                    </div>
                  )}
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
                      <div className="bg-accent text-background text-xs font-medium px-2 py-1 rounded-lg shadow-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-37.5">
                        {playerBubble.message}
                      </div>
                      {/* Bubble pointer */}
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-accent rotate-45" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative overflow-visible z-30 shrink-0 ml-2 flex flex-col items-end justify-center min-w-10">
                  <motion.span
                    key={player.score}
                    initial={
                      popupPoints > 0 ? { scale: 1.3, color: "#22c55e" } : {}
                    }
                    animate={{ scale: 1, color: "#ffffff" }}
                    transition={{ duration: 0.3 }}
                    className="text-white font-black text-lg leading-none"
                  >
                    {player.score}
                  </motion.span>
                  <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider mt-1">
                    PTS
                  </span>
                  {/* Score popup animation */}
                  <div className="absolute top-1/2 right-full mr-4 -translate-y-1/2 w-0 h-0 overflow-visible z-100">
                    <ScorePopup
                      show={popupPoints > 0}
                      points={popupPoints}
                      position={{ x: 0, y: 25 }}
                    />
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
              isDesktop ? "text-xs mt-4 py-4" : "text-sm mt-6 py-8",
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
