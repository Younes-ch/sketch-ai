import { motion, AnimatePresence } from "framer-motion";
import type { ReactionType } from "@/models/reactions";

interface ReactionBannerProps {
  reactions: Array<{
    id: string;
    senderUsername: string;
    reactionType: ReactionType;
  }>;
}

const reactionEmoji: Record<ReactionType, string> = {
  like: "👍",
  dislike: "👎",
};

export function ReactionBanner({ reactions }: ReactionBannerProps) {
  return (
    <div className="flex flex-col gap-1.5 pointer-events-none">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 0, x: -30, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.7 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg shadow-lg text-white font-semibold text-xs backdrop-blur-sm ${
              reaction.reactionType === "like"
                ? "bg-green-600/80"
                : "bg-red-600/80"
            }`}
          >
            <span className="text-base">
              {reactionEmoji[reaction.reactionType]}
            </span>
            <span className="truncate max-w-24">{reaction.senderUsername}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
