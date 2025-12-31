import type { Point } from "@/models";

// Canvas dimensions - drawing commands use normalized coordinates (0-1)
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const CANVAS_ASPECT_RATIO = CANVAS_WIDTH / CANVAS_HEIGHT;

// Clamp a point to canvas bounds to prevent out-of-bounds coordinates
export const clampPoint = (point: Point): Point => ({
  x: Math.max(0, Math.min(CANVAS_WIDTH, point.x)),
  y: Math.max(0, Math.min(CANVAS_HEIGHT, point.y)),
});

// Normalize a point from canvas coordinates to 0-1 range for network transmission
export const normalizePoint = (point: Point): Point => ({
  x: point.x / CANVAS_WIDTH,
  y: point.y / CANVAS_HEIGHT,
});

// Denormalize a point from 0-1 range to canvas coordinates for rendering
export const denormalizePoint = (point: Point): Point => ({
  x: Math.max(0, Math.min(1, point.x)) * CANVAS_WIDTH,
  y: Math.max(0, Math.min(1, point.y)) * CANVAS_HEIGHT,
});

// Extract client coordinates from mouse or touch event
export const getClientCoords = (
  e: React.MouseEvent | React.TouchEvent
): { clientX: number; clientY: number } | null => {
  if ("touches" in e) {
    if (e.touches.length === 0) return null;
    return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
};

// RGBA color tuple type
type RGBA = [number, number, number, number];

// Convert hex color to RGBA tuple
export const hexToRgb = (hex: string): RGBA => {
  // Expand shorthand (#FFF -> #FFFFFF)
  const normalized = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, '#$1$1$2$2$3$3');
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), 255]
    : [0, 0, 0, 255];
};

// Get pixel color from image data at specified coordinates
export const getPixelColor = (
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number
): RGBA => {
  const idx = (y * width + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
};

// Set pixel color in image data at specified coordinates
export const setPixelColor = (
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  color: RGBA
) => {
  const idx = (y * width + x) * 4;
  data[idx] = color[0];
  data[idx + 1] = color[1];
  data[idx + 2] = color[2];
  data[idx + 3] = color[3];
};

// Check if two colors match within a tolerance (inline for performance)
const colorsMatchInline = (
  data: Uint8ClampedArray,
  idx: number,
  targetR: number,
  targetG: number,
  targetB: number,
  targetA: number,
  tolerance: number
): boolean => {
  return (
    Math.abs(data[idx] - targetR) <= tolerance &&
    Math.abs(data[idx + 1] - targetG) <= tolerance &&
    Math.abs(data[idx + 2] - targetB) <= tolerance &&
    Math.abs(data[idx + 3] - targetA) <= tolerance
  );
};

/**
 * Optimized scanline flood fill algorithm.
 * Uses Uint32Array bitmap for O(1) visited checks instead of Set<string>.
 * Fills entire scanlines at once for better cache locality.
 * ~20-50x faster than the naive stack-based approach.
 */
export const floodFill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string
) => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  // Round to integer coordinates
  startX = Math.floor(startX);
  startY = Math.floor(startY);
  
  // Bounds check
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Get target color at start position
  const startIdx = (startY * width + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];
  
  // Get fill color
  const fillRgb = hexToRgb(fillColor);
  const [fillR, fillG, fillB, fillA] = fillRgb;
  
  // Don't fill if already the same color (with tight tolerance)
  if (
    Math.abs(targetR - fillR) <= 10 &&
    Math.abs(targetG - fillG) <= 10 &&
    Math.abs(targetB - fillB) <= 10 &&
    Math.abs(targetA - fillA) <= 10
  ) {
    return;
  }
  
  const tolerance = 32;
  
  // Use Uint32Array bitmap for visited tracking (1 bit per pixel, packed into 32-bit ints)
  // This is much faster than Set<string> due to no string allocations
  const visited = new Uint32Array(Math.ceil((width * height) / 32));
  
  const isVisited = (x: number, y: number): boolean => {
    const pixelIndex = y * width + x;
    const arrayIndex = pixelIndex >>> 5; // Divide by 32
    const bitIndex = pixelIndex & 31; // Mod 32
    return (visited[arrayIndex] & (1 << bitIndex)) !== 0;
  };
  
  const setVisited = (x: number, y: number): void => {
    const pixelIndex = y * width + x;
    const arrayIndex = pixelIndex >>> 5;
    const bitIndex = pixelIndex & 31;
    visited[arrayIndex] |= 1 << bitIndex;
  };
  
  const matchesTarget = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    return colorsMatchInline(data, idx, targetR, targetG, targetB, targetA, tolerance);
  };
  
  const fillPixel = (x: number, y: number): void => {
    const idx = (y * width + x) * 4;
    data[idx] = fillR;
    data[idx + 1] = fillG;
    data[idx + 2] = fillB;
    data[idx + 3] = fillA;
  };
  
  // Scanline flood fill using span-based approach
  const stack: [number, number, number][] = []; // [x1, x2, y]
  
  // Find initial span
  let x1 = startX;
  let x2 = startX;
  
  // Extend left
  while (x1 > 0 && matchesTarget(x1 - 1, startY)) x1--;
  // Extend right
  while (x2 < width - 1 && matchesTarget(x2 + 1, startY)) x2++;
  
  // Fill initial span
  for (let x = x1; x <= x2; x++) {
    fillPixel(x, startY);
    setVisited(x, startY);
  }
  
  // Add spans above and below
  if (startY > 0) stack.push([x1, x2, startY - 1]);
  if (startY < height - 1) stack.push([x1, x2, startY + 1]);
  
  while (stack.length > 0) {
    const [parentX1, parentX2, y] = stack.pop()!;
    
    let x = parentX1;
    
    while (x <= parentX2) {
      // Skip already visited or non-matching pixels
      while (x <= parentX2 && (isVisited(x, y) || !matchesTarget(x, y))) {
        x++;
      }
      
      if (x > parentX2) break;
      
      // Found start of a new span
      let spanX1 = x;
      
      // Extend left beyond parent span
      while (spanX1 > 0 && !isVisited(spanX1 - 1, y) && matchesTarget(spanX1 - 1, y)) {
        spanX1--;
      }
      
      // Extend right
      let spanX2 = x;
      while (spanX2 < width - 1 && !isVisited(spanX2 + 1, y) && matchesTarget(spanX2 + 1, y)) {
        spanX2++;
      }
      
      // Fill this span
      for (let fx = spanX1; fx <= spanX2; fx++) {
        fillPixel(fx, y);
        setVisited(fx, y);
      }
      
      // Add spans above and below
      if (y > 0) stack.push([spanX1, spanX2, y - 1]);
      if (y < height - 1) stack.push([spanX1, spanX2, y + 1]);
      
      // Move past this span
      x = spanX2 + 1;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
};
