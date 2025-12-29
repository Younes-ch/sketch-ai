import { create } from "zustand";
import type { ChatMessage } from "@/models";
import { useConnectionStore } from "./connectionStore";

// Track player bubbles (recent chat messages that aren't close/correct guesses)
interface PlayerBubble {
  message: string;
  timestamp: number;
}

interface ChatStore {
  messages: ChatMessage[];
  playerBubbles: Map<string, PlayerBubble>;

  // Actions
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setPlayerBubble: (username: string, message: string) => void;
  clearPlayerBubble: (username: string) => void;

  // Reset
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  playerBubbles: new Map(),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setPlayerBubble: (username, message) =>
    set((state) => {
      const newBubbles = new Map(state.playerBubbles);
      newBubbles.set(username, { message, timestamp: Date.now() });
      return { playerBubbles: newBubbles };
    }),

  clearPlayerBubble: (username) =>
    set((state) => {
      const newBubbles = new Map(state.playerBubbles);
      newBubbles.delete(username);
      return { playerBubbles: newBubbles };
    }),

  reset: () => set({ messages: [], playerBubbles: new Map() }),
}));

// Setup SignalR event handlers for chat events
export function setupChatEventHandlers() {
  const connection = useConnectionStore.getState().connection;
  if (!connection) return () => {};

  const handleChatMessage = (msg: {
    username: string;
    message: string;
    timestamp: string;
    isCloseGuess?: boolean;
  }) => {
    const store = useChatStore.getState();
    
    store.addMessage({
      id: crypto.randomUUID(),
      username: msg.username,
      message: msg.message,
      timestamp: new Date(msg.timestamp),
      type: msg.isCloseGuess ? "close-guess" : "chat",
    });

    // Show bubble for normal chat messages (not close guesses)
    if (!msg.isCloseGuess) {
      store.setPlayerBubble(msg.username, msg.message);
      // Auto-clear bubble after 3 seconds
      setTimeout(() => {
        store.clearPlayerBubble(msg.username);
      }, 3000);
    }
  };

  connection.on("ChatMessage", handleChatMessage);

  return () => {
    connection.off("ChatMessage", handleChatMessage);
  };
}
