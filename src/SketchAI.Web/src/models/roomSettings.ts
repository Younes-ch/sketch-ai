export interface RoomSettings {
  maxPlayers: number;
  totalRounds: number;
  drawTimeSeconds: number;
  wordChoiceCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  wordPreset?: string;
  customWords?: string;
}

export const defaultRoomSettings: RoomSettings = {
  maxPlayers: 8,
  totalRounds: 3,
  drawTimeSeconds: 80,
  wordChoiceCount: 3,
  difficulty: 'mixed',
  wordPreset: undefined,
  customWords: undefined,
};

// Word source types for UI
export type WordSourceType = 'difficulty' | 'preset' | 'custom';

// Available word presets with display names and emojis
export const WORD_PRESETS = [
  { id: 'lol-champions', name: 'LoL Champions', emoji: '⚔️' },
  { id: 'valorant-agents', name: 'VALORANT Agents', emoji: '🎯' },
  { id: 'animals', name: 'Animals', emoji: '🐾' },
  { id: 'country-flags', name: 'Country Flags', emoji: '🏳️' },
  { id: 'food-and-drinks', name: 'Food & Drinks', emoji: '🍕' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'professions', name: 'Professions', emoji: '👨‍💼' },
  { id: 'video-games', name: 'Video Games', emoji: '🎮' },
] as const;

// Allowed values for settings
export const ALLOWED_DRAW_TIMES = [15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 210, 240];
export const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 10;
export const MIN_WORD_CHOICES = 2;
export const MAX_WORD_CHOICES = 5;
export const MIN_CUSTOM_WORDS = 3;
export const MAX_CUSTOM_WORDS_LENGTH = 2000;
