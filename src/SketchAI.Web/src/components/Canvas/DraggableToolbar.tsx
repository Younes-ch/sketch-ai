import { useRef, useState, useCallback, memo, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import { VerticalToolbar } from "./VerticalToolbar";
import type { CanvasToolbarProps } from "./types";

interface DraggableToolbarProps extends CanvasToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function DraggableToolbarComponent({
  containerRef,
  ...toolbarProps
}: DraggableToolbarProps) {
  const toolbarPosition = useSettingsStore((s) => s.toolbarPosition);
  const setToolbarPosition = useSettingsStore((s) => s.setToolbarPosition);
  const resetToolbarPosition = useSettingsStore((s) => s.resetToolbarPosition);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  // Track the current position in pixels for smooth dragging
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );

  // Initialize position from stored percentage on mount using layout effect
  // This runs synchronously before paint, avoiding the flash
  useLayoutEffect(() => {
    if (position !== null) return; // Already initialized

    if (toolbarPosition && containerRef.current) {
      const container = containerRef.current;
      setPosition({
        x: (toolbarPosition.x / 100) * container.offsetWidth,
        y: (toolbarPosition.y / 100) * container.offsetHeight,
      });
    } else {
      setPosition({ x: 8, y: 8 });
    }
  }, [toolbarPosition, containerRef, position]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setIsPressed(false);

    if (!containerRef.current || !toolbarRef.current) return;

    const container = containerRef.current;
    const toolbar = toolbarRef.current;
    const containerRect = container.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();

    // Calculate position relative to container
    let x = toolbarRect.left - containerRect.left;
    let y = toolbarRect.top - containerRect.top;

    // Clamp to container bounds
    x = Math.max(0, Math.min(x, containerRect.width - toolbarRect.width));
    y = Math.max(0, Math.min(y, containerRect.height - toolbarRect.height));

    // Update local position state
    setPosition({ x, y });

    // Store as percentage for responsiveness across sessions
    const xPercent = (x / containerRect.width) * 100;
    const yPercent = (y / containerRect.height) * 100;
    setToolbarPosition({ x: xPercent, y: yPercent });
  }, [containerRef, setToolbarPosition]);

  const handleDoubleClick = useCallback(() => {
    resetToolbarPosition();
    setPosition({ x: 8, y: 8 });
  }, [resetToolbarPosition]);

  // Don't render until position is initialized
  if (position === null) {
    return null;
  }

  return (
    <motion.div
      ref={toolbarRef}
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={containerRef}
      onDragStart={() => {
        setIsDragging(true);
      }}
      onDragEnd={handleDragEnd}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onDoubleClick={handleDoubleClick}
      initial={false}
      animate={{
        x: position.x,
        y: position.y,
        scale: isDragging ? 0.95 : isPressed ? 0.97 : 1,
      }}
      transition={{
        scale: { type: "spring", stiffness: 400, damping: 25 },
        x: { duration: 0 },
        y: { duration: 0 },
      }}
      className={cn(
        "absolute left-0 top-0 z-10 select-none touch-none hidden lg:block",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      title="Drag to move • Double-click to reset"
    >
      <VerticalToolbar {...toolbarProps} isDragging={isDragging} />
    </motion.div>
  );
}

export const DraggableToolbar = memo(DraggableToolbarComponent);
