import type { Point } from "./point";

export interface DrawingCommand {
  type: "stroke" | "clear";
  points: Point[];
  color: string;
  width: number;
}