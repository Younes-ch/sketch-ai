import { useState, memo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ColorPalette, BrushSizeSelector } from "@/components/Canvas";
import { MinusIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export type ToolType = "brush" | "eraser";

interface CanvasToolbarProps {
  currentColor: string;
  currentTool: ToolType;
  currentWidth: number;
  brushSizes: number[];
  onColorChange: (color: string) => void;
  onToolChange: (tool: ToolType) => void;
  onWidthChange: (width: number) => void;
  onClear: () => void;
}

function CanvasToolbarComponent({
  currentColor,
  currentTool,
  currentWidth,
  brushSizes,
  onColorChange,
  onToolChange,
  onWidthChange,
  onClear,
}: CanvasToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const handleColorSelect = useCallback(
    (color: string) => {
      onColorChange(color);
      if (currentTool === "eraser") {
        onToolChange("brush");
      }
      setIsExpanded(false);
    },
    [onColorChange, currentTool, onToolChange]
  );

  // Handle Escape key to close overlay
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Focus trap when expanded
  useEffect(() => {
    if (isExpanded) {
      // Save the previously focused element
      previouslyFocusedRef.current = document.activeElement as HTMLElement;

      // Focus the first focusable element in the panel
      const panel = panelRef.current;
      if (panel) {
        const focusableElements = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    } else {
      // Restore focus when closing
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
        previouslyFocusedRef.current = null;
      }
    }
  }, [isExpanded]);

  // Handle focus trap cycling
  useEffect(() => {
    if (!isExpanded) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusableElements = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, [isExpanded]);

  // Mobile FAB and collapsible toolbar
  const MobileToolbar = () => (
    <div className="lg:hidden">
      {/* Floating Action Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label="Open drawing tools"
        aria-expanded={isExpanded}
        className={cn(
          "fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          isExpanded ? "bg-card-border" : "bg-accent hover:bg-accent/80"
        )}
        style={{
          backgroundColor: isExpanded ? undefined : currentColor,
        }}
      >
        {isExpanded ? (
          <MinusIcon size={28} className="text-white" />
        ) : (
          <span className="text-2xl">🎨</span>
        )}
      </button>

      {/* Expanded Toolbar Overlay */}
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            key="toolbar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsExpanded(false)}
            />

            {/* Toolbar Panel */}
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed bottom-20 left-4 right-4 z-50 bg-background rounded-2xl p-4 border-4 border-card-border shadow-xl"
            >
              {/* Color Palette */}
              <ColorPalette
                currentColor={currentColor}
                currentTool={currentTool}
                onColorSelect={(color) => {
                  handleColorSelect(color);
                }}
              />

              {/* Tools Row */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {/* Tool Buttons */}
                <div className="flex items-center gap-1 bg-card rounded-xl p-2 border-2 border-card-border">
                  <button
                    onClick={() => onToolChange("brush")}
                    className={cn(
                      "px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1",
                      currentTool === "brush"
                        ? "bg-success text-white"
                        : "bg-transparent text-white/60"
                    )}
                  >
                    <span>🖌️</span> Brush
                  </button>
                  <button
                    onClick={() => onToolChange("eraser")}
                    className={cn(
                      "px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1",
                      currentTool === "eraser"
                        ? "bg-warning text-white"
                        : "bg-transparent text-white/60"
                    )}
                  >
                    <span>🧽</span> Eraser
                  </button>
                </div>

                {/* Brush Sizes */}
                <BrushSizeSelector
                  sizes={brushSizes}
                  currentSize={currentWidth}
                  currentColor={currentColor}
                  currentTool={currentTool}
                  onSizeSelect={onWidthChange}
                />

                {/* Clear Button */}
                <button
                  onClick={() => {
                    onClear();
                    setIsExpanded(false);
                  }}
                  className="px-4 py-2.5 text-white rounded-xl font-bold cursor-pointer hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 bg-danger border-4 border-danger-dark hover:bg-danger-hover"
                >
                  <span>🗑️</span> Clear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Desktop Toolbar (original)
  const DesktopToolbar = () => (
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
          <button
            onClick={() => onToolChange("brush")}
            className={cn(
              "px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1",
              currentTool === "brush"
                ? "bg-success text-white"
                : "bg-transparent text-white/60"
            )}
          >
            <span>🖌️</span> Brush
          </button>
          <button
            onClick={() => onToolChange("eraser")}
            className={cn(
              "px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1",
              currentTool === "eraser"
                ? "bg-warning text-white"
                : "bg-transparent text-white/60"
            )}
          >
            <span>🧽</span> Eraser
          </button>
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
        <button
          onClick={onClear}
          className="px-4 py-2.5 text-white rounded-xl font-bold cursor-pointer hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 bg-danger border-4 border-danger-dark hover:bg-danger-hover"
        >
          <span>🗑️</span> Clear
        </button>
      </div>
    </div>
  );

  return (
    <>
      <MobileToolbar />
      <DesktopToolbar />
    </>
  );
}

// Memoize the toolbar to prevent re-renders from parent timer updates
const CanvasToolbar = memo(CanvasToolbarComponent);
export default CanvasToolbar;
