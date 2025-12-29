import { cn } from "@/lib/utils";
import { DRAWING_COLORS, BORDER_COLORS } from "@/constants/colors";

interface BrushSizeSelectorProps {
  sizes: number[];
  currentSize: number;
  currentColor: string;
  currentTool: "brush" | "eraser";
  onSizeSelect: (size: number) => void;
}

export default function BrushSizeSelector({
  sizes,
  currentSize,
  currentColor,
  currentTool,
  onSizeSelect,
}: BrushSizeSelectorProps) {
  return (
    <div className="flex items-center gap-2 bg-card rounded-xl p-2 border-2 border-card-border">
      <span className="text-white/60 text-xs font-bold mr-1">SIZE</span>
      {sizes.map((size) => (
        <button
          key={size}
          onClick={() => onSizeSelect(size)}
          className={cn(
            "rounded-full transition-all duration-150 hover:bg-accent",
            currentSize === size && "ring-2 ring-accent"
          )}
          style={{
            width: Math.min(size + 8, 32),
            height: Math.min(size + 8, 32),
            backgroundColor:
              currentTool === "eraser" ? DRAWING_COLORS.ERASER : currentColor,
            border: BORDER_COLORS.BRUSH_SIZE,
          }}
        />
      ))}
    </div>
  );
}
