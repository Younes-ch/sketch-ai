import { useCallback, useRef } from "react";
import type { DrawingCommand, Point } from "@/models";
import { denormalizePoint, floodFill } from "@/lib/canvasUtils";

// Pen animation for AI strokes: canvas pixels per millisecond, clamped per stroke.
const PEN_SPEED_PX_PER_MS = 3;
const PEN_MIN_STROKE_MS = 150;
const PEN_MAX_STROKE_MS = 700;
const PEN_STEP_PX = 8;

// Split a polyline into ~PEN_STEP_PX segments so progress by index moves at constant speed.
const densify = (points: Point[]): Point[] => {
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / PEN_STEP_PX));
    for (let s = 1; s <= steps; s++) {
      result.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
  }
  return result;
};

interface UseCanvasRendererOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useCanvasRenderer({ canvasRef }: UseCanvasRendererOptions) {
  const replayAbortRef = useRef<AbortController | null>(null);
  const animationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const animationGenerationRef = useRef(0);

  const drawCommand = useCallback(
    (command: DrawingCommand, isLocal = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.strokeStyle = command.color;
      ctx.lineWidth = command.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (command.type === "stroke" && command.points.length >= 1) {
        const points = isLocal
          ? command.points
          : command.points.map(denormalizePoint);

        ctx.beginPath();

        if (points.length === 1) {
          const point = points[0];
          ctx.arc(point.x, point.y, command.width / 2, 0, Math.PI * 2);
          ctx.fillStyle = command.color;
          ctx.fill();
        } else {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
      } else if (command.type === "fill" && command.points.length === 1) {
        const point = isLocal
          ? command.points[0]
          : denormalizePoint(command.points[0]);
        floodFill(ctx, point.x, point.y, command.color);
      }
    },
    [canvasRef]
  );

  // Queue a remote command and draw strokes progressively like a pen. Commands run in arrival
  // order, so a fill never runs before the outline it fills has finished drawing.
  const animateCommand = useCallback(
    (command: DrawingCommand) => {
      const generation = animationGenerationRef.current;
      const isStale = () => generation !== animationGenerationRef.current;

      animationQueueRef.current = animationQueueRef.current.then(async () => {
        if (isStale()) return;
        if (command.type !== "stroke" || command.points.length < 2) {
          drawCommand(command);
          return;
        }

        const points = densify(command.points.map(denormalizePoint));
        const duration = Math.min(
          PEN_MAX_STROKE_MS,
          Math.max(PEN_MIN_STROKE_MS, (points.length * PEN_STEP_PX) / PEN_SPEED_PX_PER_MS)
        );
        const start = performance.now();
        let drawn = 0;

        while (drawn < points.length - 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          if (isStale()) return;
          const progress = Math.min(1, (performance.now() - start) / duration);
          const target = Math.max(drawn + 1, Math.round(progress * (points.length - 1)));
          drawCommand({ ...command, points: points.slice(drawn, target + 1) }, true);
          drawn = target;
        }
      });
    },
    [drawCommand]
  );

  // Drops queued/running animations; called whenever the canvas is wiped or redrawn from history.
  const cancelAnimations = useCallback(() => {
    animationGenerationRef.current++;
    animationQueueRef.current = Promise.resolve();
  }, []);

  const clearCanvas = useCallback(() => {
    cancelAnimations();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef, cancelAnimations]);

  const replayHistoryAsync = useCallback(
    async (history: DrawingCommand[], onComplete?: () => void) => {
      cancelAnimations();
      if (replayAbortRef.current) {
        replayAbortRef.current.abort();
      }

      const SYNC_THRESHOLD = 50;
      if (history.length <= SYNC_THRESHOLD) {
        history.forEach((cmd) => drawCommand(cmd));
        onComplete?.();
        return;
      }

      const abortController = new AbortController();
      replayAbortRef.current = abortController;

      const CHUNK_SIZE = 25;

      for (let i = 0; i < history.length; i += CHUNK_SIZE) {
        if (abortController.signal.aborted) {
          return;
        }

        const chunk = history.slice(i, i + CHUNK_SIZE);
        chunk.forEach((cmd) => drawCommand(cmd));

        if (i + CHUNK_SIZE < history.length) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      if (replayAbortRef.current === abortController) {
        replayAbortRef.current = null;
      }

      onComplete?.();
    },
    [drawCommand, cancelAnimations]
  );

  return {
    drawCommand,
    animateCommand,
    clearCanvas,
    replayHistoryAsync,
  };
}
