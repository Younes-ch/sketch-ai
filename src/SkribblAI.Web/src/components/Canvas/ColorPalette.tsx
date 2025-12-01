import { COLOR_PALETTE } from "@/constants/colors";

interface ColorPaletteProps {
  currentColor: string;
  currentTool: "brush" | "eraser";
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
          className={`w-7 h-7 rounded-md transition-all duration-150 hover:scale-110 ${
            currentColor === color && currentTool !== "eraser"
              ? "ring-2 ring-[#FFC71E] ring-offset-2 ring-offset-[#0D1B2A] scale-110"
              : "hover:ring-2 hover:ring-white/50"
          }`}
          style={{
            backgroundColor: color,
            border:
              color === "#FFFFFF"
                ? "2px solid #555"
                : "2px solid rgba(0,0,0,0.3)",
          }}
        />
      ))}
    </div>
  );
}
