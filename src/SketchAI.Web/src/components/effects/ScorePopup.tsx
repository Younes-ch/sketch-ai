import { motion, AnimatePresence } from "framer-motion";

interface ScorePopupProps {
  show: boolean;
  points: number;
  position?: { x: number; y: number };
}

export function ScorePopup({ show, points, position }: ScorePopupProps) {
  const isPositive = points > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="score-popup"
          initial={{ opacity: 0, y: 0, scale: 0.5, x: "-50%" }}
          animate={{ opacity: 1, y: -30, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: -60, scale: 0.8, x: "-50%" }}
          transition={{
            duration: 0.6,
            ease: "easeOut",
          }}
          className={`absolute pointer-events-none font-black text-xl whitespace-nowrap z-100 ${
            isPositive ? "text-success" : "text-danger"
          }`}
          style={{
            left: position?.x ?? 0,
            top: position?.y ?? -8,
          }}
        >
          {isPositive ? "+" : ""}
          {points}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
