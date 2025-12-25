import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface ChatPanelProps {
  variant?: "desktop" | "mobile";
}

export default function ChatPanel({ variant = "desktop" }: ChatPanelProps) {
  const isDesktop = variant === "desktop";
  const chatMessages = useChatStore((s) => s.messages);
  const sendGuess = useGameStore((s) => s.sendGuess);
  const phase = useGameStore((s) => s.phase);
  const currentDrawer = useGameStore((s) => s.currentDrawer);
  const playersWhoGuessed = useGameStore((s) => s.playersWhoGuessed);
  const wordHint = useGameStore((s) => s.wordHint);
  const username = useRoomStore((s) => s.username);

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Handle sending message
  const handleSubmit = async () => {
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isSending || isInputDisabled) return;

    setIsSending(true);
    try {
      await sendGuess(trimmedMessage);
      setInputValue("");
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

  // Format timestamp as HH:MM
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "bg-card rounded-2xl p-4 border-4 border-card-border flex flex-col h-full",
        isDesktop ? "shadow-none" : "shadow-lg"
      )}
    >
      <h3
        className={cn(
          "text-white font-bold mb-3 flex items-center gap-2 shrink-0",
          isDesktop ? "text-sm" : "text-lg"
        )}
      >
        <span>💬</span> CHAT
      </h3>

      {/* Messages container */}
      <div className="flex-1 bg-background rounded-xl p-3 mb-3 border-2 border-card-border overflow-y-auto min-h-0">
        {chatMessages.length === 0 ? (
          <p
            className={cn(
              "text-white/40 text-center",
              isDesktop ? "text-xs" : "text-sm py-8"
            )}
          >
            Chat messages will appear here...
            {!isDesktop && (
              <>
                <br />
                <span className="text-xs">Type your guesses below!</span>
              </>
            )}
          </p>
        ) : (
          <div className="space-y-2">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "text-sm break-all",
                  msg.type === "correct-guess" &&
                    "bg-success/20 -mx-3 px-3 py-1.5 rounded",
                  msg.type === "close-guess" &&
                    "bg-orange-500/20 -mx-3 px-3 py-1.5 rounded"
                )}
              >
                {msg.type === "system" ? (
                  <p className="text-white/50 italic text-xs">{msg.message}</p>
                ) : msg.type === "correct-guess" ? (
                  <p className="text-success font-medium flex items-center gap-1">
                    <span>✓</span>
                    {msg.message}
                  </p>
                ) : msg.type === "close-guess" ? (
                  <p className="text-orange-400">
                    <span className="font-bold text-orange-500">
                      {msg.username}:
                    </span>{" "}
                    {msg.message}
                    <span className="text-orange-300/60 text-xs ml-2">
                      (close!)
                    </span>
                  </p>
                ) : (
                  <p className="text-white">
                    <span className="font-bold text-accent">
                      {msg.username}:
                    </span>{" "}
                    {msg.message}
                    <span className="text-white/30 text-xs ml-2">
                      {formatTime(msg.timestamp)}
                    </span>
                  </p>
                )}
              </div>
            ))}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Character count indicator */}
      {showCharacterCount && (
        <div className="flex items-center justify-end gap-1 mb-1 shrink-0">
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
      <div className="flex gap-2 shrink-0">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          maxLength={100}
          disabled={isInputDisabled}
          className={cn(
            "flex-1 min-w-0 bg-background border-2 border-card-border rounded-xl text-white focus:outline-none focus:border-accent placeholder:text-white/30 disabled:opacity-50 disabled:cursor-not-allowed",
            isDesktop ? "px-3 py-2 text-sm" : "px-4 py-3"
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={isInputDisabled || !inputValue.trim()}
          className={cn(
            "bg-success border-2 border-success-dark rounded-xl text-white font-bold transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed",
            !isInputDisabled && inputValue.trim() && "hover:bg-success-hover",
            isDesktop ? "px-4 py-2" : "px-5 py-3"
          )}
        >
          {isSending ? "..." : "➤"}
        </button>
      </div>
    </div>
  );
}
