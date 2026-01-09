import { create } from "zustand";
import type { DrawingCommand } from "@/models";
import { logger } from "@/lib/logger";
import { parseHubError } from "@/lib/utils";
import { useConnectionStore } from "./connectionStore";
import { useRoomStore } from "./roomStore";
import { useToastStore } from "./toastStore";

// Callback types for canvas events
type DrawingCommandCallback = (command: DrawingCommand) => void;
type CanvasHistoryCallback = (history: DrawingCommand[]) => void;
type ClearCanvasCallback = () => void;
type UndoCallback = () => void;
type FillCommandCallback = (command: DrawingCommand) => void;

// Track whether the real canvas component is subscribed to events
// This allows the fallback handler to know when to defer to the real handler
let isCanvasSubscribed = false;

export function getIsCanvasSubscribed(): boolean {
  return isCanvasSubscribed;
}

export function setIsCanvasSubscribed(value: boolean): void {
  isCanvasSubscribed = value;
}

interface CanvasStore {
  pendingCanvasHistory: DrawingCommand[] | null;
  
  // AI Drawing state
  isAIDrawing: boolean;
  aiDrawingError: string | null;
  aiDrawingStrokeIds: string[]; // Track stroke IDs from AI drawing for undo;

  // Actions
  setPendingCanvasHistory: (history: DrawingCommand[] | null) => void;
  clearPendingCanvasHistory: () => void;
  setIsAIDrawing: (isDrawing: boolean) => void;
  setAIDrawingError: (error: string | null) => void;
  addAIDrawingStrokeId: (strokeId: string) => void;
  clearAIDrawingStrokeIds: () => void;

  // SignalR actions
  sendDrawingCommand: (command: DrawingCommand) => Promise<void>;
  sendFillCommand: (command: DrawingCommand) => Promise<void>;
  undoLastDrawCommand: () => Promise<void>;
  clearCanvas: () => Promise<void>;
  startAIDrawing: () => Promise<void>;
  stopAIDrawing: () => Promise<void>;
  undoAIDrawing: () => Promise<void>;

  // Event subscription methods - these now handle connection state changes
  // and will auto-bind callbacks when connection becomes available
  onReceiveDrawingCommand: (callback: DrawingCommandCallback) => () => void;
  onReceiveCanvasHistory: (callback: CanvasHistoryCallback) => () => void;
  onCanvasCleared: (callback: ClearCanvasCallback) => () => void;
  onReceiveUndo: (callback: UndoCallback) => () => void;
  onReceiveFillCommand: (callback: FillCommandCallback) => () => void;
  onReceiveAIDrawingCommand: (callback: DrawingCommandCallback) => () => void;

  // Reset
  reset: () => void;
}

