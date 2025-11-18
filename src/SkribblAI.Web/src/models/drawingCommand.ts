import type { Point } from "./point";

export interface DrawingCommand {
  type: string;
  points: Point[];
  color: string;
  width: number;
}