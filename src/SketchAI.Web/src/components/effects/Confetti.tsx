import { useEffect, useMemo } from "react";
import { useConfetti } from "@/hooks/useConfetti";

interface ConfettiProps {
  trigger?: boolean;
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
}

// Component wrapper for declarative usage
export function Confetti({
  trigger = false,
  particleCount,
  spread,
  origin,
}: ConfettiProps) {
  const { fire } = useConfetti();

  // Memoize origin coordinates to stable primitives
  const originX = origin?.x;
  const originY = origin?.y;

  // Memoize options to prevent useEffect from triggering on every render
  const memoizedOptions = useMemo(
    () => ({
      ...(particleCount !== undefined && { particleCount }),
      ...(spread !== undefined && { spread }),
      ...(originX !== undefined &&
        originY !== undefined && {
          origin: { x: originX, y: originY },
        }),
    }),
    [particleCount, spread, originX, originY]
  );

  useEffect(() => {
    if (trigger) {
      fire(memoizedOptions);
    }
  }, [trigger, fire, memoizedOptions]);

  return null;
}