/**
 * Creates a subscription helper that handles connection state changes.
 * If connection isn't available at subscription time, it waits for it.
 * Also re-subscribes after reconnection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createConnectionAwareSubscription<T extends (...args: any[]) => void>(
  eventName: string,
  callback: T
): () => void {
  let currentCleanup: (() => void) | null = null;
  let isUnsubscribed = false;

  const subscribe = () => {
    if (isUnsubscribed) return;
    
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on(eventName, callback);
      currentCleanup = () => {
        connection.off(eventName, callback);
      };
    }
  };

  // Subscribe immediately if connection is available
  subscribe();

  // Also subscribe to connection state changes to handle reconnection
  const unsubscribeStore = useConnectionStore.subscribe((state, prevState) => {
    // Connection became available (initial connect or reconnect)
    if (state.connection && state.connection !== prevState.connection) {
      // Clean up old subscription if any
      currentCleanup?.();
      currentCleanup = null;
      // Subscribe to new connection
      subscribe();
    }
  });

  return () => {
    isUnsubscribed = true;
    currentCleanup?.();
    currentCleanup = null;
    unsubscribeStore();
  };
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  pendingCanvasHistory: null,
  isAIDrawing: false,
  aiDrawingError: null,
  aiDrawingStrokeIds: [],

  setPendingCanvasHistory: (history) => set({ pendingCanvasHistory: history }),
  clearPendingCanvasHistory: () => set({ pendingCanvasHistory: null }),
  setIsAIDrawing: (isDrawing) => set({ isAIDrawing: isDrawing }),
  setAIDrawingError: (error) => set({ aiDrawingError: error }),
  addAIDrawingStrokeId: (strokeId) => set((state) => (
    state.aiDrawingStrokeIds.includes(strokeId)
      ? state
      : { aiDrawingStrokeIds: [...state.aiDrawingStrokeIds, strokeId] }
  )),
  clearAIDrawingStrokeIds: () => set({ aiDrawingStrokeIds: [] }),

  sendDrawingCommand: async (command) => {
    const { connection, isConnected } = useConnectionStore.getState();
    const { roomCode } = useRoomStore.getState();
    
    if (!isConnected() || !connection || !roomCode) return;

    await connection.invoke("SendDrawingCommand", command, roomCode);
  },

  sendFillCommand: async (command) => {
    const { connection, isConnected } = useConnectionStore.getState();
    const { roomCode } = useRoomStore.getState();
    
    if (!isConnected() || !connection || !roomCode) return;

    await connection.invoke("SendFillCommand", command, roomCode);
  },

  undoLastDrawCommand: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    const { roomCode } = useRoomStore.getState();

    if (!isConnected() || !connection || !roomCode) return;

    await connection.invoke("UndoLastDrawCommand", roomCode);
  },

  clearCanvas: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    const { roomCode } = useRoomStore.getState();
    
    if (!isConnected() || !connection || !roomCode) return;

    await connection.invoke("ClearCanvas", roomCode);
  },

  startAIDrawing: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    
    if (!isConnected() || !connection) {
      logger.warn("Cannot start AI drawing: not connected");
      return;
    }

    try {
      set({ aiDrawingError: null, aiDrawingStrokeIds: [], isAIDrawing: true });
      await connection.invoke("StartAiDrawing");
    } catch (error) {
      logger.error("Failed to start AI drawing", error);
      const errorMessage = parseHubError(error);
      set({ aiDrawingError: errorMessage, isAIDrawing: false });
      useToastStore.getState().addToast(errorMessage, "error", 5000);
    }
  },

  stopAIDrawing: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    
    if (!isConnected() || !connection) {
      logger.warn("Cannot stop AI drawing: not connected");
      // Still reset state locally even if not connected
      set({ isAIDrawing: false });
      return;
    }

    try {
      await connection.invoke("StopAiDrawing");
    } catch (error) {
      logger.error("Failed to stop AI drawing", error);
    } finally {
      // Always reset state locally to prevent stuck UI
      // The server will also send AIDrawingStopped, but this ensures UI responsiveness
      set({ isAIDrawing: false });
    }
  },

  undoAIDrawing: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    const { roomCode } = useRoomStore.getState();
    const { aiDrawingStrokeIds } = get();
    
    if (!isConnected() || !connection || !roomCode) {
      logger.warn("Cannot undo AI drawing: not connected or not in room");
      return;
    }

    if (aiDrawingStrokeIds.length === 0) {
      logger.warn("No AI drawing strokes to undo");
      return;
    }

    try {
      // Use batch undo endpoint for atomic removal
      await connection.invoke("UndoAIDrawing", roomCode, aiDrawingStrokeIds);
      set({ aiDrawingStrokeIds: [] });
      logger.info(`Undid ${aiDrawingStrokeIds.length} AI drawing strokes`);
    } catch (error) {
      logger.error("Failed to undo AI drawing", error);
      useToastStore.getState().addToast(parseHubError(error), "error", 5000);
    }
  },

  onReceiveDrawingCommand: (callback) => {
    return createConnectionAwareSubscription("ReceiveDrawingCommand", callback);
  },

  onReceiveCanvasHistory: (callback) => {
    return createConnectionAwareSubscription("ReceiveCanvasHistory", callback);
  },

  onCanvasCleared: (callback) => {
    return createConnectionAwareSubscription("CanvasCleared", callback);
  },

  onReceiveUndo: (callback) => {
    return createConnectionAwareSubscription("ReceiveUndo", callback);
  },

  onReceiveFillCommand: (callback) => {
    return createConnectionAwareSubscription("ReceiveFillCommand", callback);
  },

  onReceiveAIDrawingCommand: (callback) => {
    return createConnectionAwareSubscription("AIDrawingCommand", callback);
  },

  reset: () =>
    set({
      pendingCanvasHistory: null,
      isAIDrawing: false,
      aiDrawingError: null,
      aiDrawingStrokeIds: [],
    }),
}));

// Setup SignalR event handlers for canvas events
export function setupCanvasEventHandlers() {
  const seenStrokeIds = new Set<string>();
  const connection = useConnectionStore.getState().connection;
  if (!connection) return () => {};

  // Fallback handler for ReceiveCanvasHistory when DrawingCanvas isn't mounted yet
  // (e.g., late joiners who receive history before GameScreen renders)
  // Only stores as pending if DrawingCanvas hasn't subscribed yet to avoid conflicts
  const handleCanvasHistoryFallback = (history: DrawingCommand[]) => {
    // Only set pending history if the real canvas handler isn't subscribed
    // This prevents the fallback from fighting with the real handler
    if (!isCanvasSubscribed) {
      logger.info("Canvas not mounted, storing history as pending");
      useCanvasStore.getState().setPendingCanvasHistory(history);
    }
  };

  const handleAIDrawingStarted = () => {
    logger.info("AI drawing started");
    useCanvasStore.getState().setIsAIDrawing(true);
    useCanvasStore.getState().setAIDrawingError(null);
    useCanvasStore.getState().clearAIDrawingStrokeIds();
    seenStrokeIds.clear();
  };

  const handleAIDrawingStopped = () => {
    logger.info("AI drawing stopped");
    useCanvasStore.getState().setIsAIDrawing(false);
  };

  const handleAIDrawingError = (error: string) => {
    logger.error("AI drawing error:", error);
    useCanvasStore.getState().setAIDrawingError(error);
    useCanvasStore.getState().setIsAIDrawing(false);
    useToastStore.getState().addToast(error, "error", 5000);
  };

  // Track AI drawing stroke IDs for undo functionality
  const handleAIDrawingCommand = (command: DrawingCommand) => {
    if (command.strokeId && !seenStrokeIds.has(command.strokeId)) {
      seenStrokeIds.add(command.strokeId);
      useCanvasStore.getState().addAIDrawingStrokeId(command.strokeId);
    }
  };

  connection.on("ReceiveCanvasHistory", handleCanvasHistoryFallback);
  connection.on("AIDrawingStarted", handleAIDrawingStarted);
  connection.on("AIDrawingStopped", handleAIDrawingStopped);
  connection.on("AIDrawingError", handleAIDrawingError);
  connection.on("AIDrawingCommand", handleAIDrawingCommand);

  return () => {
    connection.off("ReceiveCanvasHistory", handleCanvasHistoryFallback);
    connection.off("AIDrawingStarted", handleAIDrawingStarted);
    connection.off("AIDrawingStopped", handleAIDrawingStopped);
    connection.off("AIDrawingError", handleAIDrawingError);
    connection.off("AIDrawingCommand", handleAIDrawingCommand);
  };
}
