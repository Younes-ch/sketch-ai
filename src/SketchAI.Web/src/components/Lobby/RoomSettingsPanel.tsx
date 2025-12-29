import { cn } from "@/lib/utils";
import {
  ALLOWED_DRAW_TIMES,
  ALLOWED_DIFFICULTIES,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_WORD_CHOICES,
  MAX_WORD_CHOICES,
  type RoomSettings,
} from "@/models";

interface RoomSettingsPanelProps {
  settings: RoomSettings;
  onChange: (settings: Partial<RoomSettings>) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function RoomSettingsPanel({
  settings,
  onChange,
  disabled = false,
  compact = false,
}: RoomSettingsPanelProps) {
  const roundOptions = Array.from(
    { length: MAX_ROUNDS - MIN_ROUNDS + 1 },
    (_, i) => MIN_ROUNDS + i
  );

  const maxPlayerOptions = Array.from(
    { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
    (_, i) => MIN_PLAYERS + i
  );

  const wordChoiceOptions = Array.from(
    { length: MAX_WORD_CHOICES - MIN_WORD_CHOICES + 1 },
    (_, i) => MIN_WORD_CHOICES + i
  );

  const selectClasses = cn(
    "w-full p-2 rounded-lg border-2 border-card-border bg-background text-white font-medium",
    "focus:outline-none focus:border-accent transition-colors",
    disabled && "opacity-50 cursor-not-allowed"
  );

  const labelClasses =
    "text-white/70 text-xs font-semibold uppercase tracking-wide";

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {/* Draw Time */}
        <div className="flex flex-col gap-1">
          <label className={labelClasses}>⏱️ Draw Time</label>
          <select
            value={settings.drawTimeSeconds}
            onChange={(e) =>
              onChange({ drawTimeSeconds: Number(e.target.value) })
            }
            disabled={disabled}
            className={selectClasses}
          >
            {ALLOWED_DRAW_TIMES.map((time) => (
              <option key={time} value={time}>
                {time}s
              </option>
            ))}
          </select>
        </div>

        {/* Rounds */}
        <div className="flex flex-col gap-1">
          <label className={labelClasses}>🔄 Rounds</label>
          <select
            value={settings.totalRounds}
            onChange={(e) => onChange({ totalRounds: Number(e.target.value) })}
            disabled={disabled}
            className={selectClasses}
          >
            {roundOptions.map((round) => (
              <option key={round} value={round}>
                {round}
              </option>
            ))}
          </select>
        </div>

        {/* Max Players */}
        <div className="flex flex-col gap-1">
          <label className={labelClasses}>⛹️ Max Players</label>
          <select
            value={settings.maxPlayers}
            onChange={(e) => onChange({ maxPlayers: Number(e.target.value) })}
            disabled={disabled}
            className={selectClasses}
          >
            {maxPlayerOptions.map((player) => (
              <option key={player} value={player}>
                {player}
              </option>
            ))}
          </select>
        </div>

        {/* Word Choices */}
        <div className="flex flex-col gap-1">
          <label className={labelClasses}>📝 Word Choices</label>
          <select
            value={settings.wordChoiceCount}
            onChange={(e) =>
              onChange({ wordChoiceCount: Number(e.target.value) })
            }
            disabled={disabled}
            className={selectClasses}
          >
            {wordChoiceOptions.map((count) => (
              <option key={count} value={count}>
                {count} words
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div className="flex flex-col gap-1">
          <label className={labelClasses}>🎯 Word Difficulty</label>
          <select
            value={settings.difficulty}
            onChange={(e) =>
              onChange({
                difficulty: e.target.value as RoomSettings["difficulty"],
              })
            }
            disabled={disabled}
            className={selectClasses}
          >
            {ALLOWED_DIFFICULTIES.map((diff) => (
              <option key={diff} value={diff}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white font-bold text-sm flex items-center gap-2">
        <span>⚙️</span> ROOM SETTINGS
      </h3>

      <div className="space-y-3">
        {/* Draw Time */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClasses}>⏱️ Draw Time (seconds)</label>
          <select
            value={settings.drawTimeSeconds}
            onChange={(e) =>
              onChange({ drawTimeSeconds: Number(e.target.value) })
            }
            disabled={disabled}
            className={selectClasses}
          >
            {ALLOWED_DRAW_TIMES.map((time) => (
              <option key={time} value={time}>
                {time} seconds
              </option>
            ))}
          </select>
        </div>

        {/* Rounds */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClasses}>🔄 Number of Rounds</label>
          <select
            value={settings.totalRounds}
            onChange={(e) => onChange({ totalRounds: Number(e.target.value) })}
            disabled={disabled}
            className={selectClasses}
          >
            {roundOptions.map((round) => (
              <option key={round} value={round}>
                {round} {round === 1 ? "round" : "rounds"}
              </option>
            ))}
          </select>
        </div>

        {/* Max Players */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClasses}>⛹️ Max Players</label>
          <select
            value={settings.maxPlayers}
            onChange={(e) => onChange({ maxPlayers: Number(e.target.value) })}
            disabled={disabled}
            className={selectClasses}
          >
            {maxPlayerOptions.map((player) => (
              <option key={player} value={player}>
                {player} players
              </option>
            ))}
          </select>
        </div>

        {/* Word Choices */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClasses}>📝 Word Choices</label>
          <select
            value={settings.wordChoiceCount}
            onChange={(e) =>
              onChange({ wordChoiceCount: Number(e.target.value) })
            }
            disabled={disabled}
            className={selectClasses}
          >
            {wordChoiceOptions.map((count) => (
              <option key={count} value={count}>
                {count} words to choose from
              </option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClasses}>🎯 Word Difficulty</label>
          <select
            value={settings.difficulty}
            onChange={(e) =>
              onChange({
                difficulty: e.target.value as RoomSettings["difficulty"],
              })
            }
            disabled={disabled}
            className={selectClasses}
          >
            {ALLOWED_DIFFICULTIES.map((diff) => (
              <option key={diff} value={diff}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
