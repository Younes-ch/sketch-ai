import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  COLOR_PALETTE,
  DRAWING_COLORS,
  BORDER_COLORS,
} from "@/constants/colors";

export type ToolType = "brush" | "eraser" | "fill";

interface VerticalToolbarProps {
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
  isDragging?: boolean;
}

// Helper component for tool buttons
function ToolButton({
  active,
  onClick,
  label,
  shortcut,
  activeColor = "bg-success",
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut: string;
  activeColor?: string;
  children: React.ReactNode;
}) {
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

// Helper component for action buttons
function ActionButton({
  onClick,
  disabled,
  variant,
  icon,
  label,
  shortcut,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant: "danger" | "accent";
  icon: string;
  label: string;
  shortcut?: string;
}) {
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

// Color Picker with popover for medium screens, inline grid for large screens
function ColorPicker({
  currentColor,
  currentTool,
  onColorSelect,
}: {
  currentColor: string;
  currentTool: ToolType;
  onColorSelect: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleColorClick = (color: string) => {
    onColorSelect(color);
    setIsOpen(false);
  };

  const displayColor =
    currentTool === "eraser" ? DRAWING_COLORS.WHITE : currentColor;

  return (
    <>
      {/* Popover mode for medium screens (lg to xl) */}
      <div ref={containerRef} className="relative xl:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-10 h-10 rounded-lg shadow-md transition-all duration-150 hover:scale-105 cursor-pointer",
            isOpen && "ring-2 ring-accent ring-offset-2 ring-offset-background"
          )}
          style={{
            backgroundColor: displayColor,
            border:
              displayColor === DRAWING_COLORS.WHITE
                ? BORDER_COLORS.WHITE_SWATCH
                : "3px solid rgba(0,0,0,0.3)",
          }}
          aria-label="Select color"
          aria-expanded={isOpen}
          aria-haspopup="true"
        />

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute left-full top-0 ml-2 z-50"
            >
              <div className="bg-background/95 backdrop-blur-sm rounded-xl p-3 border-2 border-card-border shadow-xl">
                <div className="grid grid-cols-12 gap-1 mb-2">
                  {COLOR_PALETTE.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => handleColorClick(color)}
                      className={cn(
                        "w-6 h-6 rounded-md transition-all duration-100 hover:scale-110 cursor-pointer",
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
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-card-border">
                  <span className="text-white/60 text-xs font-bold">
                    CUSTOM
                  </span>
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => handleColorClick(e.target.value)}
                    className="w-8 h-6 rounded cursor-pointer border-2 border-card-border"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inline grid mode for large screens (xl+) - 2 columns */}
      <div className="hidden xl:block">
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
                    ? "1px solid #555"
                    : "1px solid rgba(0,0,0,0.3)",
              }}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
        {/* Custom color at the bottom */}
        <div className="mt-2 pt-2 border-t border-card-border">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onColorSelect(e.target.value)}
            className="w-full h-6 rounded cursor-pointer border-2 border-card-border"
            title="Custom color"
          />
        </div>
      </div>
    </>
  );
}

function VerticalToolbarComponent({
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
  isDragging = false,
}: VerticalToolbarProps) {
  const displayColor = currentTool === "eraser" ? "#FFFFFF" : currentColor;

  return (
    <div className="flex flex-col gap-2 p-2 bg-background/95 backdrop-blur-sm rounded-xl border-2 border-card-border shadow-lg max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-card-border scrollbar-track-transparent">
      {/* Drag Handle indicator - inside toolbar */}
      <div className="flex justify-center py-1 shrink-0">
        <div
          className={cn(
            "w-8 h-1 rounded-full transition-all duration-200",
            isDragging
              ? "bg-accent scale-110"
              : "bg-card-border hover:bg-accent/60"
          )}
        />
      </div>

      {/* Color Picker Section */}
      <ColorPicker
        currentColor={currentColor}
        currentTool={currentTool}
        onColorSelect={onColorChange}
      />

      {/* Divider */}
      <div className="h-px w-full bg-card-border shrink-0" />

      {/* Tool Buttons */}
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

      {/* Divider */}
      <div className="h-px w-full bg-card-border shrink-0" />

      {/* Size Selector */}
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

      {/* Divider */}
      <div className="h-px w-full bg-card-border shrink-0" />

      {/* Action Buttons */}
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

export const VerticalToolbar = memo(VerticalToolbarComponent);
