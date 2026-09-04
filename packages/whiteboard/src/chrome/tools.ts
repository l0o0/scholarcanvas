import type { CanvasNodeKind } from "../model/academic";

export type CanvasTool = "select" | "hand" | "eraser" | CanvasNodeKind;

export function isPlaceTool(tool: CanvasTool): tool is CanvasNodeKind {
  return tool !== "select" && tool !== "hand" && tool !== "eraser";
}
