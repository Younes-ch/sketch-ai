import { cn } from "@/lib/utils";

interface TabButtonProps {
  label: string;
  icon: string;
  isActive: boolean;
  activeColor: "success" | "info" | "accent";
  onClick: () => void;
}

const colorStyles = {
  success: "bg-success border-success-dark",
  info: "bg-info border-info-dark",
  accent: "bg-accent text-background border-accent-hover",
};

export default function TabButton({
  label,
  icon,
  isActive,
  activeColor,
  onClick,
}: TabButtonProps) {
  return (
    <button
      className={cn(
        "flex-1 py-2.5 px-3 rounded-2xl font-bold text-base transition-all duration-200 border-4",
        isActive
          ? cn(
              colorStyles[activeColor],
              "text-white shadow-lg transform scale-105"
            )
          : "bg-card-border text-white/70 border-card-border-hover hover:bg-card-border-hover"
      )}
      onClick={onClick}
    >
      {icon} {label}
    </button>
  );
}
