import { cn } from "@/lib/utils";
import type { Player } from "@/models";

interface PodiumProps {
  players: Player[];
}

export default function Podium({ players }: PodiumProps) {
  // Sort players by score and get top 3
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const topThree = sortedPlayers.slice(0, 3);

  // Podium positions: [1st place, 2nd place, 3rd place]
  // But we display them as [2nd, 1st, 3rd] for visual layout
  const first = topThree[0];
  const second = topThree[1];
  const third = topThree[2];

  const getMedalEmoji = (position: number) => {
    switch (position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  const getPodiumHeight = (position: number) => {
    switch (position) {
      case 1:
        return "h-24";
      case 2:
        return "h-16";
      case 3:
        return "h-12";
      default:
        return "h-8";
    }
  };

  const getPodiumColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-t from-yellow-600 to-yellow-400";
      case 2:
        return "bg-gradient-to-t from-gray-500 to-gray-300";
      case 3:
        return "bg-gradient-to-t from-amber-700 to-amber-500";
      default:
        return "bg-card-border";
    }
  };

  const renderPodiumPosition = (
    player: Player | undefined,
    position: number
  ) => {
    if (!player) return null;

    return (
      <div className="flex flex-col items-center">
        {/* Player info */}
        <div className="mb-2 text-center">
          <div className="text-3xl mb-1">{getMedalEmoji(position)}</div>
          <p
            className={cn(
              "font-bold truncate max-w-[100px]",
              position === 1 ? "text-lg text-yellow-400" : "text-sm text-white"
            )}
          >
            {player.username}
          </p>
          <p
            className={cn(
              "font-mono",
              position === 1 ? "text-yellow-300" : "text-white/70"
            )}
          >
            {player.score} pts
          </p>
        </div>
        {/* Podium block */}
        <div
          className={cn(
            "w-20 sm:w-24 rounded-t-lg flex items-end justify-center pb-2",
            getPodiumHeight(position),
            getPodiumColor(position)
          )}
        >
          <span className="text-2xl font-bold text-white/80">{position}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4 py-4">
      {/* 2nd place (left) */}
      {renderPodiumPosition(second, 2)}
      {/* 1st place (center) */}
      {renderPodiumPosition(first, 1)}
      {/* 3rd place (right) */}
      {renderPodiumPosition(third, 3)}
    </div>
  );
}
