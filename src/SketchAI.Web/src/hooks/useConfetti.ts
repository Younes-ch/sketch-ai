import { useCallback, useMemo } from "react";
import confetti from "canvas-confetti";

export function useConfetti() {
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const fire = useCallback(
    (options?: {
      particleCount?: number;
      spread?: number;
      origin?: { x: number; y: number };
    }) => {
      if (prefersReducedMotion) return;

      const defaults = {
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
      };

      confetti({
        ...defaults,
        ...options,
        colors: ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#a855f7"],
      });
    },
    [prefersReducedMotion]
  );

  const fireMultiple = useCallback(() => {
    const duration = 2000;
    const end = Date.now() + duration;
    let cancelled = false;

    const frame = () => {
      if (cancelled) return;

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#22c55e", "#3b82f6", "#eab308"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#ef4444", "#a855f7", "#f97316"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Cleanup function to stop the confetti
    return () => {
      cancelled = true;
    };
  }, []);

  const fireFromElement = useCallback(
    (element: HTMLElement | null, options?: { particleCount?: number }) => {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: options?.particleCount ?? 50,
        spread: 60,
        origin: { x, y },
        colors: ["#22c55e", "#3b82f6", "#eab308"],
      });
    },
    []
  );

  return { fire, fireMultiple, fireFromElement };
}
