import { useEffect, useRef } from "react";
import { useConnectionStore } from "@/stores/connectionStore";
import { setupRoomEventHandlers } from "@/stores/roomStore";
import { setupGameEventHandlers } from "@/stores/gameStore";
import { setupChatEventHandlers } from "@/stores/chatStore";
import { setupCanvasEventHandlers } from "@/stores/canvasStore";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { logger } from "@/lib/logger";
import * as signalR from "@microsoft/signalr";

const ROUND_DURATION = 80; // seconds

/**
 * Hook to initialize SignalR connection and setup all event handlers.
 * Call this once at the app root level.
 */
export function useSignalRInit() {
  const { connection, initializeConnection } = useConnectionStore();
  const cleanupRef = useRef<(() => void)[]>([]);
  const lastRevealTimeRef = useRef<number | null>(null);
  const hasEndedRoundRef = useRef<boolean>(false);

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
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      // Only run when phase changes to/from drawing or roundStartedAt changes
      if (
        state.phase !== prevState.phase ||
        state.roundStartedAt !== prevState.roundStartedAt
      ) {
        // Reset reveal tracking when phase changes
        if (state.phase !== "drawing") {
          lastRevealTimeRef.current = null;
        }
      }

      if (state.phase === "drawing" && prevState.phase !== "drawing") {
        hasEndedRoundRef.current = false;
      }
    });

    const interval = setInterval(() => {
      const { phase, roundStartedAt, currentDrawer } = useGameStore.getState();
      const { username } = useRoomStore.getState();
      const { connection } = useConnectionStore.getState();

      if (phase !== "drawing" || !roundStartedAt) {
        return;
      }

      const elapsed = Math.floor(
        (Date.now() - roundStartedAt.getTime()) / 1000
      );
      const remaining = Math.max(0, ROUND_DURATION - elapsed);

      useGameStore.setState({ timeRemaining: remaining });

      if (remaining <= 0 && !hasEndedRoundRef.current) {
        if (currentDrawer?.username === username) {
          hasEndedRoundRef.current = true;
          useGameStore.getState().endRound().catch((err) => {
            logger.error("Failed to end round", err);
          });
        }
      }

      // Check if we should reveal a letter (at 60s, 40s, 20s remaining)
      // Only the drawer triggers the reveal to avoid multiple requests
      if (
        connection?.state === signalR.HubConnectionState.Connected &&
        currentDrawer?.username === username
      ) {
        const revealThresholds = [60, 40, 20];
        for (const threshold of revealThresholds) {
          if (
            remaining <= threshold &&
            (lastRevealTimeRef.current === null ||
              lastRevealTimeRef.current > threshold)
          ) {
            lastRevealTimeRef.current = threshold;
            connection.invoke("RevealLetter").catch((err) => {
              logger.error("Failed to reveal letter", err);
            });
            break;
          }
        }
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);
}
