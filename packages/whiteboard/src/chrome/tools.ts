import type { CanvasNodeKind } from "../model/academic";

export type CanvasTool =
  | "select"
  | "hand"
  | "eraser"
  | "roundedRect"
  | "diamond"
  | Exclude<CanvasNodeKind, "item" | "pdf" | "attachment" | "quote">;

export function libraryTools(): CanvasTool[] {
  return ["literature"];
}

export function isPlaceTool(
  tool: CanvasTool,
): tool is
  | Exclude<CanvasNodeKind, "item" | "pdf" | "attachment" | "quote">
  | "roundedRect"
  | "diamond" {
  return tool !== "select" && tool !== "hand" && tool !== "eraser";
}
