import { create } from "zustand";
import { type Player, type PublicRoom, type RoomSettings, defaultRoomSettings } from "@/models";
import { logger } from "@/lib/logger";
import { useConnectionStore } from "./connectionStore";
import { useGameStore } from "./gameStore";
import { useChatStore } from "./chatStore";
import { useCanvasStore } from "./canvasStore";

interface RoomStore {
  roomCode: string | null;
  username: string | null;
  isHost: boolean;
  players: Player[];
  publicRooms: PublicRoom[];
  isLoadingRooms: boolean;
  roomSettings: RoomSettings;

  // Actions
  setRoomCode: (code: string | null) => void;
  setUsername: (name: string | null) => void;
  setIsHost: (value: boolean) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (username: string) => void;
  updateHostStatus: (newHostUsername: string) => void;
  setPublicRooms: (rooms: PublicRoom[]) => void;
  setIsLoadingRooms: (value: boolean) => void;
  setRoomSettings: (settings: RoomSettings) => void;

  // SignalR actions
  createRoom: (username: string, roomCode: string, isPublic?: boolean, settings?: RoomSettings) => Promise<void>;
  joinRoom: (username: string, roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  getPublicRooms: () => Promise<void>;
  updateRoomSettings: (settings: Partial<RoomSettings>) => Promise<void>;

  // Reset
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  roomCode: null,
  username: null,
  isHost: false,
  players: [],
  publicRooms: [],
  isLoadingRooms: false,
  roomSettings: { ...defaultRoomSettings },

  setRoomCode: (code) => set({ roomCode: code }),
  setUsername: (name) => set({ username: name }),
  setIsHost: (value) => set({ isHost: value }),
  setPlayers: (players) => set({ players }),
  setPublicRooms: (rooms) => set({ publicRooms: rooms }),
  setIsLoadingRooms: (value) => set({ isLoadingRooms: value }),
  setRoomSettings: (settings) => set({ roomSettings: settings }),
  
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

  createRoom: async (newUsername, newRoomCode, isPublic = false, settings) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    set({ username: newUsername });
    const settingsDto = settings ? {
      maxPlayers: settings.maxPlayers,
      totalRounds: settings.totalRounds,
      drawTimeSeconds: settings.drawTimeSeconds,
      wordChoiceCount: settings.wordChoiceCount,
      difficulty: settings.difficulty,
    } : null;
    await connection.invoke("CreateRoom", newUsername, newRoomCode, settingsDto, isPublic);
  },

  joinRoom: async (newUsername, newRoomCode) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    set({ username: newUsername });
    await connection.invoke("JoinRoom", newUsername, newRoomCode);
  },

  leaveRoom: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    const { roomCode } = get();
    
    if (!isConnected() || !connection || !roomCode) return;

    await connection.invoke("LeaveRoom");
    
    // Reset all stores
    get().reset();
    useGameStore.getState().reset();
    useChatStore.getState().reset();
    useCanvasStore.getState().reset();
  },

  getPublicRooms: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    useRoomStore.getState().setIsLoadingRooms(true);
    await connection.invoke("GetPublicRooms");
  },

  updateRoomSettings: async (settings) => {
    const { connection, isConnected } = useConnectionStore.getState();
    const currentSettings = get().roomSettings;
    if (!isConnected() || !connection) return;

    const newSettings = { ...currentSettings, ...settings };
    await connection.invoke("UpdateRoomSettings", newSettings);
  },

  reset: () =>
    set({
      roomCode: null,
      username: null,
      isHost: false,
      players: [],
      publicRooms: [],
      roomSettings: { ...defaultRoomSettings },
    }),
}));

// Setup SignalR event handlers for room events
export function setupRoomEventHandlers() {
  const connection = useConnectionStore.getState().connection;
  if (!connection) return () => {};

  const handleRoomCreated = (code: string, playerList: Player[], settings?: RoomSettings) => {
    logger.info(`Room ${code} created with ${playerList.length} players`);
    useRoomStore.setState({
      roomCode: code,
      players: playerList,
      isHost: true,
      roomSettings: settings ?? defaultRoomSettings,
    });
    // Sync drawTimeSeconds to game store
    if (settings) {
      useGameStore.getState().setGameState({ drawTimeSeconds: settings.drawTimeSeconds });
    }
  };

  const handleRoomSettingsUpdated = (settings: RoomSettings) => {
    logger.info("Room settings updated", settings);
    useRoomStore.getState().setRoomSettings(settings);
    // Also update game store's drawTimeSeconds
    useGameStore.getState().setGameState({ drawTimeSeconds: settings.drawTimeSeconds });
  };

  const handleRoomJoined = (code: string, playerList: Player[], settings?: RoomSettings) => {
    logger.info(`Joined room ${code} with ${playerList.length} players`);
    const username = useRoomStore.getState().username;
    const currentPlayer = playerList.find((p) => p.username === username);
    useRoomStore.setState({
      roomCode: code,
      players: playerList,
      isHost: currentPlayer?.isHost ?? false,
      roomSettings: settings ?? defaultRoomSettings,
    });
    // Sync drawTimeSeconds to game store
    if (settings) {
      useGameStore.getState().setGameState({ drawTimeSeconds: settings.drawTimeSeconds });
    }
  };

  const handlePlayerJoined = (player: Player) => {
    logger.info(`Player ${player.username} joined`);
    useRoomStore.getState().addPlayer(player);
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `${player.username} has joined the room.`,
      timestamp: new Date(),
      type: "system",
    })
  };

  const handlePlayerLeft = (leftUsername: string) => {
    logger.info(`Player ${leftUsername} left`);
    useRoomStore.getState().removePlayer(leftUsername);
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `${leftUsername} has left the room.`,
      timestamp: new Date(),
      type: "system",
    })
  };

  const handleHostChanged = (newHostUsername: string) => {
    logger.info(`Host changed to ${newHostUsername}`);
    useRoomStore.getState().updateHostStatus(newHostUsername);
  };

  const handleReceivePublicRooms = (rooms: PublicRoom[]) => {
    logger.info(`Received ${rooms.length} public rooms`);
    useRoomStore.getState().setPublicRooms(rooms);
    useRoomStore.getState().setIsLoadingRooms(false);
  };

  connection.on("RoomCreated", handleRoomCreated);
  connection.on("RoomSettingsUpdated", handleRoomSettingsUpdated);
  connection.on("RoomJoined", handleRoomJoined);
  connection.on("PlayerJoined", handlePlayerJoined);
  connection.on("PlayerLeft", handlePlayerLeft);
  connection.on("HostChanged", handleHostChanged);
  connection.on("ReceivePublicRooms", handleReceivePublicRooms);

  return () => {
    connection.off("RoomCreated", handleRoomCreated);
    connection.off("RoomSettingsUpdated", handleRoomSettingsUpdated);
    connection.off("RoomJoined", handleRoomJoined);
    connection.off("PlayerJoined", handlePlayerJoined);
    connection.off("PlayerLeft", handlePlayerLeft);
    connection.off("HostChanged", handleHostChanged);
    connection.off("ReceivePublicRooms", handleReceivePublicRooms);
  };
}
