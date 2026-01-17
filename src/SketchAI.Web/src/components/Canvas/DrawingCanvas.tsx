import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import simplify from "simplify-js";
import type { Point, DrawingCommand } from "@/models";
import { useCanvasStore } from "@/stores/canvasStore";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  clampPoint,
  normalizePoint,
  getClientCoords,
  floodFill,
} from "@/lib/canvasUtils";
import { DRAWING_COLORS } from "@/constants/colors";
import { DesktopToolbar } from "./DesktopToolbar";
import MobileToolbar from "./MobileToolbar";
import type { ToolType } from "./types";
import {
  useCanvasRenderer,
  useSignalRCanvas,
  useCanvasKeyboard,
} from "./hooks";

interface DrawingCanvasProps {
  disabled?: boolean;
  layout?: "desktop" | "mobile";
}

const BATCH_INTERVAL_MS = 50;
const BRUSH_SIZES: number[] = [4, 8, 14, 20, 30];

function DrawingCanvasComponent({
  disabled = false,
  layout,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const pointBufferRef = useRef<Point[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentColorRef = useRef<string>(DRAWING_COLORS.DEFAULT);
  const strokeIdRef = useRef<string | null>(null);
  const commandHistoryRef = useRef<DrawingCommand[]>([]);

  const [currentColor, setCurrentColor] = useState<string>(
    DRAWING_COLORS.DEFAULT
  );
  const [currentWidth, setCurrentWidth] = useState(8);
  const [currentTool, setCurrentTool] = useState<ToolType>("brush");
  const [localStrokeCount, setLocalStrokeCount] = useState(0);
  const [displaySize, setDisplaySize] = useState({ width: 800, height: 600 });
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  const sendDrawingCommand = useCanvasStore((s) => s.sendDrawingCommand);
  const sendFillCommand = useCanvasStore((s) => s.sendFillCommand);
  const undoLastDrawCommand = useCanvasStore((s) => s.undoLastDrawCommand);
  const signalRClearCanvas = useCanvasStore((s) => s.clearCanvas);

  const brushSizes = useMemo(() => [...BRUSH_SIZES], []);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDisplaySize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    updateSize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktopViewport(mediaQuery.matches);

    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const { drawCommand, clearCanvas, replayHistoryAsync } = useCanvasRenderer({
    canvasRef,
  });

  useSignalRCanvas({
    drawCommand,
    clearCanvas,
    replayHistoryAsync,
    onLocalStrokeCountChange: setLocalStrokeCount,
    commandHistoryRef,
  });

  const getEffectiveColor = useCallback(() => {
    return currentTool === "eraser" ? DRAWING_COLORS.ERASER : currentColor;
  }, [currentTool, currentColor]);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;

      return clampPoint({
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      });
    },
    []
  );

  const sendBatchedCommand = useCallback(
    (points: Point[], effectiveColor: string) => {
      if (points.length < 2) return;

      const SIMPLIFY_TOLERANCE = 1.5;
      const SIMPLIFY_HIGH_QUALITY = true;
      const simplifiedPoints = simplify(
        points,
        SIMPLIFY_TOLERANCE,
        SIMPLIFY_HIGH_QUALITY
      ) as Point[];

      if (simplifiedPoints.length < 2) return;

      const networkCommand: DrawingCommand = {
        type: "stroke",
        points: simplifiedPoints.map(normalizePoint),
        color: effectiveColor,
        width: currentWidth,
        strokeId: strokeIdRef.current ?? undefined,
      };

      commandHistoryRef.current.push(networkCommand);

      sendDrawingCommand(networkCommand).catch((error) => {
        logger.error("Failed to send drawing command", error);
      });
    },
    [currentWidth, sendDrawingCommand]
  );

  const flushBatch = useCallback(() => {
    const points = pointBufferRef.current;
    const color = currentColorRef.current;

    if (points.length >= 2) {
      sendBatchedCommand(points, color);
    }

    if (points.length > 0) {
      pointBufferRef.current = [points[points.length - 1]];
    }
    batchTimerRef.current = null;
  }, [sendBatchedCommand]);

  const createAndSendCommand = useCallback(
    (points: Point[], effectiveColor: string) => {
      const localCommand: DrawingCommand = {
        type: "stroke",
        points: points,
        color: effectiveColor,
        width: currentWidth,
      };
      drawCommand(localCommand, true);

      if (points.length === 1) {
        const networkCommand: DrawingCommand = {
          type: "stroke",
          points: points.map(normalizePoint),
          color: effectiveColor,
          width: currentWidth,
          strokeId: strokeIdRef.current ?? undefined,
        };

        commandHistoryRef.current.push(networkCommand);

        sendDrawingCommand(networkCommand).catch((error) => {
          logger.error("Failed to send drawing command", error);
        });
      }
    },
    [currentWidth, drawCommand, sendDrawingCommand]
  );

  const startDrawing = useCallback(
    (point: Point) => {
      isDrawingRef.current = true;
      hasMovedRef.current = false;
      lastPointRef.current = point;
      pointBufferRef.current = [point];
      currentColorRef.current = getEffectiveColor();
      strokeIdRef.current = crypto.randomUUID();
    },
    [getEffectiveColor]
  );

  const continueDrawing = useCallback(
    (currentPoint: Point) => {
      const lastPoint = lastPointRef.current;
      if (!lastPoint) return;

      hasMovedRef.current = true;

      const localCommand: DrawingCommand = {
        type: "stroke",
        points: [lastPoint, currentPoint],
        color: getEffectiveColor(),
        width: currentWidth,
      };
      drawCommand(localCommand, true);

      pointBufferRef.current.push(currentPoint);
      lastPointRef.current = currentPoint;

      if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(flushBatch, BATCH_INTERVAL_MS);
      }
    },
    [currentWidth, drawCommand, flushBatch, getEffectiveColor]
  );

  const stopDrawing = useCallback(() => {
    const point = lastPointRef.current;

    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    const bufferedPoints = pointBufferRef.current;
    if (bufferedPoints.length >= 2) {
      sendBatchedCommand(bufferedPoints, currentColorRef.current);
    }

    if (isDrawingRef.current && !hasMovedRef.current && point) {
      createAndSendCommand([point], getEffectiveColor());
    }

    if (isDrawingRef.current) {
      setLocalStrokeCount((prev) => prev + 1);
    }

    isDrawingRef.current = false;
    hasMovedRef.current = false;
    lastPointRef.current = null;
    pointBufferRef.current = [];
    strokeIdRef.current = null;
  }, [createAndSendCommand, getEffectiveColor, sendBatchedCommand]);

  const handleFillClick = useCallback(
    (point: Point) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      floodFill(ctx, point.x, point.y, currentColor);

      const fillCommand: DrawingCommand = {
        type: "fill",
        points: [normalizePoint(point)],
        color: currentColor,
        width: 0,
      };

      commandHistoryRef.current.push(fillCommand);

      sendFillCommand(fillCommand).catch((error) => {
        logger.error("Failed to send fill command", error);
      });

      setLocalStrokeCount((prev) => prev + 1);
    },
    [currentColor, sendFillCommand]
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      if ("touches" in e) e.preventDefault();

      const coords = getClientCoords(e);
      if (!coords) return;

      const point = getCanvasPoint(coords.clientX, coords.clientY);
      if (!point) return;

      if (currentTool === "fill") {
        handleFillClick(point);
        return;
      }

      startDrawing(point);
    },
    [disabled, getCanvasPoint, startDrawing, currentTool, handleFillClick]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      if ("touches" in e) e.preventDefault();
      if (!isDrawingRef.current || !lastPointRef.current) return;

      const coords = getClientCoords(e);
      if (!coords) return;

      const point = getCanvasPoint(coords.clientX, coords.clientY);
      if (point) continueDrawing(point);
    },
    [disabled, getCanvasPoint, continueDrawing]
  );

  // Brush size scroll handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      setCurrentWidth((prevWidth) => {
        const currentIndex = brushSizes.indexOf(prevWidth);
        if (currentIndex === -1) return prevWidth;

        if (e.deltaY < 0 && currentIndex < brushSizes.length - 1) {
          return brushSizes[currentIndex + 1];
        } else if (e.deltaY > 0 && currentIndex > 0) {
          return brushSizes[currentIndex - 1];
        }
        return prevWidth;
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [brushSizes, disabled]);

  // Batch timer cleanup
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  const handleClear = useCallback(async () => {
    clearCanvas();
    setLocalStrokeCount(0);
    try {
      await signalRClearCanvas();
    } catch (error) {
      logger.error("Failed to clear canvas", error);
    }
  }, [clearCanvas, signalRClearCanvas]);

  const handleUndo = useCallback(async () => {
    try {
      await undoLastDrawCommand();
    } catch (error) {
      logger.error("Failed to undo", error);
    }
  }, [undoLastDrawCommand]);

  const isLayoutActive = useMemo(() => {
    if (!layout) return true;
    return layout === "desktop" ? isDesktopViewport : !isDesktopViewport;
  }, [layout, isDesktopViewport]);

  useCanvasKeyboard({
    disabled: disabled || !isLayoutActive,
    canUndo: localStrokeCount > 0,
    onClear: handleClear,
    onUndo: handleUndo,
    onToolChange: setCurrentTool,
  });

  const getCursor = () => (disabled ? "not-allowed" : "crosshair");

  const toolbarProps = {
    currentColor,
    currentTool,
    currentWidth,
    brushSizes,
    onColorChange: setCurrentColor,
    onToolChange: setCurrentTool,
    onWidthChange: setCurrentWidth,
    onClear: handleClear,
    onUndo: handleUndo,
    canUndo: localStrokeCount > 0,
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full gap-2">
      {!disabled && (
        <div className="hidden lg:flex flex-col justify-center h-full z-10 shrink-0 min-w-fit">
          <DesktopToolbar {...toolbarProps} />
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 h-full min-w-0 flex items-center justify-center relative touch-none"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          className={cn(
            "bg-white rounded-md shadow-inner border-2 border-card-border",
            disabled && "opacity-90"
          )}
          style={{
            width: displaySize.width,
            height: displaySize.height,
            cursor: getCursor(),
          }}
        />
      </div>

      {!disabled && (
        <div className="lg:hidden">
          <MobileToolbar {...toolbarProps} />
        </div>
      )}
    </div>
  );
}

const DrawingCanvas = memo(DrawingCanvasComponent);
export default DrawingCanvas;
