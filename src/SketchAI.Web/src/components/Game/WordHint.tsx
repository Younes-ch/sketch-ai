import { useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AISparklesIcon, InfoIcon, LightbulbIcon } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { TranslationModal } from "@/components/Game/TranslationModal";
import { ImageHintModal } from "@/components/Game/ImageHintModal";
import { DEFAULT_LANGUAGE, LANGUAGE_PREF_KEY } from "@/constants/languages";

export default function WordHint() {
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const currentWord = useGameStore((s) => s.currentWord);
  const wordHint = useGameStore((s) => s.wordHint);
  const getWordExplanation = useGameStore((s) => s.getWordExplanation);
  const isTranslating = useGameStore((s) => s.isTranslating);
  const wordExplanation = useGameStore((s) => s.wordExplanation);
  const translationError = useGameStore((s) => s.translationError);
  const clearWordExplanation = useGameStore((s) => s.clearWordExplanation);
  const getImageHints = useGameStore((s) => s.getImageHints);
  const isLoadingImageHints = useGameStore((s) => s.isLoadingImageHints);
  const imageHint = useGameStore((s) => s.imageHint);
  const clearImageHints = useGameStore((s) => s.clearImageHints);
  const username = useRoomStore((s) => s.username);
  const isAIDrawing = useCanvasStore((s) => s.isAIDrawing);
  const startAIDrawing = useCanvasStore((s) => s.startAIDrawing);
  const stopAIDrawing = useCanvasStore((s) => s.stopAIDrawing);

  const [isAIHovered, setIsAIHovered] = useState(false);
  const [isBulbHovered, setIsBulbHovered] = useState(false);

  const isDrawer = currentDrawer?.username === username;
  const isDrawingPhase = phase === "drawing";

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

  const handleAIClick = () => {
    if (isAIDrawing) {
      stopAIDrawing();
    } else {
      startAIDrawing();
    }
  };

  const handleInfoClick = () => {
    if (currentWord) {
      const targetLanguage =
        typeof window !== "undefined"
          ? localStorage.getItem(LANGUAGE_PREF_KEY) || DEFAULT_LANGUAGE
          : DEFAULT_LANGUAGE;
      getWordExplanation(currentWord, targetLanguage);
    }
  };

  const handleBulbClick = () => {
    if (currentWord && !isLoadingImageHints) {
      setIsBulbHovered(false);
      getImageHints(currentWord);
    }
  };

  if (!displayText && phase !== "drawing") {
    return null;
  }

  return (
    <div className="bg-background sm:rounded-lg p-1 sm:p-2 sm:mb-1 text-center sm:border-2 sm:border-card-border shrink-0 w-full relative">
      {/* AI Icons - Only visible for drawer during drawing phase */}
      {isDrawingPhase && isDrawer && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {/* AI Sparkles Icon */}
          <Tooltip
            content={isAIDrawing ? "Stop AI Drawing" : "AI Help - Draw for me"}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAIClick}
              onMouseEnter={() => setIsAIHovered(true)}
              onMouseLeave={() => setIsAIHovered(false)}
              className={cn(
                "p-1.5",
                isAIDrawing
                  ? "bg-danger text-white animate-pulse"
                  : isAIHovered
                  ? "bg-accent text-white"
                  : "text-white/40 hover:text-white/60"
              )}
              aria-label={isAIDrawing ? "Stop AI Drawing" : "Start AI Drawing"}
            >
              <AISparklesIcon size={20} />
            </Button>
          </Tooltip>

          {/* Lightbulb Icon - Visual Hints */}
          <Tooltip content="Get visual hints">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBulbClick}
              onMouseEnter={() => setIsBulbHovered(true)}
              onMouseLeave={() => setIsBulbHovered(false)}
              disabled={isLoadingImageHints}
              className={cn(
                "p-1.5",
                isLoadingImageHints
                  ? "text-warning/60 cursor-wait"
                  : isBulbHovered
                  ? "bg-warning/20 text-warning"
                  : "text-white/40 hover:text-warning/80"
              )}
              aria-label="Get visual hints"
            >
              {isLoadingImageHints ? (
                <div className="w-5 h-5 border-2 border-warning/40 border-t-warning rounded-full animate-spin" />
              ) : (
                <LightbulbIcon size={20} />
              )}
            </Button>
          </Tooltip>

          {/* Info Icon */}
          <Tooltip content="Get word explanation">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleInfoClick}
              disabled={isTranslating}
              className={cn(
                "p-1.5",
                isTranslating
                  ? "text-white/40 cursor-wait"
                  : "text-white/40 hover:bg-accent hover:text-white"
              )}
              aria-label="Get word explanation"
            >
              {isTranslating ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <InfoIcon size={20} />
              )}
            </Button>
          </Tooltip>
        </div>
      )}

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

      {/* Translation Modal */}
      <TranslationModal
        explanation={wordExplanation}
        isLoading={isTranslating}
        error={translationError}
        onClose={clearWordExplanation}
      />

      {/* Image Hints Modal */}
      <ImageHintModal
        imageHint={imageHint}
        isLoading={isLoadingImageHints}
        onClose={clearImageHints}
      />
    </div>
  );
}
