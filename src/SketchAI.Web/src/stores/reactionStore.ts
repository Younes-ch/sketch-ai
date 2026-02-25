import { logger } from "@/lib/logger";
import type { ReactionType } from "@/models/reactions";
import { create } from "zustand";
import { useConnectionStore } from "./connectionStore";

interface ReactionEntry {
  id: string;
  senderUsername: string;
  reactionType: ReactionType;
  timestamp: number;
}

interface ReactionStore {
  /** List of active reactions to show on the canvas */
  reactions: ReactionEntry[];
  /** Whether the current user has already reacted this turn */
  hasReacted: boolean;

  // Actions
  addReaction: (senderUsername: string, reactionType: ReactionType) => void;
  removeReaction: (id: string) => void;
  clearReactions: () => void;

  // SignalR action
  sendReaction: (reactionType: ReactionType) => Promise<void>;
}

const REACTION_DISPLAY_MS = 2000;
const MAX_VISIBLE_REACTIONS = 5;
const reactionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export const useReactionStore = create<ReactionStore>((set, get) => ({
  reactions: [],
  hasReacted: false,

  addReaction: (senderUsername, reactionType) => {
    const id = crypto.randomUUID();
    const entry: ReactionEntry = {
      id,
      senderUsername,
      reactionType,
      timestamp: Date.now(),
    };

    const timeout = setTimeout(() => {
     get().removeReaction(id);
    }, REACTION_DISPLAY_MS);
    reactionTimeouts.set(id, timeout);

    set((state) => {
      // Keep only the latest reactions
      const updated = [...state.reactions, entry];
      if (updated.length > MAX_VISIBLE_REACTIONS) {
        const removed = updated.shift();
        if (removed) {
          const timeout = reactionTimeouts.get(removed.id);
          if (timeout) {
            clearTimeout(timeout);
            reactionTimeouts.delete(removed.id);
          }
        }
      }
      return { reactions: updated };
    });
  },

  removeReaction: (id) => {
    const timeout = reactionTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      reactionTimeouts.delete(id);
    }
    set((state) => ({
      reactions: state.reactions.filter((r) => r.id !== id),
    }));
  },

  clearReactions: () => {
    // Clear all timeouts
    for (const timeout of reactionTimeouts.values()) {
      clearTimeout(timeout);
    }
    reactionTimeouts.clear();
    set({ reactions: [], hasReacted: false });
  },

  sendReaction: async (reactionType) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;
    if (get().hasReacted) return;

    set({ hasReacted: true });

    try {
      await connection.invoke("SendReaction", reactionType);
    } catch (error) {
      logger.error("Failed to send reaction", error);
      set({ hasReacted: false });
    }
  },
}));

// Setup SignalR event handlers for reactions
export function setupReactionEventHandlers() {
  const connection = useConnectionStore.getState().connection;
  if (!connection) return () => {};

  const handleReceiveReaction = (data: {
    senderUsername: string;
    reactionType: ReactionType;
  }) => {
    logger.info(`Reaction from ${data.senderUsername}: ${data.reactionType}`);
    useReactionStore.getState().addReaction(
      data.senderUsername,
      data.reactionType,
    );
  };

  connection.on("ReceiveReaction", handleReceiveReaction);

  return () => {
    connection.off("ReceiveReaction", handleReceiveReaction);
  };
}
