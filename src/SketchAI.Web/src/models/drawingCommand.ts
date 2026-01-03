import type { Point } from "./point";

export interface DrawingCommand {
  type: "stroke" | "clear" | "fill";
  points: Point[];
  color: string;
  width: number;
  strokeId?: string;
}