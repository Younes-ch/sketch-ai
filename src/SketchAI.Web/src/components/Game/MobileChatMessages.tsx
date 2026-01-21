import { useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
import { Button } from "@/components/ui";
import { ChevronDownIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function MobileChatMessages() {
  const chatMessages = useChatStore((s) => s.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // Check if user is at the bottom of the scroll container
  const isAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 30;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    setIsUserScrolledUp(!isAtBottom());
  }, [isAtBottom]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isUserScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isUserScrolledUp]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsUserScrolledUp(false);
  }, []);

  return (
    <div className="bg-card h-full w-full flex flex-col overflow-hidden">
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 bg-background p-2 overflow-y-auto min-h-0 relative"
      >
        {chatMessages.length === 0 ? (
          <p className="text-white/40 text-center text-[10px]">
            Messages appear here...
          </p>
        ) : (
          <div className="space-y-1">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "text-[11px] break-all",
                  msg.type === "correct-guess" &&
                    "bg-success/20 px-2 py-0.5 rounded",
                  msg.type === "close-guess" &&
                    "bg-orange-500/20 px-2 py-0.5 rounded"
                )}
              >
                {/* Generic System Message */}
                {msg.type === "system" && (
                  <p className="text-white/50 italic text-[10px]">
                    {msg.message}
                  </p>
                )}

                {/* Specialized System Messages */}
                {msg.type === "join" && (
                  <p className="text-blue-400 text-[10px] font-semibold flex items-center gap-1">
                    <span>👋</span> {msg.message}
                  </p>
                )}
                {msg.type === "leave" && (
                  <p className="text-red-400 text-[10px] font-semibold flex items-center gap-1">
                    <span>🚪</span> {msg.message}
                  </p>
                )}
                {msg.type === "owner-change" && (
                  <p className="text-orange-400 text-[10px] font-semibold flex items-center gap-1">
                    <span>👑</span> {msg.message}
                  </p>
                )}
                {msg.type === "round-start" && (
                  <div className="text-center py-1 my-1 border-t border-purple-500/30 bg-purple-500/10 rounded">
                    <p className="text-purple-400 font-bold text-[10px] uppercase tracking-wider">
                      {msg.message}
                    </p>
                  </div>
                )}
                {msg.type === "round-end" && (
                  <div className="text-center py-1 my-1 border-b border-indigo-500/30 bg-indigo-500/10 rounded">
                    <p className="text-indigo-400 font-bold text-[10px]">
                      {msg.message}
                    </p>
                  </div>
                )}
                {msg.type === "turn-start" && (
                  <p className="text-cyan-400 text-[10px] font-semibold flex items-center gap-1">
                    <span>✏️</span> {msg.message}
                  </p>
                )}

                {/* Game Logic Messages */}
                {msg.type === "correct-guess" ? (
                  <p className="text-success font-medium flex items-center gap-1">
                    <span>✅</span>
                    {msg.message}
                  </p>
                ) : msg.type === "close-guess" ? (
                  <p className="text-orange-400">
                    <span className="font-bold text-orange-500">
                      {msg.username}:
                    </span>{" "}
                    {msg.message}
                    <span className="text-orange-300/60 text-[10px] ml-1">
                      (close!)
                    </span>
                  </p>
                ) : msg.type === "chat" ? (
                  <p className="text-white">
                    <span className="font-bold text-accent">
                      {msg.username}:
                    </span>{" "}
                    {msg.message}
                  </p>
                ) : null}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {isUserScrolledUp && chatMessages.length > 0 && (
          <Button
            variant="primary"
            size="icon"
            onClick={scrollToBottom}
            className="absolute bottom-1 right-1 bg-accent hover:bg-accent/80 rounded-full p-1 shadow-lg border-0"
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon size={12} />
          </Button>
        )}
      </div>
    </div>
  );
}
