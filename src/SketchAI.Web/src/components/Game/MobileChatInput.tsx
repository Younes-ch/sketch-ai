import { useState, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

export default function MobileChatInput() {
  const sendGuess = useGameStore((s) => s.sendGuess);
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const playersWhoGuessed = useGameStore((s) => s.playersWhoGuessed);
  const wordHint = useGameStore((s) => s.wordHint);
  const username = useRoomStore((s) => s.username);

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if current user is the drawer
  const isDrawer = currentDrawer?.username === username;
  const isDrawingPhase = phase === "drawing";
  const hasAlreadyGuessed = username ? playersWhoGuessed.has(username) : false;
  const isInputDisabled =
    isSending || (isDrawingPhase && (isDrawer || hasAlreadyGuessed));

  // Calculate word length from hint (count non-space characters)
  const wordLength = wordHint ? wordHint.replace(/\s/g, "").length : 0;
  const currentInputLength = inputValue.trim().replace(/\s/g, "").length;
  const showCharacterCount =
    isDrawingPhase && !isDrawer && !hasAlreadyGuessed && wordLength > 0;

  // Determine placeholder text
  const getPlaceholder = () => {
    if (isDrawingPhase && isDrawer) {
      return "You're drawing!";
    }
    if (isDrawingPhase && hasAlreadyGuessed) {
      return "You guessed it! 🎉";
    }
    if (phase === "lobby") {
      return "Type a message...";
    }
    return "Type your guess...";
  };

  // Handle sending message
  const handleSubmit = async () => {
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isSending || isInputDisabled) return;

    setIsSending(true);
    try {
      await sendGuess(trimmedMessage);
      setInputValue("");
      // Keep focus on input after sending - use setTimeout to ensure focus applies after state update
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      logger.error("Failed to send message", error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-card w-full p-2 border-t-2 border-card-border">
      {/* Character count indicator */}
      {showCharacterCount && (
        <div className="flex items-center justify-end gap-1 mb-1 px-1">
          <span
            className={cn(
              "text-xs font-mono",
              currentInputLength === wordLength
                ? "text-success"
                : currentInputLength > wordLength
                ? "text-red-400"
                : "text-white/50"
            )}
          >
            {currentInputLength}
          </span>
          <span className="text-white/30 text-xs">/</span>
          <span className="text-accent text-xs font-mono">{wordLength}</span>
          <span className="text-white/30 text-xs ml-1">letters</span>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          maxLength={100}
          disabled={isInputDisabled}
          className="flex-1 min-w-0 bg-background border-2 border-card-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent placeholder:text-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          variant="success"
          size="sm"
          onClick={handleSubmit}
          disabled={isInputDisabled || !inputValue.trim()}
          className="shrink-0 px-4"
        >
          {isSending ? "..." : "➤"}
        </Button>
      </div>
    </div>
  );
}
