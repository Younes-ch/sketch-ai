import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Player } from "@/models";

interface WordSelectionOverlayProps {
  currentDrawer: Player | null;
  variant?: "desktop" | "mobile";
}

export function WordSelectionOverlay({
  currentDrawer,
  variant = "desktop",
}: WordSelectionOverlayProps) {
  const isMobile = variant === "mobile";

  return (
    <motion.div
      key={`wordSelection-${variant}`}
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
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
        className={cn(
          "font-bold text-white text-center",
          isMobile ? "text-lg mb-3 px-4" : "text-2xl mb-4"
        )}
      >
        {currentDrawer?.username} is choosing{isMobile ? "..." : " a word..."}
      </motion.h2>
      {/* Loading spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
        className={cn(
          "relative",
          isMobile ? "w-12 h-12 mb-2" : "w-16 h-16 mb-4"
        )}
      >
        <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-transparent border-t-accent rounded-full"></div>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            isMobile ? "text-xl" : "text-2xl"
          )}
        >
          🎨
        </div>
      </motion.div>
      <p className={cn("text-white/50", isMobile ? "text-xs" : "text-sm")}>
        Get ready to guess!
      </p>
    </motion.div>
  );
}
