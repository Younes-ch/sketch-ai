import { create } from "zustand";
import type { Player } from "@/models";
import { logger } from "@/lib/logger";
import {
  useConnectionStore,
  saveSession,
  clearStoredSession,
  getStoredSession,
} from "./connectionStore";
import { useGameStore } from "./gameStore";
import { useChatStore } from "./chatStore";
import { useCanvasStore } from "./canvasStore";

interface RoomStore {
  roomCode: string | null;
  username: string | null;
  isHost: boolean;
  players: Player[];

  // Actions
  setRoomCode: (code: string | null) => void;
  setUsername: (name: string | null) => void;
  setIsHost: (value: boolean) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (username: string) => void;
  updateHostStatus: (newHostUsername: string) => void;

  // SignalR actions
  createRoom: (username: string, roomCode: string, isPublic?: boolean) => Promise<void>;
  joinRoom: (username: string, roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  attemptReconnect: () => Promise<boolean>;
  getPublicRooms: () => Promise<void>;

  // Reset
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  roomCode: null,
  username: null,
  isHost: false,
  players: [],

  setRoomCode: (code) => set({ roomCode: code }),
  setUsername: (name) => set({ username: name }),
  setIsHost: (value) => set({ isHost: value }),
  setPlayers: (players) => set({ players }),
  
  addPlayer: (player) =>
    set((state) => ({ players: [...state.players, player] })),
  
  removePlayer: (username) =>
    set((state) => ({
      players: state.players.filter((p) => p.username !== username),
    })),

  updateHostStatus: (newHostUsername) => {
    const { username } = get();
    set((state) => ({
      players: state.players.map((p) => ({
        ...p,
        isHost: p.username === newHostUsername,
      })),
      isHost: newHostUsername === username,
    }));
  },

  createRoom: async (newUsername, newRoomCode, isPublic = false) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    set({ username: newUsername });
    await connection.invoke("CreateRoom", newUsername, newRoomCode, isPublic);
    saveSession(newRoomCode, newUsername);
  },

  joinRoom: async (newUsername, newRoomCode) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    set({ username: newUsername });
    await connection.invoke("JoinRoom", newUsername, newRoomCode);
    saveSession(newRoomCode, newUsername);
  },

  leaveRoom: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    const { roomCode } = get();
    
    if (!isConnected() || !connection || !roomCode) return;

    await connection.invoke("LeaveRoom");
    clearStoredSession();
    
    // Reset all stores
    get().reset();
    useGameStore.getState().reset();
    useChatStore.getState().reset();
    useCanvasStore.getState().reset();
  },

  attemptReconnect: async () => {
    const session = getStoredSession();
    if (!session) return false;

    const { connection, isConnected, setIsReconnecting } = useConnectionStore.getState();
    if (!isConnected() || !connection) return false;

    setIsReconnecting(true);
    try {
      set({ username: session.username });
      await connection.invoke("JoinRoom", session.username, session.roomCode);
      return true;
    } catch {
      clearStoredSession();
      set({ username: null });
      return false;
    } finally {
      setIsReconnecting(false);
    }
  },

  getPublicRooms: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    await connection.invoke("GetPublicRooms");
  },

  reset: () =>
    set({
      roomCode: null,
      username: null,
      isHost: false,
      players: [],
    }),
}));

// Setup SignalR event handlers for room events
export function setupRoomEventHandlers() {
  const connection = useConnectionStore.getState().connection;
  if (!connection) return () => {};

  const handleRoomCreated = (code: string, playerList: Player[]) => {
    logger.info(`Room ${code} created with ${playerList.length} players`);
    useRoomStore.setState({
      roomCode: code,
      players: playerList,
      isHost: true,
    });
  };

  const handleRoomJoined = (code: string, playerList: Player[]) => {
    logger.info(`Joined room ${code} with ${playerList.length} players`);
    const username = useRoomStore.getState().username;
    const currentPlayer = playerList.find((p) => p.username === username);
    useRoomStore.setState({
      roomCode: code,
      players: playerList,
      isHost: currentPlayer?.isHost ?? false,
    });
  };

  const handlePlayerJoined = (player: Player) => {
    logger.info(`Player ${player.username} joined`);
    useRoomStore.getState().addPlayer(player);
  };

  const handlePlayerLeft = (leftUsername: string) => {
    logger.info(`Player ${leftUsername} left`);
    useRoomStore.getState().removePlayer(leftUsername);
  };

  const handleHostChanged = (newHostUsername: string) => {
    logger.info(`Host changed to ${newHostUsername}`);
    useRoomStore.getState().updateHostStatus(newHostUsername);
  };

  connection.on("RoomCreated", handleRoomCreated);
  connection.on("RoomJoined", handleRoomJoined);
  connection.on("PlayerJoined", handlePlayerJoined);
  connection.on("PlayerLeft", handlePlayerLeft);
  connection.on("HostChanged", handleHostChanged);

  return () => {
    connection.off("RoomCreated", handleRoomCreated);
    connection.off("RoomJoined", handleRoomJoined);
    connection.off("PlayerJoined", handlePlayerJoined);
    connection.off("PlayerLeft", handlePlayerLeft);
    connection.off("HostChanged", handleHostChanged);
  };
}
