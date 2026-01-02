import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useAudio } from "@/hooks/useAudio";
import { TranslationModal } from "./TranslationModal";
import { Tooltip } from "@/components/ui/Tooltip";
import { LanguageDropdown } from "@/components/ui/LanguageDropdown";

// Default language preference key for localStorage
const LANGUAGE_PREF_KEY = "sketch-ai-language";
const DEFAULT_LANGUAGE = "English";

interface WordSelectionProps {
  words: string[];
  timeLimit?: number;
}

export function WordSelection({ words, timeLimit = 15 }: WordSelectionProps) {
  const selectWord = useGameStore((s) => s.selectWord);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const username = useRoomStore((s) => s.username);
  const { play, stop, pause, resume } = useAudio();

  // Translation state from store
  const getWordExplanation = useGameStore((s) => s.getWordExplanation);
  const clearWordExplanation = useGameStore((s) => s.clearWordExplanation);
  const wordExplanation = useGameStore((s) => s.wordExplanation);
  const isTranslating = useGameStore((s) => s.isTranslating);
  const translationError = useGameStore((s) => s.translationError);

  const [isSelecting, setIsSelecting] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const hasAutoSelectedRef = useRef(false);
  const lastPlayedSecondRef = useRef<number | null>(null);

  // Timer pause state
  const [translationPaused, setTranslationPaused] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LANGUAGE_PREF_KEY) || DEFAULT_LANGUAGE;
    }
    return DEFAULT_LANGUAGE;
  });
  const pauseStartTimeRef = useRef<number | null>(null);
  const totalPausedTimeRef = useRef(0);

  const isDrawer = currentDrawer?.username === username;

  // Calculate time remaining accounting for paused time
  const adjustedElapsed = translationPaused
    ? (pauseStartTimeRef.current ?? Date.now()) -
      startTime -
      totalPausedTimeRef.current
    : elapsed - totalPausedTimeRef.current;
  const timeRemaining = Math.max(
    0,
    timeLimit - Math.floor(adjustedElapsed / 1000)
  );

  // Save language preference
  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem(LANGUAGE_PREF_KEY, lang);
  };

  // Request translation from backend
  const handleTranslate = async (word: string) => {
    // Pause countdown audio when opening translation
    pause("countdown");

    // Pause the timer
    pauseStartTimeRef.current = Date.now();
    setTranslationPaused(true);

    try {
      await getWordExplanation(word, selectedLanguage);
    } catch (error) {
      logger.error("Failed to get word explanation", error);
      handleCloseTranslation();
    }
  };

  // Handle closing the translation modal
  const handleCloseTranslation = () => {
    // Calculate how long we were paused
    if (pauseStartTimeRef.current) {
      totalPausedTimeRef.current += Date.now() - pauseStartTimeRef.current;
    }
    pauseStartTimeRef.current = null;
    setTranslationPaused(false);
    clearWordExplanation();

    // Resume countdown audio from where it was paused
    resume("countdown");
  };

  // Sync pause state with translation state
  useEffect(() => {
    // If translation finished (error or success) but we haven't shown modal yet
    if (
      !isTranslating &&
      translationPaused &&
      !wordExplanation &&
      translationError
    ) {
      // Auto-close on error after a brief moment
      handleCloseTranslation();
    }
  }, [isTranslating, translationPaused, wordExplanation, translationError]);

  // Countdown timer using elapsed time - also handles auto-select
  useEffect(() => {
    if (!isDrawer || words.length === 0) return;

    const interval = setInterval(() => {
      // Don't update elapsed time while translation is open
      if (translationPaused) return;

      const newElapsed = Date.now() - startTime;
      setElapsed(newElapsed);

      // Check if time has run out and we need to auto-select
      const adjustedNewElapsed = newElapsed - totalPausedTimeRef.current;
      const currentTimeRemaining = Math.max(
        0,
        timeLimit - Math.floor(adjustedNewElapsed / 1000)
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
  }, [
    isDrawer,
    words,
    startTime,
    timeLimit,
    selectWord,
    play,
    stop,
    translationPaused,
  ]);

  // Only show if we're the drawer and have word choices
  if (!isDrawer || words.length === 0) {
    return null;
  }

  const handleSelectWord = async (word: string) => {
    if (isSelecting || hasAutoSelectedRef.current || translationPaused) return;

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
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-200">
        <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <h2 className="text-2xl font-bold text-center mb-2 text-white">
            Choose a Word
          </h2>

          {/* Timer display */}
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                "px-4 py-2 rounded-lg font-mono font-bold text-2xl",
                translationPaused
                  ? "bg-primary text-white"
                  : timeRemaining <= 5
                  ? "bg-danger text-white animate-pulse"
                  : timeRemaining <= 10
                  ? "bg-warning text-background"
                  : "bg-success text-white"
              )}
            >
              {translationPaused ? "⏸" : ""} {timeRemaining}s
            </div>
          </div>

          {/* Language selector - Custom Dropdown */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-white/60 text-sm">Translate to:</span>
            <LanguageDropdown
              value={selectedLanguage}
              onChange={handleLanguageChange}
            />
          </div>

          <p className="text-white/60 text-center mb-6">
            Pick a word to draw before time runs out!
          </p>

          <div className="space-y-3">
            {words.map((word, index) => (
              <div key={word} className="flex gap-2">
                <button
                  onClick={() => handleSelectWord(word)}
                  disabled={isSelecting || translationPaused}
                  className={cn(
                    "flex-1 py-4 px-6 rounded-lg text-lg font-semibold transition-all duration-200 transform",
                    isSelecting || translationPaused
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
                <Tooltip
                  content={`Translate "${word}" to ${selectedLanguage}`}
                  side="right"
                >
                  <button
                    onClick={() => handleTranslate(word)}
                    disabled={isTranslating}
                    className={cn(
                      "px-3 rounded-lg transition-all duration-200",
                      isTranslating
                        ? "bg-card-border text-white/40 cursor-not-allowed"
                        : "bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40"
                    )}
                  >
                    🌐
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>

          <p className="text-xs text-white/40 text-center mt-4">
            A random word will be selected if you don&apos;t choose in time
          </p>
        </div>
      </div>

      {/* Translation Modal */}
      <TranslationModal
        explanation={wordExplanation}
        isLoading={isTranslating}
        error={translationError}
        onClose={handleCloseTranslation}
      />
    </>
  );
}
