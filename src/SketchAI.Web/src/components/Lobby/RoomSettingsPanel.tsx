import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  ALLOWED_DRAW_TIMES,
  ALLOWED_DIFFICULTIES,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_WORD_CHOICES,
  MAX_WORD_CHOICES,
  MIN_CUSTOM_WORDS,
  MAX_CUSTOM_WORDS_LENGTH,
  WORD_PRESETS,
  type RoomSettings,
  type WordSourceType,
} from "@/models";

// Debounce delay for custom words input (ms)
const CUSTOM_WORDS_DEBOUNCE_MS = 600;

interface RoomSettingsPanelProps {
  settings: RoomSettings;
  onChange: (settings: Partial<RoomSettings>) => void;
  disabled?: boolean;
  compact?: boolean;
}

// Helper to determine the current word source type
function getWordSourceType(settings: RoomSettings): WordSourceType {
  if (settings.customWords) return "custom";
  if (settings.wordPreset) return "preset";
  return "difficulty";
}

// Helper to validate custom words
function validateCustomWords(
  customWords: string,
  minCount: number
): { isValid: boolean; wordCount: number; error?: string } {
  if (!customWords.trim()) {
    return {
      isValid: false,
      wordCount: 0,
      error: "Enter at least " + minCount + " words",
    };
  }

  const words = customWords
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];

  if (uniqueWords.length < minCount) {
    return {
      isValid: false,
      wordCount: uniqueWords.length,
      error: `Need at least ${minCount} unique words (${uniqueWords.length} provided)`,
    };
  }

  const longWords = words.filter((w) => w.length > 50);
  if (longWords.length > 0) {
    return {
      isValid: false,
      wordCount: uniqueWords.length,
      error: "Words must be under 50 characters",
    };
  }

  return { isValid: true, wordCount: uniqueWords.length };
}

