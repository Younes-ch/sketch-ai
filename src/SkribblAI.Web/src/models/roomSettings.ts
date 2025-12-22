export interface RoomSettings {
  maxPlayers: number;
  totalRounds: number;
  drawTimeSeconds: number;
  wordChoiceCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
}

export const defaultRoomSettings: RoomSettings = {
  maxPlayers: 8,
  totalRounds: 3,
  drawTimeSeconds: 80,
  wordChoiceCount: 3,
  difficulty: 'mixed',
};

// Allowed values for settings
export const ALLOWED_DRAW_TIMES = [15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 210, 240];
export const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 20;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 10;
export const MIN_WORD_CHOICES = 2;
export const MAX_WORD_CHOICES = 5;
