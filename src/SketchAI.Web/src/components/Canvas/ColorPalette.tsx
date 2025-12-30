import {
  COLOR_PALETTE,
  DRAWING_COLORS,
  BORDER_COLORS,
} from "@/constants/colors";
import { cn } from "@/lib/utils";
import type { ToolType } from "./CanvasToolbar";

interface ColorPaletteProps {
  currentColor: string;
  currentTool: ToolType;
  onColorSelect: (color: string) => void;
}

export default function ColorPalette({
  currentColor,
  currentTool,
  onColorSelect,
}: ColorPaletteProps) {
  return (
    <div className="flex flex-wrap justify-center gap-1 mb-3">
      {COLOR_PALETTE.map((color, index) => (
        <button
          key={index}
          onClick={() => onColorSelect(color)}
          className={cn(
            "w-7 h-7 rounded-md transition-all duration-150 hover:scale-110",
            currentColor === color && currentTool !== "eraser"
              ? "ring-2 ring-accent ring-offset-2 ring-offset-background scale-110"
              : "hover:ring-2 hover:ring-white/50"
          )}
          style={{
            backgroundColor: color,
            border:
              color === DRAWING_COLORS.WHITE
                ? BORDER_COLORS.WHITE_SWATCH
                : BORDER_COLORS.DEFAULT_SWATCH,
          }}
        />
      ))}
    </div>
  );
}
