interface ChatPanelProps {
  variant?: "desktop" | "mobile";
}

export default function ChatPanel({ variant = "desktop" }: ChatPanelProps) {
  const isDesktop = variant === "desktop";

  return (
    <div
      className={`bg-[#1B2838] rounded-2xl p-4 border-4 border-[#2A3F54] flex flex-col ${
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
        className={`flex-1 bg-[#0D1B2A] rounded-xl p-3 mb-3 border-2 border-[#2A3F54] overflow-y-auto min-h-0`}
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
          className={`flex-1 min-w-0 bg-[#0D1B2A] border-2 border-[#2A3F54] rounded-xl text-white focus:outline-none focus:border-[#FFC71E] placeholder:text-white/30 ${
            isDesktop ? "px-3 py-2 text-sm" : "px-4 py-3"
          }`}
          disabled
        />
        <button
          className={`bg-[#4CAF50] border-2 border-[#45a049] rounded-xl text-white font-bold hover:bg-[#43A047] transition-colors shrink-0 ${
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
