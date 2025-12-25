import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { cn } from "@/lib/utils";

export default function WordHint() {
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const currentWord = useGameStore((s) => s.currentWord);
  const wordHint = useGameStore((s) => s.wordHint);
  const username = useRoomStore((s) => s.username);

  const isDrawer = currentDrawer?.username === username;
  const isDrawingPhase = phase === "drawing";

  // Show the actual word for the drawer, or the hint for guessers
  const rawDisplayText = isDrawer && currentWord ? currentWord : wordHint || "";

  // Replace spaces with multiple non-breaking spaces to make word boundaries visible
  const displayText = rawDisplayText.replace(/\s\s/g, "\u00A0\u00A0\u00A0");

  // Don't show if there's no word/hint to display
  if (!displayText && phase !== "drawing") {
    return null;
  }

  return (
    <div className="bg-background rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 text-center border-2 border-card-border shrink-0">
      <p className="text-white/60 text-xs sm:text-sm">
        {isDrawer ? "DRAW THIS:" : "GUESS THE WORD:"}
      </p>
      <p
        className={cn(
          "text-xl sm:text-2xl font-bold tracking-widest",
          isDrawer ? "text-success" : "text-accent"
        )}
      >
        {displayText || "_ _ _ _ _"}
      </p>
      {isDrawingPhase && !isDrawer && displayText && (
        <p className="text-white/40 text-xs mt-1">
          {displayText.replace(/\s/g, "").length} letters
        </p>
      )}
    </div>
  );
}
