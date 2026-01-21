import { useEffect, useRef, useCallback } from "react";
import type { DrawingCommand } from "@/models";
import { useCanvasStore, setIsCanvasSubscribed } from "@/stores/canvasStore";
import { logger } from "@/lib/logger";

interface UseSignalRCanvasOptions {
  drawCommand: (command: DrawingCommand, isLocal?: boolean) => void;
  clearCanvas: () => void;
  replayHistoryAsync: (history: DrawingCommand[], onComplete?: () => void) => Promise<void>;
  onLocalStrokeCountChange: React.Dispatch<React.SetStateAction<number>>;
  commandHistoryRef: React.MutableRefObject<DrawingCommand[]>;
}

export function useSignalRCanvas({
  drawCommand,
  clearCanvas,
  replayHistoryAsync,
  onLocalStrokeCountChange,
  commandHistoryRef,
}: UseSignalRCanvasOptions) {
  const seenAiStrokeIdsRef = useRef<Set<string>>(new Set());

  const onReceiveDrawingCommand = useCanvasStore((s) => s.onReceiveDrawingCommand);
  const onReceiveCanvasHistory = useCanvasStore((s) => s.onReceiveCanvasHistory);
  const onCanvasCleared = useCanvasStore((s) => s.onCanvasCleared);
  const onReceiveFillCommand = useCanvasStore((s) => s.onReceiveFillCommand);
  const onReceiveAIDrawingCommand = useCanvasStore((s) => s.onReceiveAIDrawingCommand);
  const pendingCanvasHistory = useCanvasStore((s) => s.pendingCanvasHistory);
  const clearPendingCanvasHistory = useCanvasStore((s) => s.clearPendingCanvasHistory);

  const handleReceiveHistory = useCallback(
    (history: DrawingCommand[]) => {
      logger.info(`Received canvas history with ${history.length} commands`);
      commandHistoryRef.current = [...history];

      const uniqueStrokeIds = new Set(
        history.filter((cmd) => cmd.strokeId).map((cmd) => cmd.strokeId)
      );
      const commandsWithoutStrokeId = history.filter((cmd) => !cmd.strokeId).length;
      onLocalStrokeCountChange(uniqueStrokeIds.size + commandsWithoutStrokeId);

      seenAiStrokeIdsRef.current.clear();
      clearPendingCanvasHistory();
      clearCanvas();
      replayHistoryAsync(history);
    },
    [commandHistoryRef, clearCanvas, replayHistoryAsync, clearPendingCanvasHistory, onLocalStrokeCountChange]
  );

  useEffect(() => {
    if (!pendingCanvasHistory || pendingCanvasHistory.length === 0) {
      return;
    }

    const historyToProcess = pendingCanvasHistory;

    logger.info(`Drawing pending canvas history: ${historyToProcess.length} commands`);
    clearCanvas();
    replayHistoryAsync(historyToProcess);
    clearPendingCanvasHistory();
  }, [pendingCanvasHistory, replayHistoryAsync, clearPendingCanvasHistory, clearCanvas]);

  useEffect(() => {
    setIsCanvasSubscribed(true);

    const seenAiStrokeIds = seenAiStrokeIdsRef.current;

    const unsubDrawing = onReceiveDrawingCommand((command: DrawingCommand) => {
      commandHistoryRef.current.push(command);
      drawCommand(command);
    });

    const unsubHistory = onReceiveCanvasHistory(handleReceiveHistory);

    const unsubClear = onCanvasCleared(() => {
      clearCanvas();
      commandHistoryRef.current = [];
      onLocalStrokeCountChange(0);
    });

    const unsubFill = onReceiveFillCommand((command: DrawingCommand) => {
      logger.info("Received fill command");
      commandHistoryRef.current.push(command);
      drawCommand(command);
    });

    const unsubAIDrawing = onReceiveAIDrawingCommand((command: DrawingCommand) => {
      logger.debug("Received AI drawing command", command.strokeId);
      if (command.strokeId && !seenAiStrokeIdsRef.current.has(command.strokeId)) {
        seenAiStrokeIdsRef.current.add(command.strokeId);
        onLocalStrokeCountChange((prev) => prev + 1);
      }
    });

    return () => {
      setIsCanvasSubscribed(false);
      unsubDrawing();
      unsubHistory();
      unsubClear();
      unsubFill();
      unsubAIDrawing();
      seenAiStrokeIds.clear();
    };
  }, [
    commandHistoryRef,
    onReceiveDrawingCommand,
    onReceiveCanvasHistory,
    onCanvasCleared,
    onReceiveFillCommand,
    onReceiveAIDrawingCommand,
    drawCommand,
    clearCanvas,
    handleReceiveHistory,
    onLocalStrokeCountChange,
  ]);

  return {
    commandHistoryRef,
  };
}
