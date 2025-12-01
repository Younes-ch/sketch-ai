import ColorPalette from "./ColorPalette";
import BrushSizeSelector from "./BrushSizeSelector";

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

export default function CanvasToolbar({
  currentColor,
  currentTool,
  currentWidth,
  brushSizes,
  onColorChange,
  onToolChange,
  onWidthChange,
  onClear,
}: CanvasToolbarProps) {
  const handleColorSelect = (color: string) => {
    onColorChange(color);
    if (currentTool === "eraser") {
      onToolChange("brush");
    }
  };

  return (
    <div className="mt-4 bg-[#0D1B2A] rounded-2xl p-3 border-4 border-[#2A3F54] w-full shrink-0">
      {/* Color Palette */}
      <ColorPalette
        currentColor={currentColor}
        currentTool={currentTool}
        onColorSelect={handleColorSelect}
      />

      {/* Tools Row */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* Tool Buttons */}
        <div className="flex items-center gap-1 bg-[#1B2838] rounded-xl p-2 border-2 border-[#2A3F54]">
          <button
            onClick={() => onToolChange("brush")}
            className="px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1"
            style={{
              backgroundColor:
                currentTool === "brush" ? "#4CAF50" : "transparent",
              color:
                currentTool === "brush" ? "white" : "rgba(255,255,255,0.6)",
            }}
          >
            <span>🖌️</span> Brush
          </button>
          <button
            onClick={() => onToolChange("eraser")}
            className="px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1"
            style={{
              backgroundColor:
                currentTool === "eraser" ? "#FF9800" : "transparent",
              color:
                currentTool === "eraser" ? "white" : "rgba(255,255,255,0.6)",
            }}
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
        <div className="flex items-center gap-2 bg-[#1B2838] rounded-xl p-2 border-2 border-[#2A3F54]">
          <span className="text-white/60 text-xs font-bold">CUSTOM</span>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => handleColorSelect(e.target.value)}
            className="w-8 h-8 rounded-md cursor-pointer border-2 border-[#2A3F54]"
          />
        </div>

        {/* Clear Button */}
        <button
          onClick={onClear}
          className="px-4 py-2.5 text-white rounded-xl font-bold cursor-pointer hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
          style={{ backgroundColor: "#F44336", border: "4px solid #D32F2F" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#E53935")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#F44336")
          }
        >
          <span>🗑️</span> Clear
        </button>
      </div>
    </div>
  );
}
