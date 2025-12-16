import { create } from "zustand";
import * as signalR from "@microsoft/signalr";
import { logger } from "@/lib/logger";

const SESSION_STORAGE_KEY = "skribbl-session";

export interface StoredSession {
  roomCode: string;
  username: string;
}

export function getStoredSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredSession;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function saveSession(roomCode: string, username: string): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ roomCode, username })
  );
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export type ConnectionState = "Connected" | "Reconnecting" | "Disconnected";

interface ConnectionStore {
  connection: signalR.HubConnection | null;
  connectionState: ConnectionState;
  isReconnecting: boolean;
  
  // Actions
  initializeConnection: () => void;
  setIsReconnecting: (value: boolean) => void;
  
  // Helper to check if connected
  isConnected: () => boolean;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connection: null,
  connectionState: "Disconnected",
  isReconnecting: false,

  initializeConnection: () => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("/hubs/drawing")
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Connection state listeners
    newConnection.onreconnecting(() => {
      logger.info("SignalR Reconnecting...");
      set({ connectionState: "Reconnecting" });
    });

    newConnection.onreconnected(() => {
      logger.info("SignalR Reconnected");
      set({ connectionState: "Connected" });
    });

    newConnection.onclose(() => {
      logger.info("SignalR Disconnected");
      set({ connectionState: "Disconnected" });
    });

    newConnection
      .start()
      .then(() => {
        logger.info("SignalR Connected");
        set({ connectionState: "Connected", connection: newConnection });
      })
      .catch((err) => {
        logger.error("SignalR Connection Error", err);
        set({ connectionState: "Disconnected" });
      });
  },

  setIsReconnecting: (value) => set({ isReconnecting: value }),

  isConnected: () => {
    const { connection } = get();
    return connection?.state === signalR.HubConnectionState.Connected;
  },
}));
