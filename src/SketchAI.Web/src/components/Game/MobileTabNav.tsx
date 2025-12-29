import { cn } from "@/lib/utils";

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
      activeColor: "bg-accent text-background",
    },
    {
      id: "players",
      label: "Players",
      icon: "👥",
      activeColor: "bg-success text-white",
    },
    {
      id: "chat",
      label: "Chat",
      icon: "💬",
      activeColor: "bg-info text-white",
    },
  ];

  return (
    <div className="lg:hidden flex gap-1 mb-2 shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1",
            activeTab === tab.id
              ? tab.activeColor
              : "bg-card text-white/60 border-2 border-card-border"
          )}
        >
          <span>{tab.icon}</span> {tab.label}
        </button>
      ))}
    </div>
  );
}
