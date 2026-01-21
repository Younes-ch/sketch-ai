import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ColorPalette, BrushSizeSelector } from "@/components/Canvas";
import { MinusIcon } from "@/components/ui/Icons";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { FOCUSABLE_SELECTOR, type CanvasToolbarProps } from "./types";

function MobileToolbarComponent({
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

  // Focus trap when expanded
  useEffect(() => {
    if (isExpanded) {
      // Save the previously focused element
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLElement) {
        previouslyFocusedRef.current = activeEl;
      }

      // Focus the first focusable element in the panel
      const panel = panelRef.current;
      if (panel) {
        const focusableElements =
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    } else {
      // Restore focus when closing
      if (
        previouslyFocusedRef.current &&
        document.contains(previouslyFocusedRef.current)
      ) {
        previouslyFocusedRef.current.focus();
        previouslyFocusedRef.current = null;
      }
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape
      if (e.key === "Escape") {
        setIsExpanded(false);
        return;
      }

      // Handle Tab cycling
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;

        const focusableElements =
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  return (
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
              className="fixed bottom-20 left-4 right-4 z-200 bg-background rounded-2xl p-4 border-4 border-card-border shadow-xl"
            >
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
                    onClick={() => {
                      onToolChange("brush");
                      setIsExpanded(false);
                    }}
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
                    onClick={() => {
                      onToolChange("eraser");
                      setIsExpanded(false);
                    }}
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
                    onClick={() => {
                      onToolChange("fill");
                      setIsExpanded(false);
                    }}
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
                  onSizeSelect={(width) => {
                    onWidthChange(width);
                    setIsExpanded(false);
                  }}
                />

                {/* Clear Button */}
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => {
                    onClear();
                    setIsExpanded(false);
                  }}
                  leftIcon={<span>🗑️</span>}
                >
                  Clear
                </Button>

                {/* Undo Button */}
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    onUndo();
                    setIsExpanded(false);
                  }}
                  disabled={!canUndo}
                  leftIcon={<span>↩️</span>}
                  className={cn(
                    canUndo
                      ? "bg-accent border-accent-dark hover:bg-accent/80"
                      : ""
                  )}
                >
                  Undo
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MobileToolbar = memo(MobileToolbarComponent);
export default MobileToolbar;
