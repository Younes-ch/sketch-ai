import { create } from "zustand";
import {
  type Player,
  type PublicRoom,
  type PaginatedPublicRooms,
  type RoomSettings,
  type VoteKick,
  defaultRoomSettings
} from "@/models";
import { logger } from "@/lib/logger";
import { parseHubError } from "@/lib/utils";
import { useConnectionStore } from "./connectionStore";
import { useGameStore } from "./gameStore";
import { useChatStore } from "./chatStore";
import { useCanvasStore } from "./canvasStore";
import { useToastStore } from "./toastStore";

interface PublicRoomsPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface RoomStore {
  roomCode: string | null;
  username: string | null;
  isHost: boolean;
  players: Player[];
  publicRooms: PublicRoom[];
  publicRoomsPagination: PublicRoomsPagination;
  isLoadingRooms: boolean;
  roomSettings: RoomSettings;
  activeVoteKick: VoteKick | null;
  wasKicked: boolean;
  kickReason: string | null;

  // Actions
  setRoomCode: (code: string | null) => void;
  setUsername: (name: string | null) => void;
  setIsHost: (value: boolean) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (username: string) => void;
  updateHostStatus: (newHostUsername: string) => void;
  setPublicRoomsData: (data: PaginatedPublicRooms) => void;
  setIsLoadingRooms: (value: boolean) => void;
  setRoomSettings: (settings: RoomSettings) => void;
  setActiveVoteKick: (voteKick: VoteKick | null) => void;
  setWasKicked: (kicked: boolean, reason?: string) => void;
  clearKickedState: () => void;

  // SignalR actions
  createRoom: (username: string, roomName: string, roomCode: string, isPublic: boolean, settings: RoomSettings) => Promise<void>;
  joinRoom: (username: string, roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  getPublicRooms: (page?: number, pageSize?: number) => Promise<void>;
  updateRoomSettings: (settings: Partial<RoomSettings>) => Promise<void>;
  kickPlayer: (targetUsername: string) => Promise<void>;
  startVoteKick: (targetUsername: string) => Promise<void>;
  castVoteKick: (voteToKick: boolean) => Promise<void>;

  // Reset
  reset: () => void;
}

const defaultPagination: PublicRoomsPagination = {
  page: 1,
  pageSize: 0,
  totalCount: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  roomCode: null,
  username: null,
  isHost: false,
  players: [],
  publicRooms: [],
  publicRoomsPagination: { ...defaultPagination },
  isLoadingRooms: false,
  roomSettings: { ...defaultRoomSettings },
  activeVoteKick: null,
  wasKicked: false,
  kickReason: null,

  setRoomCode: (code) => set({ roomCode: code }),
  setUsername: (name) => set({ username: name }),
  setIsHost: (value) => set({ isHost: value }),
  setPlayers: (players) => set({ players }),
  setPublicRoomsData: (data) => set({
    publicRooms: data.rooms,
    publicRoomsPagination: {
      page: data.page,
      pageSize: data.pageSize,
      totalCount: data.totalCount,
      totalPages: data.totalPages,
      hasNextPage: data.hasNextPage,
      hasPreviousPage: data.hasPreviousPage
    }
  }),
  setIsLoadingRooms: (value) => set({ isLoadingRooms: value }),
  setRoomSettings: (settings) => set({ roomSettings: settings }),
  setActiveVoteKick: (voteKick) => set({ activeVoteKick: voteKick }),
  setWasKicked: (kicked, reason) => set({ wasKicked: kicked, kickReason: reason ?? null }),
  clearKickedState: () => set({ wasKicked: false, kickReason: null }),
  
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

  createRoom: async (newUsername, newRoomName, newRoomCode, isPublic = false, settings) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    set({ username: newUsername });
    try {
      await connection.invoke("CreateRoom", newUsername, newRoomName, newRoomCode, isPublic, settings);
    } catch (error) {
      set({ username: null });
      const errorMessage = parseHubError(error);
      useToastStore.getState().addToast(errorMessage, "error", 5000);
      throw error;
    }
  },

