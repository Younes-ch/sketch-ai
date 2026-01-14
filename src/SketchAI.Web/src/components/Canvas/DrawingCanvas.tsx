import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import simplify from "simplify-js";
import type { Point, DrawingCommand } from "@/models";
import { useCanvasStore, setIsCanvasSubscribed } from "@/stores/canvasStore";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  clampPoint,
  normalizePoint,
  denormalizePoint,
  getClientCoords,
  floodFill,
} from "@/lib/canvasUtils";
import { DRAWING_COLORS } from "@/constants/colors";
import {
  CanvasToolbar,
  VerticalToolbar,
  type ToolType,
} from "@/components/Canvas";

// Batching configuration for network optimization
// Points are accumulated and sent every BATCH_INTERVAL_MS to reduce network traffic
const BATCH_INTERVAL_MS = 50;

// Point simplification configuration (Douglas-Peucker + Radial Distance)
// Tolerance controls how aggressively points are removed (in canvas coordinates)
// Higher = more simplification, lower = more precision
const SIMPLIFY_TOLERANCE = 1.5;
const SIMPLIFY_HIGH_QUALITY = true; // Use Douglas-Peucker (slower but better quality)

interface DrawingCanvasProps {
  disabled?: boolean;
}

function DrawingCanvasComponent({ disabled = false }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const seenAiStrokeIdsRef = useRef<Set<string>>(new Set());

  // Batching refs for network optimization
  const pointBufferRef = useRef<Point[]>([]); // Accumulates points between batches
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentColorRef = useRef<string>(DRAWING_COLORS.DEFAULT); // Track color during batch
  const strokeIdRef = useRef<string | null>(null); // Track current stroke's unique ID for proper undo grouping

  // Local command history for undo functionality
  const commandHistoryRef = useRef<DrawingCommand[]>([]);

  // Replay cancellation - AbortController allows cancelling in-progress async replays
  const replayAbortRef = useRef<AbortController | null>(null);
  // Track if undo is pending to prevent rapid fire
  const undoPendingRef = useRef(false);

  const [currentColor, setCurrentColor] = useState<string>(
    DRAWING_COLORS.DEFAULT
  );
  const [currentWidth, setCurrentWidth] = useState(8);
  const [currentTool, setCurrentTool] = useState<ToolType>("brush");
  const [localStrokeCount, setLocalStrokeCount] = useState(0); // Track local strokes for undo
  const [displaySize, setDisplaySize] = useState({
    width: 800,
    height: 600,
  });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        // Fill the entire container to avoid whitespace
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

  const sendDrawingCommand = useCanvasStore((s) => s.sendDrawingCommand);
  const sendFillCommand = useCanvasStore((s) => s.sendFillCommand);
  const undoLastDrawCommand = useCanvasStore((s) => s.undoLastDrawCommand);
  const undoAIDrawing = useCanvasStore((s) => s.undoAIDrawing);
  const aiDrawingStrokeIds = useCanvasStore((s) => s.aiDrawingStrokeIds);
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
  const onReceiveAIDrawingCommand = useCanvasStore(
    (s) => s.onReceiveAIDrawingCommand
  );
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

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Async chunked replay - prevents UI freeze by yielding between batches
  // Supports cancellation via AbortController to handle rapid undo sequences
  const replayHistoryAsync = useCallback(
    async (history: DrawingCommand[], onComplete?: () => void) => {
      // Cancel any in-progress replay before starting a new one
      if (replayAbortRef.current) {
        replayAbortRef.current.abort();
      }

      // For short histories (e.g., after undos), use synchronous replay
      // This avoids race conditions and is fast enough to not cause jank
      const SYNC_THRESHOLD = 50;
      if (history.length <= SYNC_THRESHOLD) {
        history.forEach((cmd) => drawCommand(cmd));
        onComplete?.();
        return;
      }

      // For longer histories, use async chunked replay with cancellation
      const abortController = new AbortController();
      replayAbortRef.current = abortController;

      const CHUNK_SIZE = 25; // Commands per frame

      for (let i = 0; i < history.length; i += CHUNK_SIZE) {
        // Check if this replay was cancelled
        if (abortController.signal.aborted) {
          return;
        }

        const chunk = history.slice(i, i + CHUNK_SIZE);
        chunk.forEach((cmd) => drawCommand(cmd));

        // Yield to browser between chunks to prevent freeze
        if (i + CHUNK_SIZE < history.length) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      // Clear the ref if this replay completed without being cancelled
      if (replayAbortRef.current === abortController) {
        replayAbortRef.current = null;
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
          clearCanvas();
          replayHistoryAsync(historyToProcess);
        }
      });
      clearPendingCanvasHistory();
      return () => cancelAnimationFrame(frameId);
    }

    logger.info(
      `Drawing pending canvas history: ${historyToProcess.length} commands`
    );
    clearCanvas();
    replayHistoryAsync(historyToProcess);
    clearPendingCanvasHistory();
  }, [
    pendingCanvasHistory,
    replayHistoryAsync,
    clearPendingCanvasHistory,
    clearCanvas,
  ]);

  // Initialize SignalR listeners
  useEffect(() => {
    // Mark that the real canvas handler is now subscribed
    // This prevents the fallback handler from fighting with us
    setIsCanvasSubscribed(true);

    // Capture ref for cleanup to avoid React lint warning
    const seenAiStrokeIds = seenAiStrokeIdsRef.current;

    // Subscribe to drawing commands from other clients
    const unsubDrawing = onReceiveDrawingCommand((command: DrawingCommand) => {
      commandHistoryRef.current.push(command);
      drawCommand(command);
    });

    // Subscribe to canvas history (sent when late joiner joins or after AI undo)
    const unsubHistory = onReceiveCanvasHistory((history: DrawingCommand[]) => {
      logger.info(`Received canvas history with ${history.length} commands`);
      // Replace local history with server history
      commandHistoryRef.current = [...history];

      // Recalculate local stroke count based on unique strokeIds in history
      // This ensures the count stays in sync after operations like AI undo
      const uniqueStrokeIds = new Set(
        history.filter((cmd) => cmd.strokeId).map((cmd) => cmd.strokeId)
      );
      // Count commands without strokeId (legacy or fill commands) as individual strokes
      const commandsWithoutStrokeId = history.filter(
        (cmd) => !cmd.strokeId
      ).length;
      setLocalStrokeCount(uniqueStrokeIds.size + commandsWithoutStrokeId);

      // Clear seen AI stroke IDs since we're resetting to server state
      seenAiStrokeIdsRef.current.clear();

      // Clear pending history to prevent double processing
      // (the fallback handler in setupCanvasEventHandlers also sets pendingCanvasHistory)
      clearPendingCanvasHistory();

      // Clear canvas before replaying to ensure clean state
      clearCanvas();
      // Replay all commands asynchronously to prevent UI freeze
      replayHistoryAsync(history);
    });

    // Subscribe to clear canvas events
    const unsubClear = onCanvasCleared(() => {
      clearCanvas();
      commandHistoryRef.current = [];
      setLocalStrokeCount(0);
    });

    // Subscribe to undo events - clear and replay without last stroke
    // A stroke may consist of multiple batched commands with the same strokeId
    const unsubUndo = onReceiveUndo(() => {
      logger.info("Received undo command - replaying canvas");
      const history = commandHistoryRef.current;

      if (history.length === 0) return;

      // Get the strokeId of the last command
      const lastCommand = history[history.length - 1];
      const strokeIdToRemove = lastCommand.strokeId;

      if (strokeIdToRemove) {
        // Remove all commands with the same strokeId (entire stroke)
        commandHistoryRef.current = history.filter(
          (cmd) => cmd.strokeId !== strokeIdToRemove
        );
      } else {
        // Fallback for commands without strokeId (legacy or fill commands)
        commandHistoryRef.current = history.slice(0, -1);
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

    // Subscribe to AI drawing commands (drawer only) - increment stroke count for undo
    const unsubAIDrawing = onReceiveAIDrawingCommand(
      (command: DrawingCommand) => {
        logger.info("Received AI drawing command", command.strokeId);
        // Only increment for unique strokeIds
        if (
          command.strokeId &&
          !seenAiStrokeIdsRef.current.has(command.strokeId)
        ) {
          seenAiStrokeIdsRef.current.add(command.strokeId);
          setLocalStrokeCount((prev) => prev + 1);
        }
      }
    );

    return () => {
      // Mark that the real canvas handler is no longer subscribed
      // This allows the fallback handler to work again if canvas unmounts
      setIsCanvasSubscribed(false);
      unsubDrawing();
      unsubHistory();
      unsubClear();
      unsubUndo();
      unsubFill();
      unsubAIDrawing();
      seenAiStrokeIds.clear();
    };
  }, [
    onReceiveDrawingCommand,
    onReceiveCanvasHistory,
    onCanvasCleared,
    onReceiveUndo,
    onReceiveFillCommand,
    onReceiveAIDrawingCommand,
    drawCommand,
    clearCanvas,
    clearPendingCanvasHistory,
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
      // Generate unique strokeId for this entire stroke (mousedown→mouseup)
      strokeIdRef.current = crypto.randomUUID();
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

      // Send normalized coordinates to server with strokeId for undo grouping
      const networkCommand: DrawingCommand = {
        type: "stroke",
        points: simplifiedPoints.map(normalizePoint),
        color: effectiveColor,
        width: currentWidth,
        strokeId: strokeIdRef.current ?? undefined,
      };

      // Track in local history for undo
      commandHistoryRef.current.push(networkCommand);

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
          strokeId: strokeIdRef.current ?? undefined,
        };

        // Track in local history for undo
        commandHistoryRef.current.push(networkCommand);

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

    // Increment stroke count once per complete stroke (not per batched command)
    // This keeps the count in sync with undo which removes entire strokes
    if (isDrawingRef.current) {
      setLocalStrokeCount((prev) => prev + 1);
    }

    isDrawingRef.current = false;
    hasMovedRef.current = false;
    lastPointRef.current = null;
    pointBufferRef.current = [];
    strokeIdRef.current = null; // Clear strokeId when stroke ends
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

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

  // Handle brush size change on scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      setCurrentWidth((prevWidth) => {
        const currentIndex = brushSizes.indexOf(prevWidth);
        if (currentIndex === -1) return prevWidth;

        if (e.deltaY < 0) {
          // Scroll Up -> Increase size (Next index)
          if (currentIndex < brushSizes.length - 1) {
            return brushSizes[currentIndex + 1];
          }
        } else if (e.deltaY > 0) {
          // Scroll Down -> Decrease size (Previous index)
          if (currentIndex > 0) {
            return brushSizes[currentIndex - 1];
          }
        }
        return prevWidth;
      });
    };

    // Use passive: false to allow preventDefault()
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [brushSizes, disabled]);

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

  // Undo handler with debounce protection
  // Uses undoPendingRef to prevent rapid fire while request is in-flight
  const handleUndo = useCallback(async () => {
    // Prevent firing if an undo is already in progress
    if (undoPendingRef.current) return;

    undoPendingRef.current = true;
    try {
      // If there are AI drawing strokes, undo the entire AI drawing
      if (aiDrawingStrokeIds.length > 0) {
        await undoAIDrawing();
      } else {
        await undoLastDrawCommand();
      }
    } catch (error) {
      logger.error("Failed to undo", error);
    } finally {
      // Small delay before allowing next undo to prevent rapid fire
      // This acts as a debounce for held keys (OS key repeat ~30-50ms)
      setTimeout(() => {
        undoPendingRef.current = false;
      }, 150);
    }
  }, [undoLastDrawCommand, undoAIDrawing, aiDrawingStrokeIds.length]);

  // Keyboard shortcuts
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

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
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        e.preventDefault();
        if (localStrokeCount > 0) {
          handleUndo();
        }
      }

      // Tool shortcuts (single keys, no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            setCurrentTool("brush");
            break;
          case "f":
            e.preventDefault();
            setCurrentTool("fill");
            break;
          case "e":
            e.preventDefault();
            setCurrentTool("eraser");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, handleClearMemo, handleUndo, localStrokeCount]);

  return (
    <div className="relative flex items-center justify-center w-full h-full gap-2">
      {/* Fixed Toolbar for Desktop */}
      {!disabled && (
        <div className="hidden lg:flex flex-col justify-center h-full z-10 shrink-0 min-w-fit">
          <VerticalToolbar
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
        </div>
      )}

      {/* Canvas Container */}
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

      {/* Mobile toolbar (floating FAB) */}
      {!disabled && (
        <div className="lg:hidden">
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
        </div>
      )}
    </div>
  );
}

// Memoize the canvas component to prevent re-renders from parent timer updates
const DrawingCanvas = memo(DrawingCanvasComponent);
export default DrawingCanvas;
