import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { Point, DrawingCommand } from "@/models";
import { useCanvasStore } from "@/stores/canvasStore";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { DRAWING_COLORS } from "@/constants/colors";
import { CanvasToolbar, type ToolType } from "@/components/Canvas";

// Canvas dimensions - drawing commands use normalized coordinates (0-1)
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const CANVAS_ASPECT_RATIO = CANVAS_WIDTH / CANVAS_HEIGHT;

// Layout constraints
const TOOLBAR_RESERVED_HEIGHT = 160;
const MIN_CANVAS_WIDTH = 200;
const MIN_CANVAS_HEIGHT = 125;

// Clamp a point to canvas bounds to prevent out-of-bounds coordinates
const clampPoint = (point: Point): Point => ({
  x: Math.max(0, Math.min(CANVAS_WIDTH, point.x)),
  y: Math.max(0, Math.min(CANVAS_HEIGHT, point.y)),
});

// Normalize a point from canvas coordinates to 0-1 range for network transmission
const normalizePoint = (point: Point): Point => ({
  x: point.x / CANVAS_WIDTH,
  y: point.y / CANVAS_HEIGHT,
});

// Denormalize a point from 0-1 range to canvas coordinates for rendering
const denormalizePoint = (point: Point): Point => ({
  x: point.x * CANVAS_WIDTH,
  y: point.y * CANVAS_HEIGHT,
});