export default function RoomSettingsPanel({
  settings,
  onChange,
  disabled = false,
  compact = false,
}: RoomSettingsPanelProps) {
  const [wordSourceType, setWordSourceType] = useState<WordSourceType>(() =>
    getWordSourceType(settings)
  );

  // Ref for debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if we're currently typing (debouncing) to avoid syncing from server
  const [isTyping, setIsTyping] = useState(false);

  // Local draft value while typing - only used when isTyping is true
  const [draftCustomWords, setDraftCustomWords] = useState<string>("");

  // Derive the displayed value: use draft while typing, otherwise use server value
  const localCustomWords = isTyping
    ? draftCustomWords
    : settings.customWords ?? "";

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

  const minWordsRequired = Math.max(MIN_CUSTOM_WORDS, settings.wordChoiceCount);

  // Validate local custom words (for UI feedback)
  const customWordsValidation = useMemo(() => {
    if (wordSourceType !== "custom" || !localCustomWords) {
      return { isValid: true, wordCount: 0 };
    }
    return validateCustomWords(localCustomWords, minWordsRequired);
  }, [wordSourceType, localCustomWords, minWordsRequired]);

  // Handle custom words input change - debounced sync to parent
  const handleCustomWordsChange = useCallback(
    (value: string) => {
      setDraftCustomWords(value);
      setIsTyping(true);

      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer - only sync to server after user stops typing
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        setIsTyping(false);
        const validation = validateCustomWords(value, minWordsRequired);
        if (validation.isValid) {
          onChange({ customWords: value });
        }
      }, CUSTOM_WORDS_DEBOUNCE_MS);
    },
    [onChange, minWordsRequired]
  );

  const handleWordSourceChange = (newSourceType: WordSourceType) => {
    setWordSourceType(newSourceType);

    // Clear the other word source settings when switching
    if (newSourceType === "difficulty") {
      setDraftCustomWords("");
      setIsTyping(false);
      onChange({ wordPreset: undefined, customWords: undefined });
    } else if (newSourceType === "preset") {
      setDraftCustomWords("");
      setIsTyping(false);
      onChange({
        customWords: undefined,
        wordPreset: settings.wordPreset || WORD_PRESETS[0].id,
      });
    } else if (newSourceType === "custom") {
      // Don't send to server yet - wait until user has valid input
      // Just clear the preset
      onChange({ wordPreset: undefined });
    }
  };

  const selectClasses = cn(
    "w-full p-2 rounded-lg border-2 border-card-border bg-background text-white font-medium",
    "focus:outline-none focus:border-accent transition-colors",
    disabled && "opacity-50 cursor-not-allowed"
  );

  const labelClasses =
    "text-white/70 text-xs font-semibold uppercase tracking-wide";

  const tabClasses = (isActive: boolean) =>
    cn(
      "flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all",
      isActive
        ? "bg-accent text-white"
        : "bg-card-border/50 text-white/60 hover:bg-card-border hover:text-white/80"
    );

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

        {/* Word Source Tabs */}
        <div className="col-span-2 flex flex-col gap-2">
          <label className={labelClasses}>🎯 Word Source</label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handleWordSourceChange("difficulty")}
              disabled={disabled}
              className={tabClasses(wordSourceType === "difficulty")}
            >
              Difficulty
            </button>
            <button
              type="button"
              onClick={() => handleWordSourceChange("preset")}
              disabled={disabled}
              className={tabClasses(wordSourceType === "preset")}
            >
              Presets
            </button>
            <button
              type="button"
              onClick={() => handleWordSourceChange("custom")}
              disabled={disabled}
              className={tabClasses(wordSourceType === "custom")}
            >
              Custom
            </button>
          </div>

          {/* Conditional Content Based on Word Source */}
          {wordSourceType === "difficulty" && (
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
          )}

          {wordSourceType === "preset" && (
            <select
              value={settings.wordPreset || WORD_PRESETS[0].id}
              onChange={(e) => onChange({ wordPreset: e.target.value })}
              disabled={disabled}
              className={selectClasses}
            >
              {WORD_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.emoji} {preset.name}
                </option>
              ))}
            </select>
          )}

          {wordSourceType === "custom" && (
            <div className="flex flex-col gap-1">
              <textarea
                value={localCustomWords}
                onChange={(e) => handleCustomWordsChange(e.target.value)}
                placeholder="Enter words separated by commas (e.g., apple, banana, orange)"
                disabled={disabled}
                maxLength={MAX_CUSTOM_WORDS_LENGTH}
                className={cn(
                  selectClasses,
                  "resize-none h-20",
                  !customWordsValidation.isValid &&
                    localCustomWords &&
                    "border-danger"
                )}
              />
              <div className="flex justify-between text-xs">
                <span
                  className={cn(
                    customWordsValidation.isValid
                      ? "text-success"
                      : "text-danger"
                  )}
                >
                  {customWordsValidation.error ||
                    `${customWordsValidation.wordCount} words ✓`}
                </span>
                <span className="text-white/40">
                  {localCustomWords.length}/{MAX_CUSTOM_WORDS_LENGTH}
                </span>
              </div>
            </div>
          )}
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

        {/* Word Source Selection */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClasses}>🎯 Word Source</label>
          <div className="flex gap-1 mb-2">
            <button
              type="button"
              onClick={() => handleWordSourceChange("difficulty")}
              disabled={disabled}
              className={tabClasses(wordSourceType === "difficulty")}
            >
              By Difficulty
            </button>
            <button
              type="button"
              onClick={() => handleWordSourceChange("preset")}
              disabled={disabled}
              className={tabClasses(wordSourceType === "preset")}
            >
              Presets
            </button>
            <button
              type="button"
              onClick={() => handleWordSourceChange("custom")}
              disabled={disabled}
              className={tabClasses(wordSourceType === "custom")}
            >
              Custom Words
            </button>
          </div>

          {/* Conditional Content Based on Word Source */}
          {wordSourceType === "difficulty" && (
            <div className="flex flex-col gap-1.5">
              <label className={cn(labelClasses, "text-white/50")}>
                Select Difficulty Level
              </label>
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
          )}

          {wordSourceType === "preset" && (
            <div className="flex flex-col gap-1.5">
              <label className={cn(labelClasses, "text-white/50")}>
                Select Word Category
              </label>
              <select
                value={settings.wordPreset || WORD_PRESETS[0].id}
                onChange={(e) => onChange({ wordPreset: e.target.value })}
                disabled={disabled}
                className={selectClasses}
              >
                {WORD_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.emoji} {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {wordSourceType === "custom" && (
            <div className="flex flex-col gap-1.5">
              <label className={cn(labelClasses, "text-white/50")}>
                Enter Your Own Words
              </label>
              <textarea
                value={localCustomWords}
                onChange={(e) => handleCustomWordsChange(e.target.value)}
                placeholder="Enter words separated by commas (e.g., apple, banana, orange, grape, mango)"
                disabled={disabled}
                maxLength={MAX_CUSTOM_WORDS_LENGTH}
                className={cn(
                  selectClasses,
                  "resize-none h-24",
                  !customWordsValidation.isValid &&
                    localCustomWords &&
                    "border-danger"
                )}
              />
              <div className="flex justify-between text-xs">
                <span
                  className={cn(
                    customWordsValidation.isValid
                      ? "text-success"
                      : localCustomWords
                      ? "text-danger"
                      : "text-white/40"
                  )}
                >
                  {localCustomWords
                    ? customWordsValidation.error ||
                      `${customWordsValidation.wordCount} unique words ✓`
                    : `Minimum ${minWordsRequired} words required`}
                </span>
                <span className="text-white/40">
                  {localCustomWords.length}/{MAX_CUSTOM_WORDS_LENGTH}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
