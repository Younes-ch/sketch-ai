import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import simplify from "simplify-js";
import type { Point, DrawingCommand } from "@/models";
import { useCanvasStore } from "@/stores/canvasStore";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_ASPECT_RATIO,
  clampPoint,
  normalizePoint,
  denormalizePoint,
  getClientCoords,
  floodFill,
} from "@/lib/canvasUtils";
import { DRAWING_COLORS } from "@/constants/colors";
import { CanvasToolbar, type ToolType } from "@/components/Canvas";

// Batching configuration for network optimization
// Points are accumulated and sent every BATCH_INTERVAL_MS to reduce network traffic
const BATCH_INTERVAL_MS = 50;

// Point simplification configuration (Douglas-Peucker + Radial Distance)
// Tolerance controls how aggressively points are removed (in canvas coordinates)
// Higher = more simplification, lower = more precision
const SIMPLIFY_TOLERANCE = 1.5;
const SIMPLIFY_HIGH_QUALITY = true; // Use Douglas-Peucker (slower but better quality)

// Layout constraints
const TOOLBAR_RESERVED_HEIGHT = 160;
const MIN_CANVAS_WIDTH = 200;
const MIN_CANVAS_HEIGHT = 125;

interface DrawingCanvasProps {
  disabled?: boolean;
}

