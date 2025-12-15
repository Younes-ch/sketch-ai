import {
  type Player,
  type GameState,
  type ChatMessage,
  type PublicRoom,
  type DrawingCommand,
  initialGameState,
} from "@/models";
import { logger } from "@/lib/logger";
import * as signalR from "@microsoft/signalr";
import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// Session storage key and type
const SESSION_STORAGE_KEY = "skribbl-session";

interface StoredSession {
  roomCode: string;
  username: string;
}

// Event callback types
type DrawingCommandCallback = (command: DrawingCommand) => void;
type CanvasHistoryCallback = (history: DrawingCommand[]) => void;
type ClearCanvasCallback = () => void;
type PlayerEventCallback = (player: Player) => void;
type PlayerLeftCallback = (username: string) => void;
type HostChangedCallback = (newHostUsername: string) => void;
type ErrorCallback = (message: string) => void;
type PublicRoomsCallback = (rooms: PublicRoom[]) => void;

export type ConnectionState = "Connected" | "Reconnecting" | "Disconnected";

// Session storage helpers
function getStoredSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredSession;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveSession(roomCode: string, username: string): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ roomCode, username })
  );
}

function clearStoredSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

interface SignalRContextType {
  connection: signalR.HubConnection | null;
  connectionState: ConnectionState;
  roomCode: string | null;
  username: string | null;
  isHost: boolean;
  players: Player[];
  isReconnecting: boolean;
  pendingCanvasHistory: DrawingCommand[] | null;
  gameState: GameState;
  chatMessages: ChatMessage[];
  clearPendingCanvasHistory: () => void;
  createRoom: (
    username: string,
    roomCode: string,
    isPublic?: boolean
  ) => Promise<void>;
  joinRoom: (username: string, roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  attemptReconnect: () => Promise<boolean>;
  getPublicRooms: () => Promise<void>;
  sendDrawingCommand: (command: DrawingCommand) => Promise<void>;
  clearCanvas: () => Promise<void>;
  // Game methods
  startGame: () => Promise<void>;
  selectWord: (word: string) => Promise<void>;
  sendGuess: (message: string) => Promise<void>;
  // Event subscription methods
  onReceiveDrawingCommand: (callback: DrawingCommandCallback) => () => void;
  onReceiveCanvasHistory: (callback: CanvasHistoryCallback) => () => void;
  onCanvasCleared: (callback: ClearCanvasCallback) => () => void;
  onPlayerJoined: (callback: PlayerEventCallback) => () => void;
  onPlayerLeft: (callback: PlayerLeftCallback) => () => void;
  onHostChanged: (callback: HostChangedCallback) => () => void;
  onError: (callback: ErrorCallback) => () => void;
  onReceivePublicRooms: (callback: PublicRoomsCallback) => () => void;
}

export const SignalRContext = createContext<SignalRContextType | null>(null);

export const SignalRProvider = ({ children }: { children: ReactNode }) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(
    null
  );
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("Disconnected");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [pendingCanvasHistory, setPendingCanvasHistory] = useState<
    DrawingCommand[] | null
  >(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [roundStartedAt, setRoundStartedAt] = useState<Date | null>(null);
  const lastRevealTimeRef = useRef<number | null>(null);

  // Use ref to track if ReceiveCanvasHistory listener is registered
  const historyListenerRef = useRef<CanvasHistoryCallback | null>(null);

  // Timer constants
  const ROUND_DURATION = 80; // seconds

  // Timer effect for drawing phase
  useEffect(() => {
    if (gameState.phase !== "drawing" || !roundStartedAt) {
      lastRevealTimeRef.current = null;
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor(
        (Date.now() - roundStartedAt.getTime()) / 1000
      );
      const remaining = Math.max(0, ROUND_DURATION - elapsed);

      setGameState((prev) => ({
        ...prev,
        timeRemaining: remaining,
      }));

      // Check if we should reveal a letter (at 60s, 40s, 20s remaining)
      // Only the drawer triggers the reveal to avoid multiple requests
      if (
        connection?.state === signalR.HubConnectionState.Connected &&
        gameState.currentDrawer?.username === username
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
    };

    // Update immediately
    updateTimer();

    // Then update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [
    gameState.phase,
    gameState.currentDrawer?.username,
    roundStartedAt,
    connection,
    username,
  ]);

  // Register server event listeners
  useEffect(() => {
    if (!connection) return;

    // Canvas history handler
    const handleCanvasHistory = (history: DrawingCommand[]) => {
      logger.info(`Received canvas history with ${history.length} commands`);
      if (historyListenerRef.current) {
        historyListenerRef.current(history);
      } else {
        setPendingCanvasHistory(history);
      }
    };

    // Room created handler (for host)
    const handleRoomCreated = (code: string, playerList: Player[]) => {
      logger.info(`Room ${code} created with ${playerList.length} players`);
      setRoomCode(code);
      setPlayers(playerList);
      setIsHost(true);
    };

    // Room joined handler (for joining players)
    const handleRoomJoined = (code: string, playerList: Player[]) => {
      logger.info(`Joined room ${code} with ${playerList.length} players`);
      setRoomCode(code);
      setPlayers(playerList);
      // Determine if current user is host from the player list
      const currentPlayer = playerList.find((p) => p.username === username);
      setIsHost(currentPlayer?.isHost ?? false);
    };

    // Player joined handler
    const handlePlayerJoined = (player: Player) => {
      logger.info(`Player ${player.username} joined`);
      setPlayers((prev) => [...prev, player]);
    };

    // Player left handler
    const handlePlayerLeft = (leftUsername: string) => {
      logger.info(`Player ${leftUsername} left`);
      setPlayers((prev) => prev.filter((p) => p.username !== leftUsername));
    };

    // Host changed handler
    const handleHostChanged = (newHostUsername: string) => {
      logger.info(`Host changed to ${newHostUsername}`);
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

    // Game started handler
    const handleGameStarted = (gameStateDto: {
      roomCode: string;
      phase: string;
      currentDrawerUsername: string;
      roundNumber: number;
      totalRounds: number;
      players: Player[];
      wordHint: string | null;
      roundStartedAt: string | null;
    }) => {
      logger.info(`Game started in room ${gameStateDto.roomCode}`);
      setPlayers(gameStateDto.players);
      setGameState((prev) => ({
        ...prev,
        phase: "wordSelection",
        currentDrawer:
          gameStateDto.players.find(
            (p) => p.username === gameStateDto.currentDrawerUsername
          ) || null,
        roundNumber: gameStateDto.roundNumber || 1,
        totalRounds: gameStateDto.totalRounds,
        wordHint: "",
        wordChoices: null,
        currentWord: null,
      }));
    };

    // Word choices handler (drawer only)
    const handleWordChoices = (words: string[]) => {
      logger.info(`Received word choices: ${words.length} words`);
      setGameState((prev) => ({
        ...prev,
        wordChoices: words,
      }));
    };

    // Drawing started handler
    const handleDrawingStarted = (gameStateDto: {
      roomCode: string;
      phase: string;
      currentDrawerUsername: string;
      roundNumber: number;
      totalRounds: number;
      players: Player[];
      wordHint: string | null;
      roundStartedAt: string | null;
    }) => {
      logger.info(`Drawing started, hint: ${gameStateDto.wordHint}`);
      setPlayers(gameStateDto.players);

      // Set round started time for timer calculation
      if (gameStateDto.roundStartedAt) {
        setRoundStartedAt(new Date(gameStateDto.roundStartedAt));
      } else {
        setRoundStartedAt(new Date());
      }

      setGameState((prev) => ({
        ...prev,
        phase: "drawing",
        currentDrawer:
          gameStateDto.players.find(
            (p) => p.username === gameStateDto.currentDrawerUsername
          ) || null,
        wordHint: gameStateDto.wordHint || "",
        wordChoices: null,
        roundNumber: gameStateDto.roundNumber,
        totalRounds: gameStateDto.totalRounds,
        timeRemaining: 80,
      }));
    };

    // Drawer's word handler
    const handleYourWord = (word: string) => {
      logger.info(`You are drawing: ${word}`);
      setGameState((prev) => ({
        ...prev,
        currentWord: word,
        wordChoices: null,
      }));
    };

    // Player guessed correctly handler
    const handlePlayerGuessedCorrectly = (guesserUsername: string) => {
      logger.info(`${guesserUsername} guessed correctly!`);
      const systemMessage: ChatMessage = {
        id: crypto.randomUUID(),
        username: "System",
        message: `${guesserUsername} guessed the word!`,
        timestamp: new Date(),
        type: "correct-guess",
      };
      setChatMessages((prev) => [...prev, systemMessage]);
    };

    // Scores updated handler
    const handleScoresUpdated = (updatedPlayers: Player[]) => {
      logger.info("Scores updated");
      setPlayers(updatedPlayers);
    };

    // Chat message handler
    const handleChatMessage = (msg: {
      username: string;
      message: string;
      timestamp: string;
    }) => {
      const chatMessage: ChatMessage = {
        id: crypto.randomUUID(),
        username: msg.username,
        message: msg.message,
        timestamp: new Date(msg.timestamp),
        type: "chat",
      };
      setChatMessages((prev) => [...prev, chatMessage]);
    };

    // Round ended handler
    const handleRoundEnded = (data: {
      gameState: {
        roomCode: string;
        phase: string;
        currentDrawerUsername: string;
        roundNumber: number;
        totalRounds: number;
        players: Player[];
        wordHint: string | null;
        roundStartedAt: string | null;
      };
      word: string;
    }) => {
      logger.info(`Round ended, word was: ${data.word}`);
      setPlayers(data.gameState.players);
      setRoundStartedAt(null); // Clear timer
      setGameState((prev) => ({
        ...prev,
        phase: "roundEnd",
        currentWord: data.word, // Reveal word to everyone
        wordHint: data.word,
        wordChoices: null,
        timeRemaining: 0,
      }));
      // Add system message revealing the word
      const systemMessage: ChatMessage = {
        id: crypto.randomUUID(),
        username: "System",
        message: `The word was: ${data.word}`,
        timestamp: new Date(),
        type: "system",
      };
      setChatMessages((prev) => [...prev, systemMessage]);
    };

    // Hint updated handler (when a letter is revealed)
    const handleHintUpdated = (newHint: string) => {
      logger.info(`Hint updated: ${newHint}`);
      setGameState((prev) => ({
        ...prev,
        wordHint: newHint,
      }));
    };

    connection.on("ReceiveCanvasHistory", handleCanvasHistory);
    connection.on("RoomCreated", handleRoomCreated);
    connection.on("RoomJoined", handleRoomJoined);
    connection.on("PlayerJoined", handlePlayerJoined);
    connection.on("PlayerLeft", handlePlayerLeft);
    connection.on("HostChanged", handleHostChanged);
    connection.on("GameStarted", handleGameStarted);
    connection.on("WordChoices", handleWordChoices);
    connection.on("DrawingStarted", handleDrawingStarted);
    connection.on("YourWord", handleYourWord);
    connection.on("PlayerGuessedCorrectly", handlePlayerGuessedCorrectly);
    connection.on("ScoresUpdated", handleScoresUpdated);
    connection.on("ChatMessage", handleChatMessage);
    connection.on("RoundEnded", handleRoundEnded);
    connection.on("HintUpdated", handleHintUpdated);

    return () => {
      connection.off("ReceiveCanvasHistory", handleCanvasHistory);
      connection.off("RoomCreated", handleRoomCreated);
      connection.off("RoomJoined", handleRoomJoined);
      connection.off("PlayerJoined", handlePlayerJoined);
      connection.off("PlayerLeft", handlePlayerLeft);
      connection.off("HostChanged", handleHostChanged);
      connection.off("GameStarted", handleGameStarted);
      connection.off("WordChoices", handleWordChoices);
      connection.off("DrawingStarted", handleDrawingStarted);
      connection.off("YourWord", handleYourWord);
      connection.off("PlayerGuessedCorrectly", handlePlayerGuessedCorrectly);
      connection.off("ScoresUpdated", handleScoresUpdated);
      connection.off("ChatMessage", handleChatMessage);
      connection.off("RoundEnded", handleRoundEnded);
      connection.off("HintUpdated", handleHintUpdated);
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

    // Connection state listeners
    newConnection.onreconnecting(() => {
      logger.info("SignalR Reconnecting...");
      setConnectionState("Reconnecting");
    });

    newConnection.onreconnected(() => {
      logger.info("SignalR Reconnected");
      setConnectionState("Connected");
    });

    newConnection.onclose(() => {
      logger.info("SignalR Disconnected");
      setConnectionState("Disconnected");
    });

    newConnection
      .start()
      .then(() => {
        logger.info("SignalR Connected");
        setConnectionState("Connected");
        setConnection(newConnection);
      })
      .catch((err) => {
        logger.error("SignalR Connection Error", err);
        setConnectionState("Disconnected");
      });

    return () => {
      newConnection.stop();
    };
  }, []);

  const createRoom = async (
    newUsername: string,
    newRoomCode: string,
    isPublic: boolean = false
  ) => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      setUsername(newUsername); // Set username before invoke so handlers can use it
      await connection.invoke("CreateRoom", newUsername, newRoomCode, isPublic);
      saveSession(newRoomCode, newUsername);
    }
  };

  const joinRoom = async (newUsername: string, newRoomCode: string) => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      setUsername(newUsername); // Set username before invoke so handlers can use it
      await connection.invoke("JoinRoom", newUsername, newRoomCode);
      saveSession(newRoomCode, newUsername);
    }
  };

