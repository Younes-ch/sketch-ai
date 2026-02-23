import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  COLOR_PALETTE,
  DRAWING_COLORS,
  BORDER_COLORS,
} from "@/constants/colors";
import type { ToolType, CanvasToolbarProps } from "./types";

interface ToolButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut: string;
  activeColor?: string;
  children: React.ReactNode;
}

function ToolButton({
  active,
  onClick,
  label,
  shortcut,
  activeColor = "bg-success",
  children,
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all duration-150 cursor-pointer",
        active
          ? `${activeColor} scale-105 shadow-md`
          : "bg-card-border/50 hover:bg-card-border",
      )}
      aria-label={`${label} (${shortcut})`}
      title={`${label} (${shortcut})`}
    >
      {children}
    </button>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant: "danger" | "accent";
  icon: string;
  label: string;
  shortcut?: string;
}

function ActionButton({
  onClick,
  disabled,
  variant,
  icon,
  label,
  shortcut,
}: ActionButtonProps) {
  const variantStyles = {
    danger: "bg-danger border-danger-dark hover:bg-danger-hover",
    accent: "bg-accent border-accent-dark hover:bg-accent/80",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-9 h-9 text-white rounded-lg font-bold text-base cursor-pointer transition-all duration-150 flex items-center justify-center border-2",
        disabled
          ? "bg-card-border border-card-border opacity-50 cursor-not-allowed"
          : `${variantStyles[variant]} hover:-translate-y-0.5`,
      )}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {icon}
    </button>
  );
}

interface ColorPickerProps {
  currentColor: string;
  currentTool: ToolType;
  onColorSelect: (color: string) => void;
}

function ColorPicker({
  currentColor,
  currentTool,
  onColorSelect,
}: ColorPickerProps) {
  return (
    <div className="flex items-center gap-1">
      <div className="grid grid-rows-2 grid-flow-col gap-1">
        {COLOR_PALETTE.map((color, index) => (
          <button
            key={index}
            onClick={() => onColorSelect(color)}
            className={cn(
              "w-5 h-5 rounded transition-all duration-100 hover:scale-110 cursor-pointer",
              currentColor === color && currentTool !== "eraser"
                ? "ring-2 ring-accent ring-offset-1 ring-offset-background scale-110"
                : "hover:ring-1 hover:ring-white/50",
            )}
            style={{
              backgroundColor: color,
              border:
                color === DRAWING_COLORS.WHITE
                  ? BORDER_COLORS.WHITE_SWATCH
                  : BORDER_COLORS.DEFAULT_SWATCH,
            }}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>
      <input
        type="color"
        value={currentColor}
        onChange={(e) => onColorSelect(e.target.value)}
        className="w-6 h-10 rounded cursor-pointer border-2 border-card-border"
        title="Custom color"
      />
    </div>
  );
}

function BottomToolbarComponent({
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
  const displayColor = currentTool === "eraser" ? "#FFFFFF" : currentColor;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm rounded-xl border-2 border-card-border shadow-lg overflow-x-auto custom-scrollbar">
      {/* Colors */}
      <ColorPicker
        currentColor={currentColor}
        currentTool={currentTool}
        onColorSelect={onColorChange}
      />

      {/* Divider */}
      <div className="w-px h-10 bg-card-border shrink-0" />

      {/* Tools */}
      <div className="flex items-center gap-1 shrink-0">
        <ToolButton
          active={currentTool === "brush"}
          onClick={() => onToolChange("brush")}
          label="Brush"
          shortcut="B"
          activeColor="bg-success"
        >
          🖌️
        </ToolButton>
        <ToolButton
          active={currentTool === "eraser"}
          onClick={() => onToolChange("eraser")}
          label="Eraser"
          shortcut="E"
          activeColor="bg-warning"
        >
          🧽
        </ToolButton>
        <ToolButton
          active={currentTool === "fill"}
          onClick={() => onToolChange("fill")}
          label="Fill"
          shortcut="F"
          activeColor="bg-info"
        >
          🪣
        </ToolButton>
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-card-border shrink-0" />

      {/* Brush Sizes */}
      <div className="flex items-center gap-1 shrink-0">
        {brushSizes.map((size) => {
          const dotSize = Math.max(6, Math.min(size / 2.5, 16));
          const isActive = currentWidth === size;

          return (
            <button
              key={size}
              onClick={() => onWidthChange(size)}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-card-border scale-105 ring-2 ring-accent ring-offset-1 ring-offset-background"
                  : "bg-card-border/30 hover:bg-card-border/60",
              )}
              aria-label={`Brush size ${size}`}
              title={`Size ${size}`}
            >
              <div
                className="rounded-full"
                style={{
                  width: dotSize,
                  height: dotSize,
                  backgroundColor: displayColor,
                  border:
                    displayColor === DRAWING_COLORS.WHITE
                      ? BORDER_COLORS.WHITE_SWATCH
                      : BORDER_COLORS.DEFAULT_SWATCH,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-card-border shrink-0" />

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <ActionButton
          onClick={onClear}
          variant="danger"
          icon="🗑️"
          label="Clear"
        />
        <ActionButton
          onClick={onUndo}
          disabled={!canUndo}
          variant="accent"
          icon="↩️"
          label="Undo"
          shortcut="Ctrl+Z"
        />
      </div>
    </div>
  );
}

const BottomToolbar = memo(BottomToolbarComponent);
export default BottomToolbar;
