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
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

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

    setCurrentPoints([point]);
  };

  // Mouse move - continue drawing
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const point: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const newPoints = [...currentPoints, point];
    setCurrentPoints(newPoints);

    // Draw locally immediately for smooth experience
    const command: DrawingCommand = {
      type: "stroke",
      points: newPoints,
      color: currentColor,
      width: currentWidth,
    };
    drawCommand(command);
  };

  // Mouse up - finish drawing and send to server
  const handleMouseUp = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 1) {
      const command: DrawingCommand = {
        type: "stroke",
        points: currentPoints,
        color: currentColor,
        width: currentWidth,
      };

      try {
        await sendDrawingCommand(command);
      } catch (error) {
        console.error("Failed to send drawing command:", error);
      }
    }

    setCurrentPoints([]);
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
