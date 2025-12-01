interface ChatPanelProps {
  variant?: "desktop" | "mobile";
}

export default function ChatPanel({ variant = "desktop" }: ChatPanelProps) {
  const isDesktop = variant === "desktop";

  return (
    <div
      className={`bg-card rounded-2xl p-4 border-4 border-card-border flex flex-col ${
        isDesktop ? "shadow-none" : "shadow-lg h-full"
      }`}
    >
      <h3
        className={`text-white font-bold mb-3 flex items-center gap-2 shrink-0 ${
          isDesktop ? "text-sm" : "text-lg"
        }`}
      >
        <span>💬</span> CHAT
      </h3>
      <div
        className={`flex-1 bg-background rounded-xl p-3 mb-3 border-2 border-card-border overflow-y-auto min-h-0`}
      >
        <p
          className={`text-white/40 text-center ${
            isDesktop ? "text-xs" : "text-sm py-8"
          }`}
        >
          Chat messages will appear here...
          {!isDesktop && (
            <>
              <br />
              <span className="text-xs">Type your guesses below!</span>
            </>
          )}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <input
          type="text"
          placeholder="Type your guess..."
          className={`flex-1 min-w-0 bg-background border-2 border-card-border rounded-xl text-white focus:outline-none focus:border-accent placeholder:text-white/30 ${
            isDesktop ? "px-3 py-2 text-sm" : "px-4 py-3"
          }`}
          disabled
        />
        <button
          className={`bg-success border-2 border-success-dark rounded-xl text-white font-bold hover:bg-success-hover transition-colors shrink-0 ${
            isDesktop ? "px-4 py-2" : "px-5 py-3"
          }`}
          disabled
        >
          ➤
        </button>
      </div>
    </div>
  );
}
