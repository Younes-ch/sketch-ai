import { useEffect, useRef, useState, useCallback } from "react";
import type { Point } from "@/models/point";
import { useSignalR } from "@/hooks/useSignalR";
import type { DrawingCommand } from "@/models/drawingCommand";
import { COLOR_PALETTE } from "@/constants/colors";

type ToolType = "brush" | "eraser";

// Fixed canvas resolution - all clients use this for consistent coordinates
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false); // Ref to avoid stale closure in touch events
  const [currentColor, setCurrentColor] = useState("#000000");
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
        const containerHeight = containerRef.current.offsetHeight - 160; // Reserve space for toolbar

        const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
        let displayWidth = Math.min(containerWidth, CANVAS_WIDTH);
        let displayHeight = displayWidth / aspectRatio;

        // If height exceeds available space, scale based on height
        if (displayHeight > containerHeight && containerHeight > 100) {
          displayHeight = containerHeight;
          displayWidth = displayHeight * aspectRatio;
        }

        setDisplaySize({
          width: Math.max(displayWidth, 200),
          height: Math.max(displayHeight, 125),
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Optimization: Use a ref to track the last point without triggering re-renders
  const lastPointRef = useRef<Point | null>(null);

  const {
    sendDrawingCommand,
    clearCanvas: signalRClearCanvas,
    onReceiveDrawingCommand,
    onReceiveCanvasHistory,
    onCanvasCleared,
    pendingCanvasHistory,
    clearPendingCanvasHistory,
  } = useSignalR();

  // Get effective color (white for eraser)
  const getEffectiveColor = useCallback(() => {
    return currentTool === "eraser" ? "#FFFFFF" : currentColor;
  }, [currentTool, currentColor]);

  // Draw a command on the canvas
  const drawCommand = useCallback((command: DrawingCommand) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = command.color;
    ctx.lineWidth = command.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (command.type === "stroke" && command.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(command.points[0].x, command.points[0].y);

      for (let i = 1; i < command.points.length; i++) {
        ctx.lineTo(command.points[i].x, command.points[i].y);
      }

      ctx.stroke();
    }
  }, []);

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
      console.log(
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
      console.log(`Received canvas history with ${history.length} commands`);
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

  // Mouse down - start drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates to fixed canvas resolution
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const point: Point = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };

    setIsDrawing(true);
    isDrawingRef.current = true;
    lastPointRef.current = point;
  };

  // Mouse move - continue drawing
  const handleMouseMove = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Scale mouse coordinates to fixed canvas resolution
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const currentPoint: Point = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };

    const lastPoint = lastPointRef.current;
    const effectiveColor = getEffectiveColor();

    // Create a small segment command
    const command: DrawingCommand = {
      type: "stroke",
      points: [lastPoint, currentPoint],
      color: effectiveColor,
      width: currentWidth,
    };

    // 1. Draw locally (Optimization: only draw the new segment)
    drawCommand(command);

    // 2. Send to server immediately (Live Drawing)
    try {
      // We don't await this to keep drawing smooth
      sendDrawingCommand(command);
    } catch (error) {
      console.error("Failed to send drawing command:", error);
    }

    // Update last point
    lastPointRef.current = currentPoint;
  };

  // Mouse up - finish drawing
  const handleMouseUp = () => {
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  // Touch handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling while drawing
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const point: Point = {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };

    setIsDrawing(true);
    isDrawingRef.current = true;
    lastPointRef.current = point;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling while drawing
    if (
      !isDrawingRef.current ||
      !lastPointRef.current ||
      e.touches.length === 0
    )
      return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const currentPoint: Point = {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };

    const lastPoint = lastPointRef.current;
    const effectiveColor = getEffectiveColor();

    const command: DrawingCommand = {
      type: "stroke",
      points: [lastPoint, currentPoint],
      color: effectiveColor,
      width: currentWidth,
    };

    drawCommand(command);
    try {
      sendDrawingCommand(command);
    } catch (error) {
      console.error("Failed to send touch drawing command:", error);
    }
    lastPointRef.current = currentPoint;
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  // Handle clear button
  const handleClear = async () => {
    clearCanvas();
    try {
      await signalRClearCanvas();
    } catch (error) {
      console.error("Failed to clear canvas:", error);
    }
  };

  // Get cursor style based on tool
  const getCursor = () => {
    return "crosshair";
  };

  const brushSizes = [4, 8, 14, 20, 30];

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center w-full h-full"
    >
      {/* Canvas - fixed internal resolution, scaled display */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="bg-white rounded-lg shadow-inner shrink-0 touch-none"
        style={{
          width: displaySize.width,
          height: displaySize.height,
          border: "4px solid #2A3F54",
          cursor: getCursor(),
        }}
      />

      {/* Toolbar - Skribbl Style */}
      <div className="mt-4 bg-[#0D1B2A] rounded-2xl p-3 border-4 border-[#2A3F54] w-full shrink-0">
        {/* Color Palette */}
        <div className="flex flex-wrap justify-center gap-1 mb-3">
          {COLOR_PALETTE.map((color, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentColor(color);
                if (currentTool === "eraser") setCurrentTool("brush");
              }}
              className={`w-7 h-7 rounded-md transition-all duration-150 hover:scale-110 ${
                currentColor === color && currentTool !== "eraser"
                  ? "ring-2 ring-[#FFC71E] ring-offset-2 ring-offset-[#0D1B2A] scale-110"
                  : "hover:ring-2 hover:ring-white/50"
              }`}
              style={{
                backgroundColor: color,
                border:
                  color === "#FFFFFF"
                    ? "2px solid #555"
                    : "2px solid rgba(0,0,0,0.3)",
              }}
            />
          ))}
        </div>

        {/* Tools Row */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {/* Tool Buttons */}
          <div className="flex items-center gap-1 bg-[#1B2838] rounded-xl p-2 border-2 border-[#2A3F54]">
            <button
              onClick={() => setCurrentTool("brush")}
              className="px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1"
              style={{
                backgroundColor:
                  currentTool === "brush" ? "#4CAF50" : "transparent",
                color:
                  currentTool === "brush" ? "white" : "rgba(255,255,255,0.6)",
              }}
            >
              <span>🖌️</span> Brush
            </button>
            <button
              onClick={() => setCurrentTool("eraser")}
              className="px-3 py-2 rounded-lg font-bold text-sm transition-all duration-150 flex items-center gap-1"
              style={{
                backgroundColor:
                  currentTool === "eraser" ? "#FF9800" : "transparent",
                color:
                  currentTool === "eraser" ? "white" : "rgba(255,255,255,0.6)",
              }}
            >
              <span>🧽</span> Eraser
            </button>
          </div>

          {/* Brush Sizes */}
          <div className="flex items-center gap-2 bg-[#1B2838] rounded-xl p-2 border-2 border-[#2A3F54]">
            <span className="text-white/60 text-xs font-bold mr-1">SIZE</span>
            {brushSizes.map((size) => (
              <button
                key={size}
                onClick={() => setCurrentWidth(size)}
                className={`rounded-full transition-all duration-150 hover:bg-[#FFC71E] ${
                  currentWidth === size ? "ring-2 ring-[#FFC71E]" : ""
                }`}
                style={{
                  width: Math.min(size + 8, 32),
                  height: Math.min(size + 8, 32),
                  backgroundColor:
                    currentTool === "eraser" ? "#FFFFFF" : currentColor,
                  border: "2px solid rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>

          {/* Custom Color Picker */}
          <div className="flex items-center gap-2 bg-[#1B2838] rounded-xl p-2 border-2 border-[#2A3F54]">
            <span className="text-white/60 text-xs font-bold">CUSTOM</span>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => {
                setCurrentColor(e.target.value);
                if (currentTool === "eraser") setCurrentTool("brush");
              }}
              className="w-8 h-8 rounded-md cursor-pointer border-2 border-[#2A3F54]"
            />
          </div>

          {/* Clear Button */}
          <button
            onClick={handleClear}
            className="px-4 py-2.5 text-white rounded-xl font-bold cursor-pointer hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2"
            style={{ backgroundColor: "#F44336", border: "4px solid #D32F2F" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#E53935")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#F44336")
            }
          >
            <span>🗑️</span> Clear
          </button>
        </div>
      </div>
    </div>
  );
}
