import { useEffect, useRef } from "react";
import { useAudio } from "@/hooks/useAudio";
import { useGameStore } from "@/stores/gameStore";
import { useChatStore } from "@/stores/chatStore";
import { useRoomStore } from "@/stores/roomStore";

// Module-level tracking to prevent duplicate sounds across StrictMode double-mounts
let lastTickSecond: number | null = null;

/**
 * Hook that plays audio effects based on game events.
 * This should be used once in the app, typically in a top-level component.
 */
export function useGameAudio() {
  const { play, stop } = useAudio();
  
  // Game state subscriptions
  const phase = useGameStore((s) => s.phase);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const playersWhoGuessed = useGameStore((s) => s.playersWhoGuessed);
  
  // Track previous values for change detection
  const prevPhaseRef = useRef(phase);
  const prevPlayersWhoGuessedRef = useRef(playersWhoGuessed.size);
  const prevPlayersRef = useRef<string[]>([]);
  
  // Track tick timer
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to player join/leave
  const players = useRoomStore((s) => s.players);

  // Subscribe to chat for close guesses
  const messages = useChatStore((s) => s.messages);
  const lastMessageRef = useRef<string | null>(null);

  // Phase change sounds
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    
    if (phase !== prevPhase) {
      // Stop any ticking when phase changes
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      stop("tick");

      switch (phase) {
        case "drawing":
          if (prevPhase === "wordSelection") {
            play("round-start");
          }
          break;
        case "roundEnd":
          play("round-end");
          break;
        case "gameEnd":
          play("game-end");
          break;
      }
    }
    
    prevPhaseRef.current = phase;
  }, [phase, play, stop]);

  // Timer warning ticks (last 10 seconds) - only play once per second
  useEffect(() => {
    if (phase === "drawing" && timeRemaining <= 10 && timeRemaining > 0) {
      // Only play if this is a new second (avoid playing multiple times per second)
      // Uses module-level variable to prevent StrictMode double-mount issues
      if (lastTickSecond !== timeRemaining) {
        lastTickSecond = timeRemaining;
        play("tick");
      }
    } else {
      // Reset when not in tick range
      lastTickSecond = null;
    }
  }, [phase, timeRemaining, play]);

  // Correct guess sound
  useEffect(() => {
    const currentSize = playersWhoGuessed.size;
    const prevSize = prevPlayersWhoGuessedRef.current;
    
    if (currentSize > prevSize && phase === "drawing") {
      play("correct-guess");
    }
    
    prevPlayersWhoGuessedRef.current = currentSize;
  }, [playersWhoGuessed, phase, play]);

  // Player join/leave sounds
  useEffect(() => {
    const currentPlayerNames = players.map((p) => p.username);
    const prevPlayerNames = prevPlayersRef.current;

    // Check for new players
    const joined = currentPlayerNames.filter(
      (name) => !prevPlayerNames.includes(name)
    );
    const left = prevPlayerNames.filter(
      (name) => !currentPlayerNames.includes(name)
    );

    // Only play sounds if there was a previous state (not initial load)
    if (prevPlayerNames.length > 0) {
      if (joined.length > 0) {
        play("player-join");
      }
      if (left.length > 0) {
        play("player-leave");
      }
    }

    prevPlayersRef.current = currentPlayerNames;
  }, [players, play]);

  // Close guess sound
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Only play if it's a new message and it's a close guess
    if (lastMessage.id !== lastMessageRef.current && lastMessage.type === "close-guess") {
      play("close-guess");
    }
    
    lastMessageRef.current = lastMessage.id;
  }, [messages, play]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, []);
}
