import type { BoardNodeKind } from "../model/snapshot";

export type CanvasTool = "select" | "hand" | "eraser" | BoardNodeKind;

export function isPlaceTool(tool: CanvasTool): tool is BoardNodeKind {
  return tool !== "select" && tool !== "hand" && tool !== "eraser";
}
