import { useSignalR } from "@/hooks/useSignalR";

export default function ConnectionStatus() {
  const { connectionState } = useSignalR();

  if (connectionState === "Connected") {
    return null; // Don't show anything when connected
  }

  const config = {
    Reconnecting: {
      bg: "bg-yellow-500",
      text: "Reconnecting...",
      icon: "🔄",
    },
    Disconnected: {
      bg: "bg-red-500",
      text: "Disconnected",
      icon: "❌",
    },
  };

  const { bg, text, icon } = config[connectionState];

  return (
    <div
      className={`${bg} px-3 py-1.5 rounded-lg flex items-center gap-2 animate-pulse`}
    >
      <span>{icon}</span>
      <span className="text-white font-bold text-sm">{text}</span>
    </div>
  );
}
