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

  // Event subscription methods
  onReceiveDrawingCommand: (callback: DrawingCommandCallback) => () => void;
  onReceiveCanvasHistory: (callback: CanvasHistoryCallback) => () => void;
  onCanvasCleared: (callback: ClearCanvasCallback) => () => void;
  onReceiveUndo: (callback: UndoCallback) => () => void;
  onReceiveFillCommand: (callback: FillCommandCallback) => () => void;
  onReceiveAIDrawingCommand: (callback: DrawingCommandCallback) => () => void;

  // Reset
  reset: () => void;
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
  addAIDrawingStrokeId: (strokeId) => set((state) => ({
    aiDrawingStrokeIds: [...state.aiDrawingStrokeIds, strokeId]
  })),
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
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on("ReceiveDrawingCommand", callback);
      return () => connection.off("ReceiveDrawingCommand", callback);
    }
    return () => {};
  },

  onReceiveCanvasHistory: (callback) => {
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on("ReceiveCanvasHistory", callback);
      return () => connection.off("ReceiveCanvasHistory", callback);
    }
    return () => {};
  },

  onCanvasCleared: (callback) => {
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on("CanvasCleared", callback);
      return () => connection.off("CanvasCleared", callback);
    }
    return () => {};
  },

  onReceiveUndo: (callback) => {
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on("ReceiveUndo", callback);
      return () => connection.off("ReceiveUndo", callback);
    }
    return () => {};
  },

  onReceiveFillCommand: (callback) => {
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on("ReceiveFillCommand", callback);
      return () => connection.off("ReceiveFillCommand", callback);
    }
    return () => {};
  },

  onReceiveAIDrawingCommand: (callback) => {
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on("AIDrawingCommand", callback);
      return () => connection.off("AIDrawingCommand", callback);
    }
    return () => {};
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
  // DrawingCanvas also registers its own handler via onReceiveCanvasHistory
  const handleCanvasHistoryFallback = (history: DrawingCommand[]) => {
    // Store as pending - DrawingCanvas will pick this up when it mounts
    useCanvasStore.getState().setPendingCanvasHistory(history);
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
