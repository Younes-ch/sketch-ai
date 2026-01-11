import { memo, useCallback } from "react";
import { ColorPalette, BrushSizeSelector } from "@/components/Canvas";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CanvasToolbarProps } from "./types";

function DesktopToolbarComponent({
  currentColor,
  currentTool,
  currentWidth,
  brushSizes,
  onColorChange,
  onToolChange,
  onWidthChange,
  onClear,
  onUndo,
  canUndo,
}: CanvasToolbarProps) {
  const handleColorSelect = useCallback(
    (color: string) => {
      onColorChange(color);
      if (currentTool === "eraser") {
        onToolChange("brush");
      }
    },
    [onColorChange, currentTool, onToolChange]
  );

  return (
    <div className="hidden lg:block mt-4 bg-background rounded-2xl p-3 border-4 border-card-border w-full shrink-0">
      {/* Color Palette */}
      <ColorPalette
        currentColor={currentColor}
        currentTool={currentTool}
        onColorSelect={handleColorSelect}
      />

      {/* Tools Row */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* Tool Buttons */}
        <div className="flex items-center gap-1 bg-card rounded-xl p-2 border-2 border-card-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToolChange("brush")}
            className={cn(
              "rounded-lg font-bold text-sm",
              currentTool === "brush"
                ? "bg-success text-white"
                : "bg-transparent text-white/60"
            )}
            leftIcon={<span>🖌️</span>}
          >
            Brush
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToolChange("eraser")}
            className={cn(
              "rounded-lg font-bold text-sm",
              currentTool === "eraser"
                ? "bg-warning text-white"
                : "bg-transparent text-white/60"
            )}
            leftIcon={<span>🧽</span>}
          >
            Eraser
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToolChange("fill")}
            className={cn(
              "rounded-lg font-bold text-sm",
              currentTool === "fill"
                ? "bg-info text-white"
                : "bg-transparent text-white/60"
            )}
            leftIcon={<span>🪣</span>}
          >
            Fill
          </Button>
        </div>

        {/* Brush Sizes */}
        <BrushSizeSelector
          sizes={brushSizes}
          currentSize={currentWidth}
          currentColor={currentColor}
          currentTool={currentTool}
          onSizeSelect={onWidthChange}
        />

        {/* Custom Color Picker */}
        <div className="flex items-center gap-2 bg-card rounded-xl p-2 border-2 border-card-border">
          <span className="text-white/60 text-xs font-bold">CUSTOM</span>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => handleColorSelect(e.target.value)}
            className="w-8 h-8 rounded-md cursor-pointer border-2 border-card-border"
          />
        </div>

        {/* Clear Button */}
        <Button
          variant="danger"
          size="md"
          onClick={onClear}
          leftIcon={<span>🗑️</span>}
        >
          Clear
        </Button>

        {/* Undo Button */}
        <Button
          variant="secondary"
          size="md"
          onClick={onUndo}
          disabled={!canUndo}
          leftIcon={<span>↩️</span>}
          className={cn(
            canUndo ? "bg-accent border-accent-dark hover:bg-accent/80" : ""
          )}
        >
          Undo
        </Button>
      </div>
    </div>
  );
}

const DesktopToolbar = memo(DesktopToolbarComponent);
export default DesktopToolbar;
