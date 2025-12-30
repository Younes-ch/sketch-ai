import type { Point } from "./point";

export interface DrawingCommand {
  type: "stroke" | "clear" | "undo" | "fill";
  points: Point[];
  color: string;
  width: number;
}