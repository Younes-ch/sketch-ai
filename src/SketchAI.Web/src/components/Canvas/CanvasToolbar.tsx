import { memo } from "react";
import MobileToolbar from "./MobileToolbar";
import DesktopToolbar from "./DesktopToolbar";
import type { CanvasToolbarProps } from "./types";

// Re-export types for backward compatibility
export type { ToolType, CanvasToolbarProps } from "./types";

function CanvasToolbarComponent(props: CanvasToolbarProps) {
  return (
    <>
      <MobileToolbar {...props} />
      <DesktopToolbar {...props} />
    </>
  );
}

// Memoize the toolbar to prevent re-renders from parent timer updates
const CanvasToolbar = memo(CanvasToolbarComponent);
export default CanvasToolbar;
