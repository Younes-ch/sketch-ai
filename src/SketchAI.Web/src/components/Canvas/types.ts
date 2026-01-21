export type ToolType = "brush" | "eraser" | "fill";

export interface CanvasToolbarProps {
  currentColor: string;
  currentTool: ToolType;
  currentWidth: number;
  brushSizes: number[];
  onColorChange: (color: string) => void;
  onToolChange: (tool: ToolType) => void;
  onWidthChange: (width: number) => void;
  onClear: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
