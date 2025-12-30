import { create } from "zustand";
import type { DrawingCommand } from "@/models";
import { logger } from "@/lib/logger";
import { useConnectionStore } from "./connectionStore";
import { useRoomStore } from "./roomStore";

// Callback types for canvas events
type DrawingCommandCallback = (command: DrawingCommand) => void;
type CanvasHistoryCallback = (history: DrawingCommand[]) => void;
type ClearCanvasCallback = () => void;
type UndoCallback = () => void;
type FillCommandCallback = (command: DrawingCommand) => void;

interface CanvasStore {
  pendingCanvasHistory: DrawingCommand[] | null;
  
  // Callback refs for event subscriptions
  drawingCommandCallback: DrawingCommandCallback | null;
  historyCallback: CanvasHistoryCallback | null;
  clearCallback: ClearCanvasCallback | null;

  // Actions
  setPendingCanvasHistory: (history: DrawingCommand[] | null) => void;
  clearPendingCanvasHistory: () => void;

  // SignalR actions
  sendDrawingCommand: (command: DrawingCommand) => Promise<void>;
  sendFillCommand: (command: DrawingCommand) => Promise<void>;
  undoLastDrawCommand: () => Promise<void>;
  clearCanvas: () => Promise<void>;

  // Event subscription methods
  onReceiveDrawingCommand: (callback: DrawingCommandCallback) => () => void;
  onReceiveCanvasHistory: (callback: CanvasHistoryCallback) => () => void;
  onCanvasCleared: (callback: ClearCanvasCallback) => () => void;
  onReceiveUndo: (callback: UndoCallback) => () => void;
  onReceiveFillCommand: (callback: FillCommandCallback) => () => void;

  // Reset
  reset: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  pendingCanvasHistory: null,
  drawingCommandCallback: null,
  historyCallback: null,
  clearCallback: null,
  undoCallback: null,
  fillCommandCallback: null,

  setPendingCanvasHistory: (history) => set({ pendingCanvasHistory: history }),
  clearPendingCanvasHistory: () => set({ pendingCanvasHistory: null }),

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

  onReceiveDrawingCommand: (callback) => {
    const connection = useConnectionStore.getState().connection;
    if (connection) {
      connection.on("ReceiveDrawingCommand", callback);
      return () => connection.off("ReceiveDrawingCommand", callback);
    }
    return () => {};
  },

  onReceiveCanvasHistory: (callback) => {
    // Store the callback for direct invocation from event handler
    set({ historyCallback: callback });
    return () => set({ historyCallback: null });
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

  reset: () =>
    set({
      pendingCanvasHistory: null,
      drawingCommandCallback: null,
      historyCallback: null,
      clearCallback: null,
    }),
}));

// Setup SignalR event handlers for canvas events
export function setupCanvasEventHandlers() {
  const connection = useConnectionStore.getState().connection;
  if (!connection) return () => {};

  const handleCanvasHistory = (history: DrawingCommand[]) => {
    logger.info(`Received canvas history with ${history.length} commands`);
    const { historyCallback } = useCanvasStore.getState();
    
    if (historyCallback) {
      historyCallback(history);
    } else {
      useCanvasStore.getState().setPendingCanvasHistory(history);
    }
  };

  connection.on("ReceiveCanvasHistory", handleCanvasHistory);

  return () => {
    connection.off("ReceiveCanvasHistory", handleCanvasHistory);
  };
}
