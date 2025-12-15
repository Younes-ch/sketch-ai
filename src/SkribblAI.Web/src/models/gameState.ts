 import type { GamePhase } from "./gamePhase"; 
import type { Player } from "./player"; 
export interface GameState { 
  phase: GamePhase; 
  currentDrawer: Player | null; 
  currentWord: string | null;      // Only set for drawer 
  wordHint: string;                // "_ _ _ _ _" for guessers 
  wordChoices: string[] | null;    // 3 words for drawer to pick 
  roundNumber: number; 
  totalRounds: number; 
  timeRemaining: number; 
} 


export const initialGameState: GameState = { 
  phase: "lobby", 
  currentDrawer: null, 
  currentWord: null, 
  wordHint: "", 
  wordChoices: null, 
  roundNumber: 0, 
  totalRounds: 3, 
  timeRemaining: 0, 
}; 