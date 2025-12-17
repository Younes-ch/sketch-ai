import { create } from "zustand";
import type { GameState, Player } from "@/models";
import { initialGameState } from "@/models";
import { logger } from "@/lib/logger";
import { useConnectionStore } from "./connectionStore";
import { useRoomStore } from "./roomStore";
import { useChatStore } from "./chatStore";

interface GameStore extends GameState {
  playersWhoGuessed: Set<string>;
  roundStartedAt: Date | null;

  // Actions
  setGameState: (state: Partial<GameState>) => void;
  setPlayersWhoGuessed: (players: Set<string>) => void;
  addPlayerWhoGuessed: (username: string) => void;
  setRoundStartedAt: (date: Date | null) => void;
  endRound: () => Promise<void>;

  // SignalR actions
  startGame: () => Promise<void>;
  selectWord: (word: string) => Promise<void>;
  sendGuess: (message: string) => Promise<void>;

  // Reset
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialGameState,
  playersWhoGuessed: new Set(),
  roundStartedAt: null,

  setGameState: (state) => set((prev) => ({ ...prev, ...state })),
  
  setPlayersWhoGuessed: (players) => set({ playersWhoGuessed: players }),
  
  addPlayerWhoGuessed: (username) =>
    set((state) => ({
      playersWhoGuessed: new Set([...state.playersWhoGuessed, username]),
    })),

  setRoundStartedAt: (date) => set({ roundStartedAt: date }),

  endRound: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;
    await connection.invoke("EndRound");
  },

  startGame: async () => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    await connection.invoke("StartGame");
  },

  selectWord: async (word) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    await connection.invoke("SelectWord", word);
  },

  sendGuess: async (message) => {
    const { connection, isConnected } = useConnectionStore.getState();
    if (!isConnected() || !connection) return;

    await connection.invoke("SendGuess", message);
  },

  reset: () =>
    set({
      ...initialGameState,
      playersWhoGuessed: new Set(),
      roundStartedAt: null,
    }),
}));

// Game state DTO type from server
interface GameStateDto {
  roomCode: string;
  phase: string;
  currentDrawerUsername: string;
  roundNumber: number;
  totalRounds: number;
  players: Player[];
  wordHint: string | null;
  roundStartedAt: string | null;
}

