import { logger } from "@/lib/logger";
import { useRoomStore, useToastStore } from "@/stores";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

interface VoteProgressProps {
  votesToKeep: number;
  votesToKick: number;
  totalVotes: number;
  totalVotersNeeded: number;
}

function VoteProgress({
  votesToKeep,
  votesToKick,
  totalVotes,
  totalVotersNeeded,
}: VoteProgressProps) {
  return (
    <div className="bg-background rounded-lg p-2 border-2 border-card-border">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-success font-bold">👍 Keep: {votesToKeep}</span>
        <span className="text-danger font-bold">👎 Kick: {votesToKick}</span>
      </div>
      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-card-border">
        {votesToKeep > 0 && (
          <div
            className="bg-success transition-all duration-500"
            style={{ flex: votesToKeep }}
          />
        )}
        {votesToKick > 0 && (
          <div
            className="bg-danger transition-all duration-500"
            style={{ flex: votesToKick }}
          />
        )}
      </div>
      <p className="text-white/50 text-[10px] text-center mt-1">
        {totalVotes} of {totalVotersNeeded} votes cast
      </p>
    </div>
  );
}

interface VoteButtonsProps {
  onVote: (voteToKick: boolean) => void;
}

function VoteButtons({ onVote }: VoteButtonsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onVote(false)}
        className="flex-1 py-2 rounded-lg text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1 bg-success border-b-4 border-success-dark hover:bg-success-hover active:border-b-0 active:translate-y-1"
      >
        <span>👍</span> Keep
      </button>
      <button
        onClick={() => onVote(true)}
        className="flex-1 py-2 rounded-lg text-white text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1 bg-danger border-b-4 border-danger-dark hover:bg-danger-hover active:border-b-0 active:translate-y-1"
      >
        <span>👎</span> Kick
      </button>
    </div>
  );
}

interface WaitingMessageProps {
  hasEveryoneVoted: boolean;
}

function WaitingMessage({ hasEveryoneVoted }: WaitingMessageProps) {
  return (
    <p className="text-white/50 text-center text-xs">
      {hasEveryoneVoted
        ? "Vote complete. Processing..."
        : "Waiting for votes..."}
    </p>
  );
}

export default function VoteKickModal() {
  const activeVoteKick = useRoomStore((s) => s.activeVoteKick);
  const username = useRoomStore((s) => s.username);
  const castVoteKick = useRoomStore((s) => s.castVoteKick);
  const addToast = useToastStore((s) => s.addToast);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    setHasVoted(false);
  }, [activeVoteKick?.targetUsername]);

  const derivedState = useMemo(
    () => ({
      isTarget: activeVoteKick?.targetUsername === username,
      isInitiator: activeVoteKick?.initiatorUsername === username,
      totalVotes:
        (activeVoteKick?.votesToKick ?? 0) + (activeVoteKick?.votesToKeep ?? 0),
    }),
    [activeVoteKick, username]
  );

  const handleVote = useCallback(
    async (voteToKick: boolean) => {
      try {
        await castVoteKick(voteToKick);
        setHasVoted(true);
      } catch (error) {
        logger.error("Failed to cast vote:", error);
        addToast("Failed to cast vote. Please try again.", "error");
      }
    },
    [castVoteKick, addToast]
  );

  if (!activeVoteKick) {
    return null;
  }

  const { isTarget, isInitiator, totalVotes } = derivedState;
  const hasEveryoneVoted = totalVotes >= activeVoteKick.totalVotersNeeded;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="fixed z-50 w-[calc(100%-2rem)] max-w-xs sm:max-w-sm pointer-events-auto top-4 left-1/2 -translate-x-1/2 sm:top-auto sm:left-4 sm:bottom-4 sm:translate-x-0"
      >
        <div className="bg-card rounded-xl border-2 border-card-border shadow-xl overflow-hidden">
          {/* Header */}
          <div
            className={`p-3 border-b-2 border-card-border ${
              isTarget ? "bg-danger/20" : "bg-warning/20"
            }`}
          >
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{isTarget ? "⚠️" : "🗳️"}</span>
              {isTarget ? "Vote Kick Against You" : "Vote to Kick"}
            </h2>
          </div>

          {/* Content */}
          <div className="p-3 space-y-3">
            {!isTarget && (
              <p className="text-white text-sm text-center">
                <span className="font-bold text-accent">
                  {activeVoteKick.initiatorUsername}
                </span>{" "}
                wants to kick{" "}
                <span className="font-bold text-danger">
                  {activeVoteKick.targetUsername}
                </span>
              </p>
            )}

            {isTarget && (
              <p className="text-white text-sm text-center">
                <span className="font-bold text-accent">
                  {activeVoteKick.initiatorUsername}
                </span>{" "}
                started a vote to kick you.
              </p>
            )}

            <VoteProgress
              votesToKeep={activeVoteKick.votesToKeep}
              votesToKick={activeVoteKick.votesToKick}
              totalVotes={totalVotes}
              totalVotersNeeded={activeVoteKick.totalVotersNeeded}
            />

            {!isTarget && !isInitiator && !hasEveryoneVoted && !hasVoted && (
              <VoteButtons onVote={handleVote} />
            )}

            {(isInitiator || hasEveryoneVoted || isTarget || hasVoted) && (
              <WaitingMessage hasEveryoneVoted={hasEveryoneVoted} />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
