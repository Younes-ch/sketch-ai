import { useEffect, useCallback, useRef } from "react";
import type { ToolType } from "../types";

interface UseCanvasKeyboardOptions {
  disabled: boolean;
  canUndo: boolean;
  onClear: () => void;
  onUndo: () => void;
  onToolChange: (tool: ToolType) => void;
}

export function useCanvasKeyboard({
  disabled,
  canUndo,
  onClear,
  onUndo,
  onToolChange,
}: UseCanvasKeyboardOptions) {
  const isUndoKeyPressedRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        onClear();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (e.repeat || isUndoKeyPressedRef.current) {
          return;
        }
        isUndoKeyPressedRef.current = true;
        if (canUndo) {
          onUndo();
        }
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            onToolChange("brush");
            break;
          case "f":
            e.preventDefault();
            onToolChange("fill");
            break;
          case "e":
            e.preventDefault();
            onToolChange("eraser");
            break;
        }
      }
    },
    [onClear, onUndo, canUndo, onToolChange]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "z") {
      isUndoKeyPressedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (disabled) return;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [disabled, handleKeyDown, handleKeyUp]);
}