// Setup SignalR event handlers for game events
export function setupGameEventHandlers() {
  const connection = useConnectionStore.getState().connection;
  if (!connection) return () => {};

  const handleGameStarted = (gameStateDto: GameStateDto) => {
    logger.info(`Game started in room ${gameStateDto.roomCode}`);
    useRoomStore.getState().setPlayers(gameStateDto.players);
    
    const currentDrawer = gameStateDto.players.find(
      (p) => p.username === gameStateDto.currentDrawerUsername
    ) || null;

    useGameStore.getState().setGameState({
      phase: "wordSelection",
      currentDrawer,
      roundNumber: gameStateDto.roundNumber || 1,
      totalRounds: gameStateDto.totalRounds,
      wordHint: "",
      wordChoices: null,
      currentWord: null,
    });
  };

  const handleWordChoices = (words: string[]) => {
    logger.info(`Received word choices: ${words.length} words`);
    useGameStore.getState().setGameState({ wordChoices: words });
  };

  const handleDrawingStarted = (gameStateDto: GameStateDto) => {
    logger.info(`Drawing started, hint: ${gameStateDto.wordHint}`);
    useRoomStore.getState().setPlayers(gameStateDto.players);
    
    // Reset players who guessed for the new round
    useGameStore.getState().setPlayersWhoGuessed(new Set());

    // Set round started time for timer calculation
    const roundStartedAt = gameStateDto.roundStartedAt
      ? new Date(gameStateDto.roundStartedAt)
      : new Date();
    useGameStore.getState().setRoundStartedAt(roundStartedAt);

    const currentDrawer = gameStateDto.players.find(
      (p) => p.username === gameStateDto.currentDrawerUsername
    ) || null;

    useGameStore.getState().setGameState({
      phase: "drawing",
      currentDrawer,
      wordHint: gameStateDto.wordHint || "",
      wordChoices: null,
      roundNumber: gameStateDto.roundNumber,
      totalRounds: gameStateDto.totalRounds,
      timeRemaining: 80,
    });
  };

  const handleYourWord = (word: string) => {
    logger.info(`You are drawing: ${word}`);
    useGameStore.getState().setGameState({
      currentWord: word,
      wordChoices: null,
    });
  };

  const handlePlayerGuessedCorrectly = (guesserUsername: string) => {
    logger.info(`${guesserUsername} guessed correctly!`);
    useGameStore.getState().addPlayerWhoGuessed(guesserUsername);
    
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `${guesserUsername} guessed the word!`,
      timestamp: new Date(),
      type: "correct-guess",
    });
  };

  const handleScoresUpdated = (updatedPlayers: Player[]) => {
    logger.info("Scores updated");
    useRoomStore.getState().setPlayers(updatedPlayers);
  };

  const handleRoundEnded = (data: { gameState: GameStateDto; word: string }) => {
    logger.info(`Round ended, word was: ${data.word}`);
    useRoomStore.getState().setPlayers(data.gameState.players);
    useGameStore.getState().setRoundStartedAt(null);
    
    useGameStore.getState().setGameState({
      phase: "roundEnd",
      currentWord: data.word,
      wordHint: data.word,
      wordChoices: null,
      timeRemaining: 0,
    });

    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `The word was: ${data.word}`,
      timestamp: new Date(),
      type: "system",
    });
  };

  const handleHintUpdated = (newHint: string) => {
    logger.info(`Hint updated: ${newHint}`);
    useGameStore.getState().setGameState({ wordHint: newHint });
  };

  const handleNextTurnStarted = (gameStateDto: GameStateDto) => {
    logger.info(`Next turn started, drawer: ${gameStateDto.currentDrawerUsername}`);
    useRoomStore.getState().setPlayers(gameStateDto.players);
    useGameStore.getState().setPlayersWhoGuessed(new Set());
    useChatStore.getState().reset();

    const currentDrawer = gameStateDto.players.find(
      (p) => p.username === gameStateDto.currentDrawerUsername
    ) || null;

    useGameStore.getState().setGameState({
      phase: "wordSelection",
      currentDrawer,
      roundNumber: gameStateDto.roundNumber,
      totalRounds: gameStateDto.totalRounds,
      wordHint: "",
      wordChoices: null,
      currentWord: null,
      timeRemaining: 80,
    });
  };

  const handleGameEnded = (data: { players: Player[], winnerUsernames: string[] }) => {
    logger.info("Game ended! Winners:", data.winnerUsernames.join(", "));
    useRoomStore.getState().setPlayers(data.players);
    
    useGameStore.getState().setGameState({
      phase: "gameEnd",
      currentWord: null,
      wordHint: "",
      wordChoices: null,
      timeRemaining: 0,
    });
  };

  const handleDrawerLeft = (drawerUsername: string) => {
    logger.info(`Drawer ${drawerUsername} left, waiting for next turn...`);
    
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      username: "System",
      message: `${drawerUsername} left. Moving to next turn...`,
      timestamp: new Date(),
      type: "system",
    });

    // Set a transitional state while waiting for next turn
    useGameStore.getState().setGameState({
      phase: "roundEnd",
      wordChoices: null,
      currentWord: null,
      timeRemaining: 0,
    });
  };

  connection.on("GameStarted", handleGameStarted);
  connection.on("WordChoices", handleWordChoices);
  connection.on("DrawingStarted", handleDrawingStarted);
  connection.on("YourWord", handleYourWord);
  connection.on("PlayerGuessedCorrectly", handlePlayerGuessedCorrectly);
  connection.on("ScoresUpdated", handleScoresUpdated);
  connection.on("RoundEnded", handleRoundEnded);
  connection.on("HintUpdated", handleHintUpdated);
  connection.on("NextTurnStarted", handleNextTurnStarted);
  connection.on("GameEnded", handleGameEnded);
  connection.on("DrawerLeft", handleDrawerLeft);

  return () => {
    connection.off("GameStarted", handleGameStarted);
    connection.off("WordChoices", handleWordChoices);
    connection.off("DrawingStarted", handleDrawingStarted);
    connection.off("YourWord", handleYourWord);
    connection.off("PlayerGuessedCorrectly", handlePlayerGuessedCorrectly);
    connection.off("ScoresUpdated", handleScoresUpdated);
    connection.off("RoundEnded", handleRoundEnded);
    connection.off("HintUpdated", handleHintUpdated);
    connection.off("NextTurnStarted", handleNextTurnStarted);
    connection.off("GameEnded", handleGameEnded);
    connection.off("DrawerLeft", handleDrawerLeft);
  };
}
