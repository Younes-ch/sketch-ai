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
    <div className="flex items-center gap-2 bg-[#1B2838] rounded-xl p-2 border-2 border-[#2A3F54]">
      <span className="text-white/60 text-xs font-bold mr-1">SIZE</span>
      {sizes.map((size) => (
        <button
          key={size}
          onClick={() => onSizeSelect(size)}
          className={`rounded-full transition-all duration-150 hover:bg-[#FFC71E] ${
            currentSize === size ? "ring-2 ring-[#FFC71E]" : ""
          }`}
          style={{
            width: Math.min(size + 8, 32),
            height: Math.min(size + 8, 32),
            backgroundColor:
              currentTool === "eraser" ? "#FFFFFF" : currentColor,
            border: "2px solid rgba(255,255,255,0.3)",
          }}
        />
      ))}
    </div>
  );
}