  const leaveRoom = async () => {
    if (
      connection?.state === signalR.HubConnectionState.Connected &&
      roomCode
    ) {
      await connection.invoke("LeaveRoom");
      clearStoredSession();
      setUsername(null);
      setRoomCode(null);
      setIsHost(false);
      setPlayers([]);
      setGameState(initialGameState);
      setChatMessages([]);
      setRoundStartedAt(null);
      setPendingCanvasHistory(null);
    }
  };

  const attemptReconnect = useCallback(async (): Promise<boolean> => {
    const session = getStoredSession();
    if (!session) return false;

    if (connection?.state !== signalR.HubConnectionState.Connected) {
      return false;
    }

    setIsReconnecting(true);
    try {
      setUsername(session.username);
      await connection.invoke("JoinRoom", session.username, session.roomCode);
      // Session is still valid, keep it
      return true;
    } catch {
      // Room doesn't exist or other error - clear the stale session
      clearStoredSession();
      setUsername(null);
      return false;
    } finally {
      setIsReconnecting(false);
    }
  }, [connection]);

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

  const getPublicRooms = async () => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("GetPublicRooms");
    }
  };

  const startGame = async () => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("StartGame");
    }
  };

  const selectWord = async (word: string) => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("SelectWord", word);
    }
  };

  const sendGuess = async (message: string) => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      await connection.invoke("SendGuess", message);
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

  const onReceivePublicRooms = useCallback(
    (callback: PublicRoomsCallback) => {
      if (connection) {
        connection.on("ReceivePublicRooms", callback);
        return () => connection.off("ReceivePublicRooms", callback);
      }
      return () => {};
    },
    [connection]
  );

  return (
    <SignalRContext.Provider
      value={{
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
      }}
    >
      {children}
    </SignalRContext.Provider>
  );
};
