import type { DrawingCommand } from "@/models/drawingCommand";
import type { Player } from "@/models/player";
import * as signalR from "@microsoft/signalr";
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// Event callback types
type DrawingCommandCallback = (command: DrawingCommand) => void;
type CanvasHistoryCallback = (history: DrawingCommand[]) => void;
type ClearCanvasCallback = () => void;
type PlayerEventCallback = (player: Player) => void;
type PlayerLeftCallback = (username: string) => void;
type HostChangedCallback = (newHostUsername: string) => void;
type ErrorCallback = (message: string) => void;

interface SignalRContextType {
  connection: signalR.HubConnection | null;
  roomCode: string | null;
  username: string | null;
  isHost: boolean;
  players: Player[];
  pendingCanvasHistory: DrawingCommand[] | null;
  clearPendingCanvasHistory: () => void;
  createRoom: (username: string, roomCode: string) => Promise<void>;
  joinRoom: (username: string, roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  sendDrawingCommand: (command: DrawingCommand) => Promise<void>;
  clearCanvas: () => Promise<void>;
  // Event subscription methods
  onReceiveDrawingCommand: (callback: DrawingCommandCallback) => () => void;
  onReceiveCanvasHistory: (callback: CanvasHistoryCallback) => () => void;
  onCanvasCleared: (callback: ClearCanvasCallback) => () => void;
  onPlayerJoined: (callback: PlayerEventCallback) => () => void;
  onPlayerLeft: (callback: PlayerLeftCallback) => () => void;
  onHostChanged: (callback: HostChangedCallback) => () => void;
  onError: (callback: ErrorCallback) => () => void;
}

export const SignalRContext = createContext<SignalRContextType | null>(null);

export const SignalRProvider = ({ children }: { children: ReactNode }) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(
    null
  );
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pendingCanvasHistory, setPendingCanvasHistory] = useState<
    DrawingCommand[] | null
  >(null);

  // Use ref to track if ReceiveCanvasHistory listener is registered
  const historyListenerRef = useRef<CanvasHistoryCallback | null>(null);

  // Register server event listeners
  useEffect(() => {
    if (!connection) return;

    // Canvas history handler
    const handleCanvasHistory = (history: DrawingCommand[]) => {
      console.log(`Received canvas history with ${history.length} commands`);
      if (historyListenerRef.current) {
        historyListenerRef.current(history);
      } else {
        setPendingCanvasHistory(history);
      }
    };

    // Room created handler (for host)
    const handleRoomCreated = (code: string, playerList: Player[]) => {
      console.log(`Room ${code} created with ${playerList.length} players`);
      setRoomCode(code);
      setPlayers(playerList);
      setIsHost(true);
    };

    // Room joined handler (for joining players)
    const handleRoomJoined = (code: string, playerList: Player[]) => {
      console.log(`Joined room ${code} with ${playerList.length} players`);
      setRoomCode(code);
      setPlayers(playerList);
      // Determine if current user is host from the player list
      const currentPlayer = playerList.find((p) => p.username === username);
      setIsHost(currentPlayer?.isHost ?? false);
    };

    // Player joined handler
    const handlePlayerJoined = (player: Player) => {
      console.log(`Player ${player.username} joined`);
      setPlayers((prev) => [...prev, player]);
    };

    // Player left handler
    const handlePlayerLeft = (leftUsername: string) => {
      console.log(`Player ${leftUsername} left`);
      setPlayers((prev) => prev.filter((p) => p.username !== leftUsername));
    };

    // Host changed handler
    const handleHostChanged = (newHostUsername: string) => {
      console.log(`Host changed to ${newHostUsername}`);
      setPlayers((prev) =>
        prev.map((p) => ({
          ...p,
          isHost: p.username === newHostUsername,
        }))
      );
      // Update isHost if current user became host
      if (newHostUsername === username) {
        setIsHost(true);
      }
    };

    connection.on("ReceiveCanvasHistory", handleCanvasHistory);
    connection.on("RoomCreated", handleRoomCreated);
    connection.on("RoomJoined", handleRoomJoined);
    connection.on("PlayerJoined", handlePlayerJoined);
    connection.on("PlayerLeft", handlePlayerLeft);
    connection.on("HostChanged", handleHostChanged);

    return () => {
      connection.off("ReceiveCanvasHistory", handleCanvasHistory);
      connection.off("RoomCreated", handleRoomCreated);
      connection.off("RoomJoined", handleRoomJoined);
      connection.off("PlayerJoined", handlePlayerJoined);
      connection.off("PlayerLeft", handlePlayerLeft);
      connection.off("HostChanged", handleHostChanged);
    };
  }, [connection, username]);

  const clearPendingCanvasHistory = useCallback(() => {
    setPendingCanvasHistory(null);
  }, []);

  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("/hubs/drawing")
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    newConnection
      .start()
      .then(() => {
        console.log("SignalR Connected");
        setConnection(newConnection);
      })
      .catch((err) => console.error("SignalR Connection Error: ", err));

    return () => {
      newConnection.stop();
    };
  }, []);

  const createRoom = async (newUsername: string, newRoomCode: string) => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      setUsername(newUsername); // Set username before invoke so handlers can use it
      await connection.invoke("CreateRoom", newUsername, newRoomCode);
    }
  };

  const joinRoom = async (newUsername: string, newRoomCode: string) => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      setUsername(newUsername); // Set username before invoke so handlers can use it
      await connection.invoke("JoinRoom", newUsername, newRoomCode);
    }
  };

  const leaveRoom = async () => {
    if (
      connection?.state === signalR.HubConnectionState.Connected &&
      roomCode
    ) {
      await connection.invoke("LeaveRoom");
      setUsername(null);
      setRoomCode(null);
      setIsHost(false);
      setPlayers([]);
    }
  };

  const sendDrawingCommand = async (command: DrawingCommand) => {
    if (
      connection?.state === signalR.HubConnectionState.Connected &&
      roomCode
    ) {
      await connection.invoke("SendDrawingCommand", command, roomCode);
    }
  };

  const clearCanvas = async () => {
    if (
      connection?.state === signalR.HubConnectionState.Connected &&
      roomCode
    ) {
      await connection.invoke("ClearCanvas", roomCode);
    }
  };

  // Create subscription methods that return unsubscribe functions
  const onReceiveDrawingCommand = useCallback(
    (callback: DrawingCommandCallback) => {
      if (connection) {
        connection.on("ReceiveDrawingCommand", callback);
        return () => connection.off("ReceiveDrawingCommand", callback);
      }
      return () => {};
    },
    [connection]
  );

  const onReceiveCanvasHistory = useCallback(
    (callback: CanvasHistoryCallback) => {
      // Store the callback in ref for direct invocation
      historyListenerRef.current = callback;
      return () => {
        historyListenerRef.current = null;
      };
    },
    []
  );

  const onCanvasCleared = useCallback(
    (callback: ClearCanvasCallback) => {
      if (connection) {
        connection.on("CanvasCleared", callback);
        return () => connection.off("CanvasCleared", callback);
      }
      return () => {};
    },
    [connection]
  );

  const onPlayerJoined = useCallback(
    (callback: PlayerEventCallback) => {
      if (connection) {
        connection.on("PlayerJoined", callback);
        return () => connection.off("PlayerJoined", callback);
      }
      return () => {};
    },
    [connection]
  );

  const onPlayerLeft = useCallback(
    (callback: PlayerLeftCallback) => {
      if (connection) {
        connection.on("PlayerLeft", callback);
        return () => connection.off("PlayerLeft", callback);
      }
      return () => {};
    },
    [connection]
  );

  const onHostChanged = useCallback(
    (callback: HostChangedCallback) => {
      if (connection) {
        connection.on("HostChanged", callback);
        return () => connection.off("HostChanged", callback);
      }
      return () => {};
    },
    [connection]
  );

  const onError = useCallback(
    (callback: ErrorCallback) => {
      if (connection) {
        connection.on("Error", callback);
        return () => connection.off("Error", callback);
      }
      return () => {};
    },
    [connection]
  );

  return (
    <SignalRContext.Provider
      value={{
        connection,
        roomCode,
        username,
        isHost,
        players,
        pendingCanvasHistory,
        clearPendingCanvasHistory,
        createRoom,
        joinRoom,
        leaveRoom,
        sendDrawingCommand,
        clearCanvas,
        onReceiveDrawingCommand,
        onReceiveCanvasHistory,
        onCanvasCleared,
        onPlayerJoined,
        onPlayerLeft,
        onHostChanged,
        onError,
      }}
    >
      {children}
    </SignalRContext.Provider>
  );
};
