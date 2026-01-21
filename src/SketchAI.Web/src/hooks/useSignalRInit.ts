import { useEffect, useRef } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { setupRoomEventHandlers } from "@/stores/roomStore";
import { setupGameEventHandlers } from "@/stores/gameStore";
import { setupChatEventHandlers } from "@/stores/chatStore";
import { setupCanvasEventHandlers } from "@/stores/canvasStore";
import { useGameStore } from "@/stores/gameStore";

/**
 * Hook to initialize SignalR connection and setup all event handlers.
 * Call this once at the app root level.
 */
export function useSignalRInit() {
  const { connection, initializeConnection } = useConnectionStore();
  const cleanupRef = useRef<(() => void)[]>([]);

  // Initialize connection on mount
  useEffect(() => {
    initializeConnection();
  }, [initializeConnection]);

  // Setup event handlers when connection is established
  useEffect(() => {
    if (!connection) return;

    // Setup all event handlers
    const cleanupRoom = setupRoomEventHandlers();
    const cleanupGame = setupGameEventHandlers();
    const cleanupChat = setupChatEventHandlers();
    const cleanupCanvas = setupCanvasEventHandlers();

    cleanupRef.current = [cleanupRoom, cleanupGame, cleanupChat, cleanupCanvas];

    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, [connection]);

  // Timer effect for drawing phase
  // Note: Hint reveals and round ending are handled server-side by RoundTimerService.
  // This timer only updates the UI countdown. The server is authoritative.
  useEffect(() => {
    const interval = setInterval(() => {
      const { phase, roundStartedAt, drawTimeSeconds } = useGameStore.getState();

      if (phase !== "drawing" || !roundStartedAt) {
        return;
      }

      const elapsed = Math.floor(
        (Date.now() - roundStartedAt.getTime()) / 1000
      );
      const remaining = Math.max(0, drawTimeSeconds - elapsed);

      useGameStore.setState({ timeRemaining: remaining });

    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);
}
