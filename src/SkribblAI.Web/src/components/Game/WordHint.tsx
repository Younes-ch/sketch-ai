import { useSignalR } from "@/hooks/useSignalR";
import { cn } from "@/lib/utils";

export default function WordHint() {
  const { gameState, username } = useSignalR();

  const isDrawer = gameState.currentDrawer?.username === username;
  const isDrawingPhase = gameState.phase === "drawing";

  // Show the actual word for the drawer, or the hint for guessers
  const displayText =
    isDrawer && gameState.currentWord
      ? gameState.currentWord
      : gameState.wordHint || "";

  // Don't show if there's no word/hint to display
  if (!displayText && gameState.phase !== "drawing") {
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
