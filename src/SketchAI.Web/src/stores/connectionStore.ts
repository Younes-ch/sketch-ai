import { create } from "zustand";
import * as signalR from "@microsoft/signalr";
import { logger } from "@/lib/logger";

export type ConnectionState = "Connected" | "Reconnecting" | "Disconnected";

// Use minimal logging in production to avoid information disclosure
const getSignalRLogLevel = (): signalR.LogLevel => {
  return import.meta.env.PROD ? signalR.LogLevel.Warning : signalR.LogLevel.Information;
};

interface ConnectionStore {
  connection: signalR.HubConnection | null;
  connectionState: ConnectionState;
  
  // Actions
  initializeConnection: () => void;
  
  // Helper to check if connected
  isConnected: () => boolean;
}

// Get the SignalR hub URL
const getHubUrl = (): string => {
  // Runtime config injected by Docker/nginx (production)
  const runtimeConfig = (window as unknown as { __RUNTIME_CONFIG__?: { API_URL?: string } }).__RUNTIME_CONFIG__;
  if (runtimeConfig?.API_URL) {
    return `${runtimeConfig.API_URL}/hubs/drawing`;
  }
  
  // Vite env variable (for local development builds)
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return `${apiUrl}/hubs/drawing`;
  }
  
  // Development with Vite proxy
  return "/hubs/drawing";
};

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connection: null,
  connectionState: "Disconnected",

  initializeConnection: () => {
    const { connection } = get();
    
    // Only skip if we have an active connection
    if (connection && connection.state === signalR.HubConnectionState.Connected) return;

    const hubUrl = getHubUrl();
    logger.info(`Connecting to SignalR hub at: ${hubUrl}`);

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .configureLogging(getSignalRLogLevel())
      .build();

    // Connection state listeners
    newConnection.onreconnecting(() => {
      logger.info("SignalR Reconnecting...");
      set({ connectionState: "Reconnecting" });
    });

    newConnection.onreconnected(() => {
      logger.info("SignalR Reconnected - refreshing page to restore session");
      window.location.reload();
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
