import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ToolbarPosition = "left" | "bottom";

interface PreferencesState {
  toolbarPosition: ToolbarPosition;
}

interface PreferencesActions {
  setToolbarPosition: (position: ToolbarPosition) => void;
}

type PreferencesStore = PreferencesState & PreferencesActions;

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      toolbarPosition: "bottom",

      setToolbarPosition: (position) => set({ toolbarPosition: position }),
    }),
    {
      name: "sketch-preferences",
      partialize: (state) => ({
        toolbarPosition: state.toolbarPosition,
      }),
    }
  )
);
