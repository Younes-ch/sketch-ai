interface ShortcutBadgeProps {
  keys: string[];
  label: string;
}

export function ShortcutBadge({ keys, label }: ShortcutBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="flex items-center gap-0.5">
        {keys.map((key, i) => (
          <span key={i}>
            <kbd className="px-1.5 py-0.5 bg-card-border rounded text-white/80 font-mono text-[10px] border border-white/10">
              {key}
            </kbd>
            {i < keys.length - 1 && (
              <span className="text-white/40 mx-0.5">+</span>
            )}
          </span>
        ))}
      </div>
      <span className="text-white/50">{label}</span>
    </div>
  );
}
