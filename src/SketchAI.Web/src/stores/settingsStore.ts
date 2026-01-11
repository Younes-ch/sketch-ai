import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ToolbarPosition {
  x: number;
  y: number;
}

interface SettingsStore {
  // Toolbar position (stored as relative percentage to allow responsiveness)
  toolbarPosition: ToolbarPosition | null; // null = default left position
  
  // Actions
  setToolbarPosition: (position: ToolbarPosition | null) => void;
  resetToolbarPosition: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      toolbarPosition: null,
      
      setToolbarPosition: (position) => set({ toolbarPosition: position }),
      resetToolbarPosition: () => set({ toolbarPosition: null }),
    }),
    {
      name: "sketch-ai-settings",
    }
  )
);
