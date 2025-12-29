import { create } from "zustand";
import * as signalR from "@microsoft/signalr";
import { logger } from "@/lib/logger";

export type ConnectionState = "Connected" | "Reconnecting" | "Disconnected";

interface ConnectionStore {
  connection: signalR.HubConnection | null;
  connectionState: ConnectionState;
  
  // Actions
  initializeConnection: () => void;
  
  // Helper to check if connected
  isConnected: () => boolean;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connection: null,
  connectionState: "Disconnected",

  initializeConnection: () => {
    const { connection } = get();
    
    // Only skip if we have an active connection
    if (connection && connection.state === signalR.HubConnectionState.Connected) return;

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
      set({ connectionState: "Disconnected", connection: null });
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

  isConnected: () => {
    const { connection } = get();
    return connection?.state === signalR.HubConnectionState.Connected;
  },
}));
