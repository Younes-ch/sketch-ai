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
  const undoPendingRef = useRef(false);

  const handleUndoWithDebounce = useCallback(async () => {
    if (undoPendingRef.current) return;

    undoPendingRef.current = true;
    try {
      await onUndo();
    } finally {
      setTimeout(() => {
        undoPendingRef.current = false;
      }, 150);
    }
  }, [onUndo]);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (canUndo) {
          handleUndoWithDebounce();
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClear, handleUndoWithDebounce, canUndo, onToolChange]);
}
