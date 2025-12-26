import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";

interface ConfettiProps {
  trigger?: boolean;
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
}

export function useConfetti() {
  const fire = useCallback(
    (options?: {
      particleCount?: number;
      spread?: number;
      origin?: { x: number; y: number };
    }) => {
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
    []
  );

  const fireMultiple = useCallback(() => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
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

// Component wrapper for declarative usage
export function Confetti({ trigger = false, ...options }: ConfettiProps) {
  const { fire } = useConfetti();

  useEffect(() => {
    if (trigger) {
      fire(options);
    }
  }, [trigger, fire, options]);

  return null;
}
