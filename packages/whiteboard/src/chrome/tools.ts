import type { CanvasNodeKind } from "../model/academic";

export type CanvasTool =
  | "select"
  | "hand"
  | "eraser"
  | Exclude<CanvasNodeKind, "item" | "pdf" | "attachment" | "quote">;

export function libraryTools(): CanvasTool[] {
  return ["literature"];
}

export function isPlaceTool(
  tool: CanvasTool,
): tool is Exclude<CanvasNodeKind, "item" | "pdf" | "attachment" | "quote"> {
  return tool !== "select" && tool !== "hand" && tool !== "eraser";
}
