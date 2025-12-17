import { create } from "zustand";
import type { ChatMessage } from "@/models";
import { useConnectionStore } from "./connectionStore";

interface ChatStore {
  messages: ChatMessage[];

  // Actions
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;

  // Reset
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  reset: () => set({ messages: [] }),
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
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: msg.username,
      message: msg.message,
      timestamp: new Date(msg.timestamp),
      type: msg.isCloseGuess ? "close-guess" : "chat",
    });
  };

  connection.on("ChatMessage", handleChatMessage);

  return () => {
    connection.off("ChatMessage", handleChatMessage);
  };
}