  joinRoom: async (newUsername, newRoomCode) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    set({ username: newUsername });
    try {
      await connection.invoke("JoinRoom", newUsername, newRoomCode);
    } catch (error) {
      set({ username: null });
      const errorMessage = parseHubError(error);
      useToastStore.getState().addToast(errorMessage, "error", 5000);
      throw error;
    }
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

  getPublicRooms: async (page = 1, pageSize?: number) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    useRoomStore.getState().setIsLoadingRooms(true);
    await connection.invoke("GetPublicRooms", page, pageSize ?? null);
  },

  updateRoomSettings: async (settings) => {
    const { connection, isConnected } = useConnectionStore.getState();
    const currentSettings = get().roomSettings;
    if (!isConnected() || !connection) return;

    const newSettings = { ...currentSettings, ...settings };
    try {
      await connection.invoke("UpdateRoomSettings", newSettings);
    } catch (error) {
      const errorMessage = parseHubError(error);
      useToastStore.getState().addToast(errorMessage, "error", 5000);
      throw error;
    }
  },

  kickPlayer: async (targetUsername) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    try {
      await connection.invoke("KickPlayer", targetUsername);
    } catch (error) {
      const errorMessage = parseHubError(error);
      useToastStore.getState().addToast(errorMessage, "error", 5000);
      throw error;
    }
  },

  startVoteKick: async (targetUsername) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    try {
      await connection.invoke("StartVoteKick", targetUsername);
    } catch (error) {
      const errorMessage = parseHubError(error);
      useToastStore.getState().addToast(errorMessage, "error", 5000);
      throw error;
    }
  },

  castVoteKick: async (voteToKick) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    try {
      await connection.invoke("CastVoteKick", voteToKick);
    } catch (error) {
      const errorMessage = parseHubError(error);
      useToastStore.getState().addToast(errorMessage, "error", 5000);
      throw error;
    }
  },

  reset: () =>
    set({
      roomCode: null,
      username: null,
      isHost: false,
      players: [],
      publicRooms: [],
      publicRoomsPagination: { ...defaultPagination },
      roomSettings: { ...defaultRoomSettings },
      activeVoteKick: null,
      wasKicked: false,
      kickReason: null,
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
      message: `${player.username} has joined the game!`,
      timestamp: new Date(),
      type: "join",
    })
  };

  const handlePlayerLeft = (leftUsername: string) => {
    logger.info(`Player ${leftUsername} left`);
    useRoomStore.getState().removePlayer(leftUsername);
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `${leftUsername} has left the game.`,
      timestamp: new Date(),
      type: "leave",
    })
  };

  const handleHostChanged = (newHostUsername: string) => {
    logger.info(`Host changed to ${newHostUsername}`);
    useRoomStore.getState().updateHostStatus(newHostUsername);
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `${newHostUsername} is now the host!`,
      timestamp: new Date(),
      type: "owner-change",
    })
  };

  const handleReceivePublicRooms = (data: PaginatedPublicRooms) => {
    logger.info(`Received ${data.rooms.length} public rooms (page ${data.page}/${data.totalPages}, total: ${data.totalCount})`);
    useRoomStore.getState().setPublicRoomsData(data);
    useRoomStore.getState().setIsLoadingRooms(false);
  };

  const handleKicked = (reason: string) => {
    logger.info(`Kicked from room: ${reason}`);
    useRoomStore.getState().reset();
    useGameStore.getState().reset();
    useChatStore.getState().reset();
    useCanvasStore.getState().reset();
    useRoomStore.getState().setWasKicked(true, reason);
    useToastStore.getState().addToast(`${reason}`, "error", 10000);
  };

  const handleVoteKickStarted = (data: {
    targetUsername: string;
    initiatorUsername: string;
    votesToKick: number;
    votesToKeep: number;
    totalVotersNeeded: number;
    startedAt: string;
    durationSeconds: number;
  }) => {
    logger.info(`Votekick started against ${data.targetUsername} by ${data.initiatorUsername}`);
    useRoomStore.getState().setActiveVoteKick({
      targetUsername: data.targetUsername,
      initiatorUsername: data.initiatorUsername,
      votesToKick: data.votesToKick,
      votesToKeep: data.votesToKeep,
      totalVotersNeeded: data.totalVotersNeeded,
      startedAt: data.startedAt,
      durationSeconds: data.durationSeconds,
    });
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `${data.initiatorUsername} started a vote to kick ${data.targetUsername}`,
      timestamp: new Date(),
      type: "system",
    });
  };

  const handleVoteKickUpdated = (data: {
    targetUsername: string;
    votesToKick: number;
    votesToKeep: number;
    totalVotersNeeded: number;
    startedAt: string;
    durationSeconds: number;
  }) => {
    logger.info(`Votekick updated: ${data.votesToKick} kick, ${data.votesToKeep} keep`);
    const current = useRoomStore.getState().activeVoteKick;
    if (current && current.targetUsername === data.targetUsername) {
      useRoomStore.getState().setActiveVoteKick({
        ...current,
        votesToKick: data.votesToKick,
        votesToKeep: data.votesToKeep,
        totalVotersNeeded: data.totalVotersNeeded,
        startedAt: data.startedAt,
        durationSeconds: data.durationSeconds,
      });
    }
  };

  const handleVoteKickEnded = (data: {
    targetUsername: string;
    shouldKick: boolean;
    votesToKick: number;
    votesToKeep: number;
    timedOut?: boolean;
  }) => {
    const reason = data.timedOut ? " (time expired)" : "";
    logger.info(`Votekick ended: ${data.targetUsername} ${data.shouldKick ? "kicked" : "kept"}${reason}`);
    useRoomStore.getState().setActiveVoteKick(null);
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: data.shouldKick
        ? `Vote passed: ${data.targetUsername} was kicked (${data.votesToKick}-${data.votesToKeep})${reason}`
        : `Vote failed: ${data.targetUsername} stays (${data.votesToKick}-${data.votesToKeep})${reason}`,
      timestamp: new Date(),
      type: "system",
    });
  };

  const handleVoteKickCancelled = (data: { reason: string }) => {
    logger.info(`Votekick cancelled: ${data.reason}`);
    useRoomStore.getState().setActiveVoteKick(null);
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `Vote cancelled: ${data.reason}`,
      timestamp: new Date(),
      type: "system",
    });
  };

  connection.on("RoomCreated", handleRoomCreated);
  connection.on("RoomSettingsUpdated", handleRoomSettingsUpdated);
  connection.on("RoomJoined", handleRoomJoined);
  connection.on("PlayerJoined", handlePlayerJoined);
  connection.on("PlayerLeft", handlePlayerLeft);
  connection.on("HostChanged", handleHostChanged);
  connection.on("ReceivePublicRooms", handleReceivePublicRooms);
  connection.on("Kicked", handleKicked);
  connection.on("VoteKickStarted", handleVoteKickStarted);
  connection.on("VoteKickUpdated", handleVoteKickUpdated);
  connection.on("VoteKickEnded", handleVoteKickEnded);
  connection.on("VoteKickCancelled", handleVoteKickCancelled);

  return () => {
    connection.off("RoomCreated", handleRoomCreated);
    connection.off("RoomSettingsUpdated", handleRoomSettingsUpdated);
    connection.off("RoomJoined", handleRoomJoined);
    connection.off("PlayerJoined", handlePlayerJoined);
    connection.off("PlayerLeft", handlePlayerLeft);
    connection.off("HostChanged", handleHostChanged);
    connection.off("ReceivePublicRooms", handleReceivePublicRooms);
    connection.off("Kicked", handleKicked);
    connection.off("VoteKickStarted", handleVoteKickStarted);
    connection.off("VoteKickUpdated", handleVoteKickUpdated);
    connection.off("VoteKickEnded", handleVoteKickEnded);
    connection.off("VoteKickCancelled", handleVoteKickCancelled);
  };
}
