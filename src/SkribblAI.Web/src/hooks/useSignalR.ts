import { useConnectionStore } from "@/stores/connectionStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useChatStore } from "@/stores/chatStore";
import { useCanvasStore } from "@/stores/canvasStore";
import type { GameState, Player, PublicRoom } from "@/models";

/**
 * Compatibility hook that provides the same interface as the old SignalRContext.
 * This allows gradual migration of components to use individual stores directly.
 */
export const useSignalR = () => {
  // Connection store
  const connection = useConnectionStore((s) => s.connection);
  const connectionState = useConnectionStore((s) => s.connectionState);
  const isReconnecting = useConnectionStore((s) => s.isReconnecting);

  // Room store
  const roomCode = useRoomStore((s) => s.roomCode);
  const username = useRoomStore((s) => s.username);
  const isHost = useRoomStore((s) => s.isHost);
  const players = useRoomStore((s) => s.players);
  const createRoom = useRoomStore((s) => s.createRoom);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const attemptReconnect = useRoomStore((s) => s.attemptReconnect);
  const getPublicRooms = useRoomStore((s) => s.getPublicRooms);

  // Game store - combine into gameState object for compatibility
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const currentWord = useGameStore((s) => s.currentWord);
  const wordHint = useGameStore((s) => s.wordHint);
  const wordChoices = useGameStore((s) => s.wordChoices);
  const roundNumber = useGameStore((s) => s.roundNumber);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const playersWhoGuessed = useGameStore((s) => s.playersWhoGuessed);
  const startGame = useGameStore((s) => s.startGame);
  const selectWord = useGameStore((s) => s.selectWord);
  const sendGuess = useGameStore((s) => s.sendGuess);

  const gameState: GameState = {
    phase,
    currentDrawer,
    currentWord,
    wordHint,
    wordChoices,
    roundNumber,
    totalRounds,
    timeRemaining,
  };

  // Chat store
  const chatMessages = useChatStore((s) => s.messages);

  // Canvas store
  const pendingCanvasHistory = useCanvasStore((s) => s.pendingCanvasHistory);
  const clearPendingCanvasHistory = useCanvasStore((s) => s.clearPendingCanvasHistory);
  const sendDrawingCommand = useCanvasStore((s) => s.sendDrawingCommand);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const onReceiveDrawingCommand = useCanvasStore((s) => s.onReceiveDrawingCommand);
  const onReceiveCanvasHistory = useCanvasStore((s) => s.onReceiveCanvasHistory);
  const onCanvasCleared = useCanvasStore((s) => s.onCanvasCleared);

  // Event subscription placeholders (these are now handled in setupEventHandlers)
  const onPlayerJoined = (callback: (player: Player) => void) => {
    const conn = useConnectionStore.getState().connection;
    if (conn) {
      conn.on("PlayerJoined", callback);
      return () => conn.off("PlayerJoined", callback);
    }
    return () => {};
  };

  const onPlayerLeft = (callback: (username: string) => void) => {
    const conn = useConnectionStore.getState().connection;
    if (conn) {
      conn.on("PlayerLeft", callback);
      return () => conn.off("PlayerLeft", callback);
    }
    return () => {};
  };

  const onHostChanged = (callback: (newHostUsername: string) => void) => {
    const conn = useConnectionStore.getState().connection;
    if (conn) {
      conn.on("HostChanged", callback);
      return () => conn.off("HostChanged", callback);
    }
    return () => {};
  };

  const onError = (callback: (message: string) => void) => {
    const conn = useConnectionStore.getState().connection;
    if (conn) {
      conn.on("Error", callback);
      return () => conn.off("Error", callback);
    }
    return () => {};
  };

  const onReceivePublicRooms = (callback: (rooms: PublicRoom[]) => void) => {
    const conn = useConnectionStore.getState().connection;
    if (conn) {
      conn.on("ReceivePublicRooms", callback);
      return () => conn.off("ReceivePublicRooms", callback);
    }
    return () => {};
  };

  return {
    connection,
    connectionState,
    roomCode,
    username,
    isHost,
    players,
    isReconnecting,
    pendingCanvasHistory,
    gameState,
    chatMessages,
    playersWhoGuessed,
    clearPendingCanvasHistory,
    createRoom,
    joinRoom,
    leaveRoom,
    attemptReconnect,
    getPublicRooms,
    sendDrawingCommand,
    clearCanvas,
    startGame,
    selectWord,
    sendGuess,
    onReceiveDrawingCommand,
    onReceiveCanvasHistory,
    onCanvasCleared,
    onPlayerJoined,
    onPlayerLeft,
    onHostChanged,
    onError,
    onReceivePublicRooms,
  };
};
