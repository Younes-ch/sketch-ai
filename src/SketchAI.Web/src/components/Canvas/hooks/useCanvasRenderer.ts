import { useCallback, useRef } from "react";
import type { DrawingCommand } from "@/models";
import { denormalizePoint, floodFill } from "@/lib/canvasUtils";

interface UseCanvasRendererOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useCanvasRenderer({ canvasRef }: UseCanvasRendererOptions) {
  const replayAbortRef = useRef<AbortController | null>(null);

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

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const replayHistoryAsync = useCallback(
    async (history: DrawingCommand[], onComplete?: () => void) => {
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
    [drawCommand]
  );

  return {
    drawCommand,
    clearCanvas,
    replayHistoryAsync,
  };
}
