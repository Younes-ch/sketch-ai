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

  // Calculate word lengths for multi-word hints
  // Hint format: each letter is separated by a space, words are separated by extra spaces
  // e.g., "ice cream" becomes "_ _ _   _ _ _ _ _" (letters separated by " ", words by "   ")
  const getWordLengths = (): string => {
    const hintToUse = wordHint || "";
    if (!hintToUse.trim()) return "";

    // Split by 3+ consecutive spaces to find word boundaries
    // Each word's letters are separated by single spaces
    const wordParts = hintToUse.split(/\s{3,}/);
    if (wordParts.length === 0) return "";

    // Count the number of characters in each word (split by single space)
    const lengths = wordParts
      .map((part) => {
        // Each character is separated by space, so split and count non-empty entries
        const chars = part.split(" ").filter((c) => c.length > 0);
        return chars.length;
      })
      .filter((len) => len > 0);

    return lengths.join(" ");
  };

  const wordLengthsDisplay = getWordLengths();

  // Don't show if there's no word/hint to display
  if (!displayText && phase !== "drawing") {
    return null;
  }

  return (
    <div className="bg-background sm:rounded-xl p-2 sm:p-3 sm:mb-3 text-center sm:border-2 sm:border-card-border shrink-0 w-full">
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
      {isDrawingPhase && !isDrawer && wordLengthsDisplay && (
        <p className="text-white/40 text-xs mt-1">{`${wordLengthsDisplay}`}</p>
      )}
    </div>
  );
}
