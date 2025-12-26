import { useState, memo } from "react";
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

  const handleColorSelect = (color: string) => {
    onColorChange(color);
    if (currentTool === "eraser") {
      onToolChange("brush");
    }
  };

  // Mobile FAB and collapsible toolbar
  const MobileToolbar = () => (
    <div className="lg:hidden">
      {/* Floating Action Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
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
