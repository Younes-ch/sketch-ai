import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useAudio } from "@/hooks/useAudio";

interface WordSelectionProps {
  words: string[];
  timeLimit?: number;
}

export function WordSelection({ words, timeLimit = 15 }: WordSelectionProps) {
  const selectWord = useGameStore((s) => s.selectWord);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const username = useRoomStore((s) => s.username);
  const { play, stop } = useAudio();

  const [isSelecting, setIsSelecting] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const hasAutoSelectedRef = useRef(false);
  const lastPlayedSecondRef = useRef<number | null>(null);

  const isDrawer = currentDrawer?.username === username;
  const timeRemaining = Math.max(0, timeLimit - Math.floor(elapsed / 1000));

  // Countdown timer using elapsed time - also handles auto-select
  useEffect(() => {
    if (!isDrawer || words.length === 0) return;

    const interval = setInterval(() => {
      const newElapsed = Date.now() - startTime;
      setElapsed(newElapsed);

      // Check if time has run out and we need to auto-select
      const currentTimeRemaining = Math.max(
        0,
        timeLimit - Math.floor(newElapsed / 1000)
      );

      // Play countdown sound in the last 5 seconds
      if (
        currentTimeRemaining <= 5 &&
        currentTimeRemaining > 0 &&
        currentTimeRemaining !== lastPlayedSecondRef.current
      ) {
        lastPlayedSecondRef.current = currentTimeRemaining;
        play("countdown");
      }

      if (currentTimeRemaining === 0 && !hasAutoSelectedRef.current) {
        hasAutoSelectedRef.current = true;
        clearInterval(interval);
        const randomWord = words[Math.floor(Math.random() * words.length)];
        selectWord(randomWord).catch((error) => {
          logger.error("Failed to auto-select word", error);
          hasAutoSelectedRef.current = false;
        });
        stop("countdown");
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isDrawer, words, startTime, timeLimit, selectWord, play, stop]);
  // Only show if we're the drawer and have word choices
  if (!isDrawer || words.length === 0) {
    return null;
  }

  const handleSelectWord = async (word: string) => {
    if (isSelecting || hasAutoSelectedRef.current) return;

    setIsSelecting(true);
    try {
      await selectWord(word);
    } catch (error) {
      logger.error("Failed to select word", error);
      setIsSelecting(false);
    } finally {
      stop("countdown");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-2 text-white">
          Choose a Word
        </h2>

        {/* Timer display */}
        <div className="flex justify-center mb-4">
          <div
            className={cn(
              "px-4 py-2 rounded-lg font-mono font-bold text-2xl",
              timeRemaining <= 5
                ? "bg-danger text-white animate-pulse"
                : timeRemaining <= 10
                ? "bg-warning text-background"
                : "bg-success text-white"
            )}
          >
            {timeRemaining}s
          </div>
        </div>

        <p className="text-white/60 text-center mb-6">
          Pick a word to draw before time runs out!
        </p>

        <div className="space-y-3">
          {words.map((word, index) => (
            <button
              key={word}
              onClick={() => handleSelectWord(word)}
              disabled={isSelecting}
              className={cn(
                "w-full py-4 px-6 rounded-lg text-lg font-semibold transition-all duration-200 transform",
                isSelecting
                  ? "bg-card-border text-white/40 cursor-not-allowed"
                  : "bg-success text-white hover:bg-success-hover hover:scale-[1.02] active:scale-[0.98] border-2 border-success-dark"
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-sm text-white/60">{index + 1}.</span>
                <span>{word}</span>
                <span className="text-sm text-white/60">
                  {word.replace(/\s/g, "").length} letters
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="text-xs text-white/40 text-center mt-4">
          A random word will be selected if you don&apos;t choose in time
        </p>
      </div>
    </div>
  );
}
