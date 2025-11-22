import { useEffect, useRef, useState, useCallback } from "react";
import type { Point } from "@/models/point";
import { useSignalR } from "@/hooks/useSignalR";
import type { DrawingCommand } from "@/models/drawingCommand";

interface DrawingCanvasProps {
  width?: number;
  height?: number;
}

export default function DrawingCanvas({
  width = 800,
  height = 600,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [currentWidth, setCurrentWidth] = useState(2);

  // Optimization: Use a ref to track the last point without triggering re-renders
  const lastPointRef = useRef<Point | null>(null);

  const {
    connection,
    sendDrawingCommand,
    clearCanvas: signalRClearCanvas,
  } = useSignalR();

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

  // Initialize SignalR listeners
  useEffect(() => {
    if (!connection) return;

    // Listen for drawing commands from other clients
    connection.on("ReceiveDrawingCommand", (command: DrawingCommand) => {
      drawCommand(command);
    });

    // Listen for clear canvas events
    connection.on("ClearCanvas", () => {
      clearCanvas();
    });

    return () => {
      connection.off("ReceiveDrawingCommand");
      connection.off("ClearCanvas");
    };
  }, [connection, drawCommand, clearCanvas]);

  // Mouse down - start drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const point: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    lastPointRef.current = point;
  };

  // Mouse move - continue drawing
  const handleMouseMove = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentPoint: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const lastPoint = lastPointRef.current;

    // Create a small segment command
    const command: DrawingCommand = {
      type: "stroke",
      points: [lastPoint, currentPoint],
      color: currentColor,
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

  return (
    <div className="drawing-container">
      <div className="toolbar">
        <input
          type="color"
          value={currentColor}
          onChange={(e) => setCurrentColor(e.target.value)}
        />
        <input
          type="range"
          min="1"
          max="20"
          value={currentWidth}
          onChange={(e) => setCurrentWidth(Number(e.target.value))}
        />
        <span>Width: {currentWidth}px</span>
        <button onClick={handleClear}>Clear Canvas</button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          border: "2px solid #333",
          cursor: "crosshair",
          backgroundColor: "#fff",
        }}
      />
    </div>
  );
}
