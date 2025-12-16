// color palette for drawing
export const COLOR_PALETTE = [
  // Row 1 - Lighter shades
  "#FFFFFF", "#C1C1C1", "#EF130B", "#FF7100", "#FFE400", "#00CC00", "#00B2FF", "#231FD3", "#A300BA", "#DF69A7", "#FFAC8E", "#A0522D",
  // Row 2 - Darker shades
  "#000000", "#505050", "#740B07", "#C23800", "#E8A200", "#005510", "#00569E", "#0E0865", "#550069", "#A75574", "#63300D", "#E9C9A7",
] as const;

// Semantic drawing colors
export const DRAWING_COLORS = {
  DEFAULT: "#000000",
  ERASER: "#FFFFFF",
  WHITE: "#FFFFFF",
  BLACK: "#000000",
} as const;

// Decorative colors for UI elements (used in JoinScreen)
export const DECORATIVE_COLORS = [
  "bg-accent",
  "bg-success",
  "bg-info",
  "bg-danger",
  "bg-purple",
  "bg-warning",
  "bg-pink",
  "bg-cyan",
] as const;

// Color border styles for canvas elements
export const BORDER_COLORS = {
  WHITE_SWATCH: "2px solid #555",
  DEFAULT_SWATCH: "2px solid rgba(0,0,0,0.3)",
  BRUSH_SIZE: "2px solid rgba(255,255,255,0.3)",
} as const;
