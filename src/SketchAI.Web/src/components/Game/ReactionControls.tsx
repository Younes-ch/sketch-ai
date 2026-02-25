import type { ReactionType } from "@/models/reactions";

interface ReactionControlsProps {
  onReact: (type: ReactionType) => void;
  size?: "sm" | "md";
}

export function ReactionControls({
  onReact,
  size = "md",
}: ReactionControlsProps) {
  const btnCls =
    size === "sm" ? "px-1.5 py-0.5 text-xs gap-0.5" : "px-2 py-1 text-sm gap-1";
  return (
    <div className="absolute top-2 left-2 z-20 flex gap-1">
      <button
        aria-label="Like"
        onClick={() => onReact("like")}
        className={`bg-green-600/70 hover:bg-green-600/90 active:scale-90 text-white rounded-full flex items-center font-semibold transition-all shadow-md cursor-pointer backdrop-blur-sm ${btnCls}`}
      >
        👍
      </button>
      <button
        aria-label="Dislike"
        onClick={() => onReact("dislike")}
        className={`bg-red-600/70 hover:bg-red-600/90 active:scale-90 text-white rounded-full flex items-center font-semibold transition-all shadow-md cursor-pointer backdrop-blur-sm ${btnCls}`}
      >
        👎
      </button>
    </div>
  );
}
