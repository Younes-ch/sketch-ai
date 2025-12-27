import { useCallback, useEffect } from "react";
import { useAudioStore, type SoundName } from "@/stores/audioStore";
import { logger } from "@/lib/logger";

// Sound file paths
const SOUND_PATHS: Record<SoundName, string> = {
  "correct-guess": "/sounds/correct-guess.mp3",
  "round-start": "/sounds/round-start.mp3",
  "round-end": "/sounds/round-end.mp3",
  tick: "/sounds/tick.mp3",
  "player-join": "/sounds/player-join.mp3",
  "player-leave": "/sounds/player-leave.mp3",
  "game-end": "/sounds/game-end.mp3",
  "drum-roll": "/sounds/drum-roll.mp3",
  "podium-reveal": "/sounds/podium-reveal.mp3",
  "close-guess": "/sounds/close-guess.mp3",
  countdown: "/sounds/countdown.mp3",
};

// Singleton audio cache to avoid re-creating Audio objects
const audioCache = new Map<SoundName, HTMLAudioElement>();

// Singleton map to track ALL currently playing sounds (shared across all useAudio instances)
// Uses an array to track multiple instances of the same sound
const playingAudio = new Map<SoundName, HTMLAudioElement[]>();

// Preload all sounds
function preloadSounds() {
  Object.entries(SOUND_PATHS).forEach(([name, path]) => {
    if (!audioCache.has(name as SoundName)) {
      const audio = new Audio(path);
      audio.preload = "auto";
      audioCache.set(name as SoundName, audio);
    }
  });
}

export function useAudio() {
  const isMuted = useAudioStore((s) => s.isMuted);
  const volume = useAudioStore((s) => s.volume);
  const toggleMute = useAudioStore((s) => s.toggleMute);
  const setVolume = useAudioStore((s) => s.setVolume);

  // Preload sounds on mount
  useEffect(() => {
    preloadSounds();
  }, []);

  // Update volume on all cached audio elements
  useEffect(() => {
    audioCache.forEach((audio) => {
      audio.volume = volume;
    });
  }, [volume]);

  const play = useCallback(
    (soundName: SoundName, options?: { loop?: boolean }) => {
      if (isMuted) return;

      const cachedAudio = audioCache.get(soundName);
      if (!cachedAudio) {
        logger.warn(`Sound not found: ${soundName}`);
        return;
      }

      // Clone the audio to allow overlapping sounds
      const audio = cachedAudio.cloneNode(true) as HTMLAudioElement;
      audio.volume = volume;
      audio.loop = options?.loop ?? false;

      // Track for stopping (using shared singleton map with array)
      const existing = playingAudio.get(soundName) ?? [];
      existing.push(audio);
      playingAudio.set(soundName, existing);

      audio.play().catch((err) => {
        // Autoplay might be blocked by browser
        logger.debug(`Could not play sound ${soundName}:`, err);
      });

      // Clean up when done
      audio.onended = () => {
        const arr = playingAudio.get(soundName);
        if (arr) {
          const idx = arr.indexOf(audio);
          if (idx > -1) arr.splice(idx, 1);
          if (arr.length === 0) playingAudio.delete(soundName);
        }
      };

      return audio;
    },
    [isMuted, volume]
  );

  const stop = useCallback((soundName: SoundName) => {
    const audioArr = playingAudio.get(soundName);
    if (audioArr) {
      // Stop ALL instances of this sound
      audioArr.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      playingAudio.delete(soundName);
    }
  }, []);

  const stopAll = useCallback(() => {
    playingAudio.forEach((audioArr) => {
      audioArr.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    });
    playingAudio.clear();
  }, []);

  return {
    play,
    stop,
    stopAll,
    isMuted,
    volume,
    toggleMute,
    setVolume,
  };
}
