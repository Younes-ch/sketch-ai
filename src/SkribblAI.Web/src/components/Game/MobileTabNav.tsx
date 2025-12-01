export type MobileTab = "canvas" | "players" | "chat";

interface MobileTabNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export default function MobileTabNav({
  activeTab,
  onTabChange,
}: MobileTabNavProps) {
  const tabs: {
    id: MobileTab;
    label: string;
    icon: string;
    activeColor: string;
  }[] = [
    {
      id: "canvas",
      label: "Draw",
      icon: "🎨",
      activeColor: "bg-[#FFC71E] text-[#0D1B2A]",
    },
    {
      id: "players",
      label: "Players",
      icon: "👥",
      activeColor: "bg-[#4CAF50] text-white",
    },
    {
      id: "chat",
      label: "Chat",
      icon: "💬",
      activeColor: "bg-[#2196F3] text-white",
    },
  ];

  return (
    <div className="lg:hidden flex gap-1 mb-2 shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 ${
            activeTab === tab.id
              ? tab.activeColor
              : "bg-[#1B2838] text-white/60 border-2 border-[#2A3F54]"
          }`}
        >
          <span>{tab.icon}</span> {tab.label}
        </button>
      ))}
    </div>
  );
}
