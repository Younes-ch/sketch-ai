import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { defaultRoomSettings, WORD_PRESETS, type RoomSettings } from "@/models";
import RoomSettingsPanel from "./RoomSettingsPanel";
import { Button, Input } from "@/components/ui";
import { CaptchaWidget } from "@/components/Common/CaptchaWidget";
import { useCaptcha } from "@/hooks/useCaptcha";

interface CreateRoomTabProps {
  roomName: string;
  onRoomNameChange: (name: string) => void;
  isPublicRoom: boolean;
  onTogglePublic: () => void;
  onSubmit: (
    e: React.FormEvent,
    settings: RoomSettings,
    captchaToken?: string,
  ) => void;
  isJoining: boolean;
  isDisabled: boolean;
  error: string | null;
}

function getWordSourceSummary(settings: RoomSettings): string {
  if (settings.customWords) {
    const wordCount = settings.customWords
      .split(",")
      .filter((w) => w.trim().length > 0).length;
    return `${wordCount} custom words`;
  }
  if (settings.wordPreset) {
    const preset = WORD_PRESETS.find((p) => p.id === settings.wordPreset);
    return preset ? `${preset.emoji} ${preset.name}` : settings.wordPreset;
  }
  return (
    settings.difficulty.charAt(0).toUpperCase() + settings.difficulty.slice(1)
  );
}

function isCustomWordsValid(settings: RoomSettings): boolean {
  if (!settings.customWords) return true;
  const words = settings.customWords
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  const uniqueWords = [...new Set(words.map((w) => w.toLowerCase()))];
  return uniqueWords.length >= Math.max(3, settings.wordChoiceCount);
}

export default function CreateRoomTab({
  roomName,
  onRoomNameChange,
  isPublicRoom,
  onTogglePublic,
  onSubmit,
  isJoining,
  isDisabled,
  error,
}: CreateRoomTabProps) {
  const [settings, setSettings] = useState<RoomSettings>({
    ...defaultRoomSettings,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(
    undefined,
  );
  const { isEnabled: isCaptchaEnabled } = useCaptcha();

  const handleSettingsChange = (updates: Partial<RoomSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(undefined);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    onSubmit(e, settings, captchaToken);
  };

  const wordSourceSummary = useMemo(
    () => getWordSourceSummary(settings),
    [settings],
  );

  const hasValidCustomWords = useMemo(
    () => isCustomWordsValid(settings),
    [settings],
  );

  const isRoomNameValid =
    roomName.trim().length >= 3 && roomName.trim().length <= 30;
  const isCaptchaValid = !isCaptchaEnabled || !!captchaToken;
  const isFormDisabled =
    isDisabled || !hasValidCustomWords || !isRoomNameValid || !isCaptchaValid;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Room Name Input */}
      <div className="space-y-2">
        <label className="text-white/70 text-sm font-medium">Room Name</label>
        <Input
          type="text"
          value={roomName}
          onChange={(e) => onRoomNameChange(e.target.value)}
          placeholder="My Awesome Room"
          maxLength={30}
          className="w-full"
        />
        <p className="text-white/40 text-xs">
          {roomName.trim().length}/30 characters (min 3)
        </p>
      </div>

      {/* Public/Private Toggle */}
      <div className="flex items-center justify-between bg-background rounded-2xl p-4 border-2 border-card-border">
        <div className="flex items-center gap-2">
          <span className="text-xl">{isPublicRoom ? "🌍" : "🔒"}</span>
          <div>
            <p className="text-white font-bold text-sm">
              {isPublicRoom ? "Public Room" : "Private Room"}
            </p>
            <p className="text-white/50 text-xs">
              {isPublicRoom
                ? "Anyone can find and join"
                : "Only with room code"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTogglePublic}
          className={cn(
            "relative w-14 h-8 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            isPublicRoom ? "bg-success" : "bg-card-border",
          )}
        >
          <div
            className={cn(
              "absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-200",
              isPublicRoom ? "translate-x-7" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {/* Settings Toggle */}
      <Button
        type="button"
        variant="ghost"
        size="lg"
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center justify-between bg-background rounded-2xl p-4 border-2 border-card-border hover:border-accent transition-colors h-auto w-full"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <div className="text-left">
            <p className="text-white font-bold text-sm">Room Settings</p>
            <p className="text-white/50 text-xs">
              {settings.totalRounds} round
              {settings.totalRounds === 1 ? "" : "s"} • {settings.maxPlayers}{" "}
              players max • {settings.drawTimeSeconds}s • {wordSourceSummary}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "text-white/60 transition-transform duration-200",
            showSettings && "rotate-180",
          )}
        >
          ▼
        </span>
      </Button>

      {/* Expandable Settings Panel */}
      {showSettings && (
        <div className="bg-background rounded-2xl p-4 border-2 border-card-border animate-in slide-in-from-top-2 fade-in-0">
          <RoomSettingsPanel
            settings={settings}
            onChange={handleSettingsChange}
          />
        </div>
      )}

      {error && (
        <div className="bg-danger/20 border-2 border-danger rounded-xl p-3 text-danger text-sm animate-in slide-in-from-top-2 fade-in-0">
          {error}
        </div>
      )}

      {!hasValidCustomWords && settings.customWords && (
        <div className="bg-warning/20 border-2 border-warning rounded-xl p-3 text-warning text-sm animate-in slide-in-from-top-2 fade-in-0">
          Please add at least {Math.max(3, settings.wordChoiceCount)} unique
          custom words to create a room
        </div>
      )}

      {/* CAPTCHA Widget */}
      <CaptchaWidget
        onSuccess={handleCaptchaSuccess}
        onExpire={handleCaptchaExpire}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isJoining}
        disabled={isFormDisabled}
        className="mt-2 text-xl font-black w-full"
      >
        {isJoining ? "Creating..." : "CREATE & PLAY!"}
      </Button>
    </form>
  );
}
