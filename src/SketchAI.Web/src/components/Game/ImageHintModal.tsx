import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui";
import { CloseIcon } from "@/components/ui/Icons";
import type { ImageHint } from "@/models/imageHint";

interface ImageHintModalProps {
  imageHint: ImageHint | null;
  isLoading: boolean;
  onClose: () => void;
}

export function ImageHintModal({
  imageHint,
  isLoading,
  onClose,
}: ImageHintModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Create a stable key based on the imageHint to reset states
  const imageHintKey = useMemo(
    () =>
      imageHint ? `${imageHint.word}-${imageHint.imageUrls.join(",")}` : null,
    [imageHint],
  );

  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Reset loaded/failed states when imageHint changes using derived state pattern
  if (imageHintKey !== lastKey) {
    setLastKey(imageHintKey);
    setLoadedImages(new Set());
    setFailedImages(new Set());
  }

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

  if (!isLoading && !imageHint) {
    return null;
  }

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set([...prev, index]));
  };

  const handleImageError = (index: number) => {
    setFailedImages((prev) => new Set([...prev, index]));
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-250 p-4"
      onClick={isLoading ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={imageHint ? "image-hint-title" : undefined}
      aria-label={isLoading ? "Loading image hints" : undefined}
    >
      <div
        ref={modalRef}
        className="bg-card border-2 border-primary/30 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💡</span>
            <h3 id="image-hint-title" className="text-xl font-bold text-white">
              Visual Hints
            </h3>
          </div>
          {!isLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/40 hover:text-white hover:bg-white/10 rounded-full p-1"
              aria-label="Close"
            >
              <CloseIcon size={20} />
            </Button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center py-12">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-primary/30 rounded-full" />
              <div className="absolute top-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-white/60 mt-6 text-lg">
              Finding visual inspiration...
            </p>
            <p className="text-white/40 mt-2 text-sm">This may take a moment</p>
          </div>
        )}

        {/* Success State - Image Grid */}
        {imageHint && !isLoading && (
          <>
            {/* Word being drawn */}
            <div className="bg-background/50 rounded-xl p-3 mb-5 text-center">
              <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
                Drawing Word
              </p>
              <p className="text-white font-bold text-2xl tracking-wide">
                {imageHint.word}
              </p>
              {imageHint.preset && (
                <p className="text-primary/70 text-xs mt-1">
                  Category: {imageHint.preset.replace(/-/g, " ")}
                </p>
              )}
            </div>

            {/* Images Grid */}
            <div className="grid grid-cols-3 gap-3">
              {imageHint.imageUrls.map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-square bg-background/50 rounded-xl overflow-hidden border border-white/10 group"
                >
                  {/* Loading skeleton */}
                  {!loadedImages.has(index) && !failedImages.has(index) && (
                    <div className="absolute inset-0 bg-linear-to-br from-white/5 to-white/10 animate-pulse flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Failed state */}
                  {failedImages.has(index) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                      <span className="text-2xl mb-1">🖼️</span>
                      <span className="text-xs">Failed to load</span>
                    </div>
                  )}

                  {/* Image */}
                  <img
                    src={url}
                    alt={`Visual hint ${index + 1} for ${imageHint.word}`}
                    className={`w-full h-full object-contain transition-all duration-300 ${
                      loadedImages.has(index)
                        ? "opacity-100 group-hover:scale-105"
                        : "opacity-0"
                    }`}
                    onLoad={() => handleImageLoad(index)}
                    onError={() => handleImageError(index)}
                  />

                  {/* Hover overlay */}
                  {loadedImages.has(index) && (
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  )}
                </div>
              ))}
            </div>

            {/* Hint text */}
            <p className="text-white/40 text-xs text-center mt-4">
              Use these images as inspiration for your drawing
            </p>

            {/* Close button */}
            <Button
              variant="success"
              size="lg"
              onClick={onClose}
              className="w-full mt-5"
            >
              Start Drawing!
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
