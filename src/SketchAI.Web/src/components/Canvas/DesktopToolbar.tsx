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
        "w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all duration-150 cursor-pointer",
        active
          ? `${activeColor} scale-105 shadow-md`
          : "bg-card-border/50 hover:bg-card-border"
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
        "w-10 h-10 text-white rounded-lg font-bold text-lg cursor-pointer transition-all duration-150 flex items-center justify-center border-2",
        disabled
          ? "bg-card-border border-card-border opacity-50 cursor-not-allowed"
          : `${variantStyles[variant]} hover:-translate-y-0.5`
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
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-1">
        {COLOR_PALETTE.map((color, index) => (
          <button
            key={index}
            onClick={() => onColorSelect(color)}
            className={cn(
              "w-5 h-5 rounded transition-all duration-100 hover:scale-110 cursor-pointer",
              currentColor === color && currentTool !== "eraser"
                ? "ring-2 ring-accent ring-offset-1 ring-offset-background scale-110"
                : "hover:ring-1 hover:ring-white/50"
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
      <div className="pt-1 border-t border-card-border">
        <input
          type="color"
          value={currentColor}
          onChange={(e) => onColorSelect(e.target.value)}
          className="w-full h-6 rounded cursor-pointer border-2 border-card-border"
          title="Custom color"
        />
      </div>
    </div>
  );
}

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
  const displayColor = currentTool === "eraser" ? "#FFFFFF" : currentColor;

  return (
    <div className="flex flex-col gap-2 p-2 bg-background/95 backdrop-blur-sm rounded-xl border-2 border-card-border shadow-lg max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden custom-scrollbar">
      <ColorPicker
        currentColor={currentColor}
        currentTool={currentTool}
        onColorSelect={onColorChange}
      />

      <div className="h-px w-full bg-card-border shrink-0" />

      <div className="flex flex-col gap-1 shrink-0">
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

      <div className="h-px w-full bg-card-border shrink-0" />

      <div className="flex flex-col gap-1 shrink-0">
        {brushSizes.map((size) => {
          const dotSize = Math.max(6, Math.min(size / 2.5, 16));
          const isActive = currentWidth === size;

          return (
            <button
              key={size}
              onClick={() => onWidthChange(size)}
              className={cn(
                "w-10 h-8 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-card-border scale-105 ring-2 ring-accent ring-offset-1 ring-offset-background"
                  : "bg-card-border/30 hover:bg-card-border/60"
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
                    displayColor === "#FFFFFF"
                      ? "1px solid #555"
                      : "1px solid rgba(0,0,0,0.3)",
                }}
              />
            </button>
          );
        })}
      </div>

      <div className="h-px w-full bg-card-border shrink-0" />

      <div className="flex flex-col gap-1 shrink-0">
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

export const DesktopToolbar = memo(DesktopToolbarComponent);
