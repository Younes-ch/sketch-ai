import { useState, useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useGameStore } from "@/stores/gameStore";
import { useRoomStore } from "@/stores/roomStore";
import { Button } from "@/components/ui";
import { ChevronDownIcon } from "@/components/ui/Icons";
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const shouldMaintainFocusRef = useRef(false);

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

  // Check if user is at the bottom of the scroll container
  const isAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 50; // pixels from bottom to consider "at bottom"
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback(() => {
    setIsUserScrolledUp(!isAtBottom());
  }, [isAtBottom]);

  // Auto-scroll to bottom when new messages arrive (only if not manually scrolled up)
  useEffect(() => {
    if (!isUserScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isUserScrolledUp]);

  // Maintain focus on input after sending a message (handles close guess re-renders)
  useEffect(() => {
    if (shouldMaintainFocusRef.current && !isInputDisabled) {
      inputRef.current?.focus();
      shouldMaintainFocusRef.current = false;
    }
  }, [chatMessages, isInputDisabled]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsUserScrolledUp(false);
  }, []);

  // Handle sending message
  const handleSubmit = async () => {
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isSending || isInputDisabled) return;

    setIsSending(true);
    shouldMaintainFocusRef.current = true;
    try {
      await sendGuess(trimmedMessage);
      setInputValue("");
    } catch (error) {
      logger.error("Failed to send message", error);
      shouldMaintainFocusRef.current = false;
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
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 bg-background rounded-xl p-3 mb-3 border-2 border-card-border overflow-y-auto min-h-0 relative"
      >
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
                    "bg-orange-500/20 -mx-3 px-3 py-1.5 rounded",
                  // System message specialized backgrounds
                  msg.type === "join" &&
                    "bg-blue-500/10 -mx-3 px-3 py-1.5 rounded",
                  msg.type === "leave" &&
                    "bg-red-500/10 -mx-3 px-3 py-1.5 rounded",
                  msg.type === "owner-change" &&
                    "bg-orange-400/10 -mx-3 px-3 py-1.5 rounded",
                  msg.type === "round-start" &&
                    "bg-purple-500/10 -mx-3 px-3 py-1.5 rounded mt-4 mb-2 border-t border-purple-500/30",
                  msg.type === "round-end" &&
                    "bg-indigo-500/10 -mx-3 px-3 py-1.5 rounded mb-4 border-b border-indigo-500/30",
                  msg.type === "turn-start" &&
                    "bg-cyan-500/10 -mx-3 px-3 py-1.5 rounded my-1"
                )}
              >
                {/* Generic System Message */}
                {msg.type === "system" && (
                  <p className="text-white/50 italic text-xs">{msg.message}</p>
                )}

                {/* Specialized System Messages */}
                {msg.type === "join" && (
                  <p className="text-blue-400 text-xs font-semibold flex items-center gap-2">
                    <span>👋</span> {msg.message}
                  </p>
                )}
                {msg.type === "leave" && (
                  <p className="text-red-400 text-xs font-semibold flex items-center gap-2">
                    <span>🚪</span> {msg.message}
                  </p>
                )}
                {msg.type === "owner-change" && (
                  <p className="text-orange-400 text-xs font-semibold flex items-center gap-2">
                    <span>👑</span> {msg.message}
                  </p>
                )}
                {msg.type === "round-start" && (
                  <div className="text-center py-1">
                    <p className="text-purple-400 font-bold text-sm uppercase tracking-wider">
                      {msg.message}
                    </p>
                  </div>
                )}
                {msg.type === "round-end" && (
                  <div className="text-center py-1">
                    <p className="text-indigo-400 font-bold text-sm">
                      {msg.message}
                    </p>
                  </div>
                )}
                {msg.type === "turn-start" && (
                  <p className="text-cyan-400 text-xs font-semibold flex items-center gap-2">
                    <span>✏️</span> {msg.message}
                  </p>
                )}

                {/* Game Logic Messages */}
                {msg.type === "correct-guess" ? (
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
                ) : msg.type === "chat" ? (
                  <p className="text-white">
                    <span className="font-bold text-accent">
                      {msg.username}:
                    </span>{" "}
                    {msg.message}
                    <span className="text-white/30 text-xs ml-2">
                      {formatTime(msg.timestamp)}
                    </span>
                  </p>
                ) : null}
              </div>
            ))}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {isUserScrolledUp && chatMessages.length > 0 && (
          <Button
            variant="primary"
            size="icon"
            onClick={scrollToBottom}
            className="absolute bottom-2 right-2 bg-accent hover:bg-accent/80 rounded-full p-2 shadow-lg border-0"
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon size={16} />
          </Button>
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
          ref={inputRef}
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
        <Button
          variant="success"
          size={isDesktop ? "sm" : "md"}
          onClick={handleSubmit}
          disabled={isInputDisabled || !inputValue.trim()}
          className="shrink-0"
        >
          {isSending ? "..." : "➤"}
        </Button>
      </div>
    </div>
  );
}