// Extract client coordinates from mouse or touch event
const getClientCoords = (
  e: React.MouseEvent | React.TouchEvent
): { clientX: number; clientY: number } | null => {
  if ("touches" in e) {
    if (e.touches.length === 0) return null;
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
};

interface DrawingCanvasProps {
  disabled?: boolean;
}

export default function DrawingCanvas({
  disabled = false,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const hasMovedRef = useRef(false); // Track if pointer moved since starting
  const lastPointRef = useRef<Point | null>(null);
  const [currentColor, setCurrentColor] = useState<string>(
    DRAWING_COLORS.DEFAULT
  );
  const [currentWidth, setCurrentWidth] = useState(8);
  const [currentTool, setCurrentTool] = useState<ToolType>("brush");
  const [displaySize, setDisplaySize] = useState({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  // Calculate display size to fit container while maintaining aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 16;
        const containerHeight =
          containerRef.current.offsetHeight - TOOLBAR_RESERVED_HEIGHT;

        let displayWidth = Math.min(containerWidth, CANVAS_WIDTH);
        let displayHeight = displayWidth / CANVAS_ASPECT_RATIO;

        // If height exceeds available space, scale based on height
        if (displayHeight > containerHeight && containerHeight > 100) {
          displayHeight = containerHeight;
          displayWidth = displayHeight * CANVAS_ASPECT_RATIO;
        }

        setDisplaySize({
          width: Math.max(displayWidth, MIN_CANVAS_WIDTH),
          height: Math.max(displayHeight, MIN_CANVAS_HEIGHT),
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const sendDrawingCommand = useCanvasStore((s) => s.sendDrawingCommand);
  const signalRClearCanvas = useCanvasStore((s) => s.clearCanvas);
  const onReceiveDrawingCommand = useCanvasStore(
    (s) => s.onReceiveDrawingCommand
  );
  const onReceiveCanvasHistory = useCanvasStore(
    (s) => s.onReceiveCanvasHistory
  );
  const onCanvasCleared = useCanvasStore((s) => s.onCanvasCleared);
  const pendingCanvasHistory = useCanvasStore((s) => s.pendingCanvasHistory);
  const clearPendingCanvasHistory = useCanvasStore(
    (s) => s.clearPendingCanvasHistory
  );

  // Get effective color (white for eraser)
  const getEffectiveColor = useCallback(() => {
    return currentTool === "eraser" ? DRAWING_COLORS.ERASER : currentColor;
  }, [currentTool, currentColor]);

  // Draw a command on the canvas (expects normalized coordinates from network)
  const drawCommand = useCallback(
    (command: DrawingCommand, isLocal = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.strokeStyle = command.color;
      ctx.lineWidth = command.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (command.type === "stroke" && command.points.length >= 1) {
        // Denormalize points from 0-1 to canvas coordinates if from network
        const points = isLocal
          ? command.points
          : command.points.map(denormalizePoint);

        ctx.beginPath();

        if (points.length === 1) {
          // Single point - draw a dot
          const point = points[0];
          ctx.arc(point.x, point.y, command.width / 2, 0, Math.PI * 2);
          ctx.fillStyle = command.color;
          ctx.fill();
        } else {
          // Multiple points - draw a stroke
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
      }
    },
    []
  );

  // Clear the entire canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Handle pending canvas history (for late joiners)
  useEffect(() => {
    if (pendingCanvasHistory && pendingCanvasHistory.length > 0) {
      logger.info(
        `Drawing pending canvas history: ${pendingCanvasHistory.length} commands`
      );
      pendingCanvasHistory.forEach((command) => {
        drawCommand(command);
      });
      clearPendingCanvasHistory();
    }
  }, [pendingCanvasHistory, drawCommand, clearPendingCanvasHistory]);

  // Initialize SignalR listeners
  useEffect(() => {
    // Subscribe to drawing commands from other clients
    const unsubDrawing = onReceiveDrawingCommand((command: DrawingCommand) => {
      drawCommand(command);
    });

    // Subscribe to canvas history (sent when late joiner joins)
    const unsubHistory = onReceiveCanvasHistory((history: DrawingCommand[]) => {
      logger.info(`Received canvas history with ${history.length} commands`);
      // Replay all commands to reconstruct the canvas
      history.forEach((command) => {
        drawCommand(command);
      });
    });

    // Subscribe to clear canvas events
    const unsubClear = onCanvasCleared(() => {
      clearCanvas();
    });

    return () => {
      unsubDrawing();
      unsubHistory();
      unsubClear();
    };
  }, [
    onReceiveDrawingCommand,
    onReceiveCanvasHistory,
    onCanvasCleared,
    drawCommand,
    clearCanvas,
  ]);

  // Convert client coordinates to canvas coordinates
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

  // Start drawing at a point
  const startDrawing = useCallback((point: Point) => {
    isDrawingRef.current = true;
    hasMovedRef.current = false;
    lastPointRef.current = point;
  }, []);

  // Stop drawing - draw a dot if we haven't moved (single tap)
  const stopDrawing = useCallback(() => {
    const point = lastPointRef.current;

    // If we started drawing but never moved, draw a dot
    if (isDrawingRef.current && !hasMovedRef.current && point) {
      const effectiveColor = getEffectiveColor();

      // Draw locally
      const localCommand: DrawingCommand = {
        type: "stroke",
        points: [point],
        color: effectiveColor,
        width: currentWidth,
      };
      drawCommand(localCommand, true);

      // Send to server
      const networkCommand: DrawingCommand = {
        type: "stroke",
        points: [normalizePoint(point)],
        color: effectiveColor,
        width: currentWidth,
      };
      sendDrawingCommand(networkCommand).catch((error) => {
        logger.error("Failed to send dot command", error);
      });
    }

    isDrawingRef.current = false;
    hasMovedRef.current = false;
    lastPointRef.current = null;
  }, [currentWidth, drawCommand, getEffectiveColor, sendDrawingCommand]);

  // Continue drawing to a new point
  const continueDrawing = useCallback(
    (currentPoint: Point) => {
      const lastPoint = lastPointRef.current;
      if (!lastPoint) return;

      hasMovedRef.current = true;
      const effectiveColor = getEffectiveColor();

      // Draw locally with canvas coordinates
      const localCommand: DrawingCommand = {
        type: "stroke",
        points: [lastPoint, currentPoint],
        color: effectiveColor,
        width: currentWidth,
      };
      drawCommand(localCommand, true);

      // Send normalized coordinates to server
      const networkCommand: DrawingCommand = {
        type: "stroke",
        points: [normalizePoint(lastPoint), normalizePoint(currentPoint)],
        color: effectiveColor,
        width: currentWidth,
      };

      sendDrawingCommand(networkCommand).catch((error) => {
        logger.error("Failed to send drawing command", error);
      });

      lastPointRef.current = currentPoint;
    },
    [currentWidth, drawCommand, getEffectiveColor, sendDrawingCommand]
  );

  // Unified pointer down handler
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      if ("touches" in e) e.preventDefault();

      const coords = getClientCoords(e);
      if (!coords) return;

      const point = getCanvasPoint(coords.clientX, coords.clientY);
      if (point) startDrawing(point);
    },
    [disabled, getCanvasPoint, startDrawing]
  );

  // Unified pointer move handler
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

  const getCursor = () => {
    if (disabled) return "not-allowed";
    return "crosshair";
  };

  // Memoize brush sizes to prevent unnecessary re-renders
  const brushSizes = useMemo(() => [4, 8, 14, 20, 30], []);

  // Memoize clear handler
  const handleClearMemo = useCallback(async () => {
    clearCanvas();
    try {
      await signalRClearCanvas();
    } catch (error) {
      logger.error("Failed to clear canvas", error);
    }
  }, [clearCanvas, signalRClearCanvas]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center w-full h-full"
    >
      {/* Canvas*/}
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
          "bg-white rounded-lg shadow-inner shrink-0 touch-none border-4 border-card-border",
          disabled && "opacity-90"
        )}
        style={{
          width: displaySize.width,
          height: displaySize.height,
          cursor: getCursor(),
        }}
      />

      {!disabled && (
        <CanvasToolbar
          currentColor={currentColor}
          currentTool={currentTool}
          currentWidth={currentWidth}
          brushSizes={brushSizes}
          onColorChange={setCurrentColor}
          onToolChange={setCurrentTool}
          onWidthChange={setCurrentWidth}
          onClear={handleClearMemo}
        />
      )}
    </div>
  );
}