function DrawingCanvasComponent({ disabled = false }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const hasMovedRef = useRef(false); // Track if pointer moved since starting
  const lastPointRef = useRef<Point | null>(null);

  // Batching refs for network optimization
  const pointBufferRef = useRef<Point[]>([]); // Accumulates points between batches
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentColorRef = useRef<string>(DRAWING_COLORS.DEFAULT); // Track color during batch
  
  // Local command history for undo functionality
  const commandHistoryRef = useRef<DrawingCommand[]>([]);

  const [currentColor, setCurrentColor] = useState<string>(
    DRAWING_COLORS.DEFAULT
  );
  const [currentWidth, setCurrentWidth] = useState(8);
  const [currentTool, setCurrentTool] = useState<ToolType>("brush");
  const [localStrokeCount, setLocalStrokeCount] = useState(0);  // Track local strokes for undo
  const [displaySize, setDisplaySize] = useState({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  // Calculate display size to fit container while maintaining aspect ratio
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth - 16;
        // On mobile (< 1024px), toolbar is a floating FAB, so don't reserve height
        const isMobile = window.innerWidth < 1024;
        const toolbarReserve = isMobile ? 0 : TOOLBAR_RESERVED_HEIGHT;
        const containerHeight =
          containerRef.current.offsetHeight - toolbarReserve;

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

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    updateSize();
    return () => observer.disconnect();
  }, []);

  const sendDrawingCommand = useCanvasStore((s) => s.sendDrawingCommand);
  const sendFillCommand = useCanvasStore((s) => s.sendFillCommand);
  const undoLastDrawCommand = useCanvasStore((s) => s.undoLastDrawCommand);
  const signalRClearCanvas = useCanvasStore((s) => s.clearCanvas);
  const onReceiveDrawingCommand = useCanvasStore(
    (s) => s.onReceiveDrawingCommand
  );
  const onReceiveCanvasHistory = useCanvasStore(
    (s) => s.onReceiveCanvasHistory
  );
  const onCanvasCleared = useCanvasStore((s) => s.onCanvasCleared);
  const onReceiveUndo = useCanvasStore((s) => s.onReceiveUndo);
  const onReceiveFillCommand = useCanvasStore((s) => s.onReceiveFillCommand);
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
      } else if (command.type === "fill" && command.points.length === 1) {
        // Execute flood fill at the specified point
        const point = isLocal
          ? command.points[0]
          : denormalizePoint(command.points[0]);
        floodFill(ctx, point.x, point.y, command.color);
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

  // Async chunked replay - prevents UI freeze by yielding between batches
  const replayHistoryAsync = useCallback(
    async (history: DrawingCommand[], onComplete?: () => void) => {
      const CHUNK_SIZE = 25; // Commands per frame
      
      for (let i = 0; i < history.length; i += CHUNK_SIZE) {
        const chunk = history.slice(i, i + CHUNK_SIZE);
        chunk.forEach((cmd) => drawCommand(cmd));
        
        // Yield to browser between chunks to prevent freeze
        if (i + CHUNK_SIZE < history.length) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
      
      onComplete?.();
    },
    [drawCommand]
  );

  // Handle pending canvas history (for late joiners)
  // Use a separate effect to ensure canvas is ready before drawing
  useEffect(() => {
    if (!pendingCanvasHistory || pendingCanvasHistory.length === 0) {
      return;
    }

    // Capture the history locally to avoid stale closure issues
    const historyToProcess = pendingCanvasHistory;

    const canvas = canvasRef.current;
    if (!canvas) {
      logger.warn("Canvas ref not ready for pending history, will retry...");
      // Schedule a retry on next frame when canvas should be ready
      const frameId = requestAnimationFrame(() => {
        const retryCanvas = canvasRef.current;
        if (retryCanvas) {
          logger.info(
            `Drawing pending canvas history (retry): ${historyToProcess.length} commands`
          );
          replayHistoryAsync(historyToProcess);
        }
      });
      clearPendingCanvasHistory();
      return () => cancelAnimationFrame(frameId);
    }

    logger.info(
      `Drawing pending canvas history: ${historyToProcess.length} commands`
    );
    replayHistoryAsync(historyToProcess);
    clearPendingCanvasHistory();
  }, [pendingCanvasHistory, replayHistoryAsync, clearPendingCanvasHistory]);

  // Initialize SignalR listeners
  useEffect(() => {
    // Subscribe to drawing commands from other clients
    const unsubDrawing = onReceiveDrawingCommand((command: DrawingCommand) => {
      commandHistoryRef.current.push(command);
      drawCommand(command);
    });

    // Subscribe to canvas history (sent when late joiner joins)
    const unsubHistory = onReceiveCanvasHistory((history: DrawingCommand[]) => {
      logger.info(`Received canvas history with ${history.length} commands`);
      // Replace local history with server history
      commandHistoryRef.current = [...history];
      // Replay all commands asynchronously to prevent UI freeze
      replayHistoryAsync(history);
    });

    // Subscribe to clear canvas events
    const unsubClear = onCanvasCleared(() => {
      clearCanvas();
      commandHistoryRef.current = [];
      setLocalStrokeCount(0);
    });

    // Subscribe to undo events - clear and replay without last command
    const unsubUndo = onReceiveUndo(() => {
      logger.info("Received undo command - replaying canvas");
      // Remove last command from local history
      if (commandHistoryRef.current.length > 0) {
        commandHistoryRef.current.pop();
      }
      // Clear canvas and replay remaining history asynchronously
      clearCanvas();
      replayHistoryAsync(commandHistoryRef.current);
      setLocalStrokeCount((prev) => Math.max(0, prev - 1));
    });

    // Subscribe to fill command events from other clients
    const unsubFill = onReceiveFillCommand((command: DrawingCommand) => {
      logger.info("Received fill command");
      commandHistoryRef.current.push(command);
      drawCommand(command);
    });

    return () => {
      unsubDrawing();
      unsubHistory();
      unsubClear();
      unsubUndo();
      unsubFill();
    };
  }, [
    onReceiveDrawingCommand,
    onReceiveCanvasHistory,
    onCanvasCleared,
    onReceiveUndo,
    onReceiveFillCommand,
    drawCommand,
    clearCanvas,
    replayHistoryAsync,
  ]);

  // Cleanup batch timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

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
  const startDrawing = useCallback(
    (point: Point) => {
      isDrawingRef.current = true;
      hasMovedRef.current = false;
      lastPointRef.current = point;
      // Initialize buffer with the starting point
      pointBufferRef.current = [point];
      currentColorRef.current = getEffectiveColor();
    },
    [getEffectiveColor]
  );

  // Helper to send batched points to the server (network only, no local drawing)
  const sendBatchedCommand = useCallback(
    (points: Point[], effectiveColor: string) => {
      if (points.length < 2) return;

      // Simplify points using Douglas-Peucker algorithm to reduce payload size
      // This removes redundant points while preserving the stroke's visual shape
      const simplifiedPoints = simplify(
        points,
        SIMPLIFY_TOLERANCE,
        SIMPLIFY_HIGH_QUALITY
      ) as Point[];

      // Only send if we have meaningful data after simplification
      if (simplifiedPoints.length < 2) return;

      // Send normalized coordinates to server
      const networkCommand: DrawingCommand = {
        type: "stroke",
        points: simplifiedPoints.map(normalizePoint),
        color: effectiveColor,
        width: currentWidth,
      };

      // Track in local history for undo
      commandHistoryRef.current.push(networkCommand);
      setLocalStrokeCount((prev) => prev + 1);

      sendDrawingCommand(networkCommand).catch((error) => {
        logger.error("Failed to send drawing command", error);
      });
    },
    [currentWidth, sendDrawingCommand]
  );

  // Flush the current batch of points to the network
  const flushBatch = useCallback(() => {
    const points = pointBufferRef.current;
    const color = currentColorRef.current;

    if (points.length >= 2) {
      sendBatchedCommand(points, color);
    }

    // Keep the last point for stroke continuity in the next batch
    if (points.length > 0) {
      pointBufferRef.current = [points[points.length - 1]];
    }
    batchTimerRef.current = null;
  }, [sendBatchedCommand]);

  // Helper to draw locally and queue for batched network send
  const createAndSendCommand = useCallback(
    (points: Point[], effectiveColor: string) => {
      // Draw locally with canvas coordinates (immediate for responsiveness)
      const localCommand: DrawingCommand = {
        type: "stroke",
        points: points,
        color: effectiveColor,
        width: currentWidth,
      };
      drawCommand(localCommand, true);

      // For single-point commands (dots), send immediately without batching
      if (points.length === 1) {
        const networkCommand: DrawingCommand = {
          type: "stroke",
          points: points.map(normalizePoint),
          color: effectiveColor,
          width: currentWidth,
        };
        
        // Track in local history for undo
        commandHistoryRef.current.push(networkCommand);
        setLocalStrokeCount((prev) => prev + 1);
        
        sendDrawingCommand(networkCommand).catch((error) => {
          logger.error("Failed to send drawing command", error);
        });
      }
      // Multi-point strokes are handled by the batching system
    },
    [currentWidth, drawCommand, sendDrawingCommand]
  );

  // Stop drawing - flush any remaining batched points
  const stopDrawing = useCallback(() => {
    const point = lastPointRef.current;

    // Flush any remaining batched points before stopping
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    // Send any remaining points in the buffer
    const bufferedPoints = pointBufferRef.current;
    if (bufferedPoints.length >= 2) {
      sendBatchedCommand(bufferedPoints, currentColorRef.current);
    }

    // If we started drawing but never moved, draw a dot
    if (isDrawingRef.current && !hasMovedRef.current && point) {
      createAndSendCommand([point], getEffectiveColor());
    }

    isDrawingRef.current = false;
    hasMovedRef.current = false;
    lastPointRef.current = null;
    pointBufferRef.current = [];
  }, [createAndSendCommand, getEffectiveColor, sendBatchedCommand]);

  // Continue drawing to a new point
  const continueDrawing = useCallback(
    (currentPoint: Point) => {
      const lastPoint = lastPointRef.current;
      if (!lastPoint) return;

      hasMovedRef.current = true;

      // Draw locally immediately for smooth visual feedback
      const localCommand: DrawingCommand = {
        type: "stroke",
        points: [lastPoint, currentPoint],
        color: getEffectiveColor(),
        width: currentWidth,
      };
      drawCommand(localCommand, true);

      // Add point to batch buffer for network transmission
      pointBufferRef.current.push(currentPoint);
      lastPointRef.current = currentPoint;

      // Schedule batch flush if not already scheduled
      if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(flushBatch, BATCH_INTERVAL_MS);
      }
    },
    [currentWidth, drawCommand, flushBatch, getEffectiveColor]
  );

  // Handle fill tool click
  const handleFillClick = useCallback(
    (point: Point) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Execute fill locally
      floodFill(ctx, point.x, point.y, currentColor);

      // Send fill command to server with normalized coordinates
      const fillCommand: DrawingCommand = {
        type: "fill",
        points: [normalizePoint(point)],
        color: currentColor,
        width: 0, // Not used for fill
      };

      // Track in local history for undo
      commandHistoryRef.current.push(fillCommand);

      sendFillCommand(fillCommand).catch((error) => {
        logger.error("Failed to send fill command", error);
      });

      setLocalStrokeCount((prev) => prev + 1);
    },
    [currentColor, sendFillCommand]
  );

  // Unified pointer down handler
  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      if ("touches" in e) e.preventDefault();

      const coords = getClientCoords(e);
      if (!coords) return;

      const point = getCanvasPoint(coords.clientX, coords.clientY);
      if (!point) return;

      // Handle fill tool separately - single click fills
      if (currentTool === "fill") {
        handleFillClick(point);
        return;
      }

      // Normal drawing behavior
      startDrawing(point);
    },
    [disabled, getCanvasPoint, startDrawing, currentTool, handleFillClick]
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
    setLocalStrokeCount(0);
    try {
      await signalRClearCanvas();
    } catch (error) {
      logger.error("Failed to clear canvas", error);
    }
  }, [clearCanvas, signalRClearCanvas]);

  // Undo handler
  const handleUndo = useCallback(async () => {
    try {
      await undoLastDrawCommand();
    } catch (error) {
      logger.error("Failed to undo", error);
    }
  }, [undoLastDrawCommand]);

  // Keyboard shortcuts
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Clear canvas with Ctrl+Shift+X (Cmd+Shift+X on Mac)
      // Using Shift to avoid conflict with cut operation
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "x"
      ) {
        e.preventDefault();
        handleClearMemo();
      }
      
      // Undo with Ctrl+Z (Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (localStrokeCount > 0) {
          handleUndo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, handleClearMemo, handleUndo, localStrokeCount]);

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
          onUndo={handleUndo}
          canUndo={localStrokeCount > 0}
        />
      )}
    </div>
  );
}

// Memoize the canvas component to prevent re-renders from parent timer updates
const DrawingCanvas = memo(DrawingCanvasComponent);
export default DrawingCanvas;
