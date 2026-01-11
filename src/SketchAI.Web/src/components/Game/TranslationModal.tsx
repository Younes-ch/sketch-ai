import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import type { WordExplanation } from "@/models/wordExplanation";

interface TranslationModalProps {
  explanation: WordExplanation | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export function TranslationModal({
  explanation,
  isLoading,
  error,
  onClose,
}: TranslationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isLoading, onClose]);

  if (!isLoading && !explanation && !error) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-250"
      onClick={isLoading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={explanation ? "translation-title" : undefined}
      aria-label={
        isLoading
          ? "Loading translation"
          : error
          ? "Translation error"
          : undefined
      }
    >
      <div
        ref={modalRef}
        className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="flex flex-col items-center py-8">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white/60">Translating...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-danger font-medium mb-2">Translation Failed</p>
            <p className="text-white/60 text-sm mb-4">{error}</p>
            <Button variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {explanation && !isLoading && !error && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3
                id="translation-title"
                className="text-xl font-bold text-white"
              >
                🌐 Translation
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-white/40 hover:text-white text-2xl leading-none"
                aria-label="close"
              >
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div className="bg-background/50 rounded-lg p-4">
                <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                  Word
                </p>
                <p className="text-white font-semibold text-lg">
                  {explanation.word}
                </p>
              </div>

              <div className="bg-primary/20 rounded-lg p-4 border border-primary/30">
                <p className="text-primary text-xs uppercase tracking-wide mb-1">
                  Translation ({explanation.targetLanguage})
                </p>
                <p className="text-white font-bold text-2xl">
                  {explanation.translation}
                </p>
              </div>

              <div className="bg-background/50 rounded-lg p-4">
                <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
                  Explanation
                </p>
                <p className="text-white/80">{explanation.simpleExplanation}</p>
              </div>
            </div>

            <Button
              variant="success"
              size="lg"
              onClick={onClose}
              className="w-full mt-4"
            >
              Got it!
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
