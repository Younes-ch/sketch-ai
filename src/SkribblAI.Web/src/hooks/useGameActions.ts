import { useState } from "react";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { logger } from "@/lib/logger";

export function useGameActions() {
  const roomCode = useRoomStore((s) => s.roomCode);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const updateRoomSettings = useRoomStore((s) => s.updateRoomSettings);
  const startGame = useGameStore((s) => s.startGame);

  const [showCopied, setShowCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  const handleLeaveRoom = async () => {
    try {
      await leaveRoom();
    } catch (error) {
      logger.error("Failed to leave room", error);
    }
  };

  const handleShareRoom = async () => {
    const shareUrl = `${window.location.origin}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      logger.error("Failed to copy link", error);
    }
  };

  const handleStartGame = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      await startGame();
    } catch (error) {
      logger.error("Failed to start game", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSettingsChange = async (
    updates: Partial<Parameters<typeof updateRoomSettings>[0]>
  ) => {
    if (isUpdatingSettings) return;
    setIsUpdatingSettings(true);
    try {
      await updateRoomSettings(updates);
    } catch (error) {
      logger.error("Failed to update room settings", error);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  return {
    showCopied,
    isStarting,
    isUpdatingSettings,
    handleLeaveRoom,
    handleShareRoom,
    handleStartGame,
    handleSettingsChange,
  };
}
