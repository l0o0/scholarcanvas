import type { BoardNodeKind } from "../model/snapshot";
import type { CanvasTool } from "./tools";

export const CLICK_THRESHOLD = 5;

export type DrawKind = "rect" | "ellipse" | "line" | "arrow";
export type StampKind = "item" | "note" | "pdf" | "attachment" | "text";

export interface Point {
  x: number;
  y: number;
}

export interface DrawFrame {
  position: Point;
  width: number;
  height: number;
  start: Point;
  end: Point;
}

const DEFAULT_BOX = { width: 120, height: 80 };
const DRAW_KINDS = new Set<DrawKind>(["rect", "ellipse", "line", "arrow"]);
const STAMP_KINDS = new Set<StampKind>([
  "item",
  "note",
  "pdf",
  "attachment",
  "text",
]);

export function isDrawTool(tool: CanvasTool): tool is DrawKind {
  return DRAW_KINDS.has(tool as DrawKind);
}

export function isStampTool(tool: CanvasTool): tool is StampKind {
  return STAMP_KINDS.has(tool as StampKind);
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function snapTo45(origin: Point, current: Point): Point {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const cos = Math.cos(snapped);
  const sin = Math.sin(snapped);
  if (Math.abs(cos) < 1e-8) return { x: origin.x, y: current.y };
  if (Math.abs(sin) < 1e-8) return { x: current.x, y: origin.y };
  const len = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: origin.x + Math.sign(cos) * len,
    y: origin.y + Math.sign(sin) * len,
  };
}

export function frameFromDrag(
  origin: Point,
  current: Point,
  options: { kind: DrawKind; shift?: boolean },
): DrawFrame {
  if (distance(origin, current) <= CLICK_THRESHOLD) {
    if (options.kind === "line" || options.kind === "arrow") {
      return {
        position: { x: origin.x, y: origin.y },
        width: DEFAULT_BOX.width,
        height: 0,
        start: { x: 0, y: 0 },
        end: { x: DEFAULT_BOX.width, y: 0 },
      };
    }
    return {
      position: { x: origin.x, y: origin.y },
      width: DEFAULT_BOX.width,
      height: DEFAULT_BOX.height,
      start: { x: 0, y: 0 },
      end: { x: DEFAULT_BOX.width, y: DEFAULT_BOX.height },
    };
  }

  let end = current;
  if (options.shift && (options.kind === "line" || options.kind === "arrow")) {
    end = snapTo45(origin, current);
  } else if (
    options.shift &&
    (options.kind === "rect" || options.kind === "ellipse")
  ) {
    const dx = current.x - origin.x;
    const dy = current.y - origin.y;
    const size = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    end = {
      x: origin.x + (dx < 0 ? -size : size),
      y: origin.y + (dy < 0 ? -size : size),
    };
  }

  const x = Math.min(origin.x, end.x);
  const y = Math.min(origin.y, end.y);
  const width = Math.abs(end.x - origin.x);
  const height = Math.abs(end.y - origin.y);
  return {
    position: { x, y },
    width,
    height,
    start: { x: origin.x - x, y: origin.y - y },
    end: { x: end.x - x, y: end.y - y },
  };
}

export function toolShortcut(key: string): CanvasTool | null {
  switch (key.toLowerCase()) {
    case "v":
      return "select";
    case "h":
      return "hand";
    case "e":
      return "eraser";
    case "r":
      return "rect";
    case "o":
      return "ellipse";
    case "a":
      return "arrow";
    case "l":
      return "line";
    case "t":
      return "text";
    default:
      return null;
  }
}

export function isLibraryKind(
  kind: BoardNodeKind,
): kind is "item" | "note" | "pdf" | "attachment" {
  return (
    kind === "item" ||
    kind === "note" ||
    kind === "pdf" ||
    kind === "attachment"
  );
}

export function toolAfterDraw(_kind: DrawKind): CanvasTool {
  return "select";
}

export function isBorderHit(
  local: Point,
  box: { width: number; height: number; kind: BoardNodeKind },
  threshold = 8,
): boolean {
  const width = Math.max(box.width, 1);
  const height = Math.max(box.height, 1);
  if (box.kind === "line" || box.kind === "arrow") return true;
  if (box.kind === "ellipse") {
    const nx = (local.x - width / 2) / (width / 2);
    const ny = (local.y - height / 2) / (height / 2);
    const r = Math.hypot(nx, ny);
    const inner = 1 - (threshold * 2) / Math.min(width, height);
    return r >= Math.max(inner, 0.55) && r <= 1.15;
  }
  const inset =
    local.x >= threshold &&
    local.x <= width - threshold &&
    local.y >= threshold &&
    local.y <= height - threshold;
  return !inset;
}
