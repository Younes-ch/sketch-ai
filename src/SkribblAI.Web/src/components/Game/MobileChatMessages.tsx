import { useRef, useEffect, useCallback } from "react";
import { useChatStore } from "@/stores/chatStore";
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
    <div className="bg-card rounded-xl p-2 border-4 border-card-border h-full flex flex-col overflow-hidden">
      <h3 className="text-white font-bold text-xs mb-1 flex items-center gap-1 shrink-0">
        <span>💬</span> CHAT
      </h3>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 bg-background rounded-lg p-2 border-2 border-card-border overflow-y-auto min-h-0 relative"
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
                    "bg-success/20 -mx-2 px-2 py-0.5 rounded",
                  msg.type === "close-guess" &&
                    "bg-orange-500/20 -mx-2 px-2 py-0.5 rounded"
                )}
              >
                {msg.type === "system" ? (
                  <p className="text-white/50 italic text-[10px]">
                    {msg.message}
                  </p>
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
                    <span className="text-orange-300/60 text-[10px] ml-1">
                      (close!)
                    </span>
                  </p>
                ) : (
                  <p className="text-white">
                    <span className="font-bold text-accent">
                      {msg.username}:
                    </span>{" "}
                    {msg.message}
                  </p>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {isUserScrolledUp && chatMessages.length > 0 && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-1 right-1 bg-accent hover:bg-accent/80 text-white rounded-full p-1 shadow-lg transition-all duration-200"
            aria-label="Scroll to bottom"
          >
            <ChevronDownIcon size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
