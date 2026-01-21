import { create } from "zustand";
import { persist } from "zustand/middleware";

// Sound names for type safety
export type SoundName =
  | "correct-guess"
  | "round-start"
  | "round-end"
  | "tick"
  | "player-join"
  | "player-leave"
  | "game-end"
  | "drum-roll"
  | "podium-reveal"
  | "close-guess"
  | "countdown";

interface AudioState {
  isMuted: boolean;
  volume: number;
}

interface AudioActions {
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
}

type AudioStore = AudioState & AudioActions;

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      isMuted: false,
      volume: 0.7,

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
      setMuted: (muted) => set({ isMuted: muted }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: "sketch-audio-settings",
      partialize: (state) => ({
        isMuted: state.isMuted,
        volume: state.volume,
      }),
    }
  )
);
