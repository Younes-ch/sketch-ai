import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RoundEndOverlayProps {
  currentWord: string | null;
  variant?: "desktop" | "mobile";
}

export function RoundEndOverlay({
  currentWord,
  variant = "desktop",
}: RoundEndOverlayProps) {
  const isMobile = variant === "mobile";

  return (
    <motion.div
      key={`roundEnd-${variant}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10",
        isMobile ? "rounded-xl" : "rounded-2xl"
      )}
    >
      <motion.h2
        initial={{ y: isMobile ? -20 : -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
        className={cn(
          "font-bold text-white",
          isMobile ? "text-lg mb-1" : "text-2xl mb-2"
        )}
      >
        Round Over!
      </motion.h2>
      <motion.p
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.2,
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
        className={cn(
          "text-accent",
          isMobile ? "text-lg mb-2" : "text-xl mb-4"
        )}
      >
        The word was:{" "}
        <span className={cn("font-bold", !isMobile && "text-2xl")}>
          {currentWord}
        </span>
      </motion.p>
      {/* Loading progress for next round */}
      <div
        className={cn(
          "flex items-center gap-2 text-white/60",
          isMobile && "text-sm"
        )}
      >
        <div
          className={cn(
            "border-2 border-white/30 border-t-white/70 rounded-full animate-spin",
            isMobile ? "w-3 h-3" : "w-4 h-4"
          )}
        ></div>
        <p>{isMobile ? "Next round..." : "Next round starting soon..."}</p>
      </div>
    </motion.div>
  );
}
