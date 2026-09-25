import type { CanvasNodeKind } from "../model/academic";
import type { CanvasNodeStyle } from "../model/core";
import type { CanvasTool } from "./tools";
import { BUILTIN_NOTE_TEMPLATE_IDS } from "../model/note-template";

export const CLICK_THRESHOLD = 5;

export type DrawShapeKind = "rect" | "roundedRect" | "ellipse" | "diamond";
export type DrawKind = DrawShapeKind | "line" | "arrow";
export type StampKind =
  "item" | "pdf" | "attachment" | "text" | "note" | "frame";

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
const DRAW_KINDS = new Set<DrawKind>([
  "rect",
  "roundedRect",
  "ellipse",
  "diamond",
  "line",
  "arrow",
]);
const STAMP_KINDS = new Set<StampKind>([
  "item",
  "note",
  "pdf",
  "attachment",
  "text",
  "frame",
]);

export function isDrawTool(tool: CanvasTool): tool is DrawKind {
  return DRAW_KINDS.has(tool as DrawKind);
}

/** Map toolbar variants to the persisted basic node kind. */
export function drawNodeKind(
  kind: DrawKind,
): "rect" | "ellipse" | "line" | "arrow" {
  return kind === "roundedRect" || kind === "diamond" ? "rect" : kind;
}

/** Return only the style needed to represent a toolbar variant. */
export function drawNodeStyle(
  kind: DrawKind,
): Partial<CanvasNodeStyle> | undefined {
  if (kind === "rect") return { radius: 0 };
  if (kind === "roundedRect") return { radius: 16 };
  if (kind === "diamond") return { shape: "diamond", radius: 0 };
  return undefined;
}

export function isStampTool(
  tool: CanvasTool | CanvasNodeKind,
): tool is StampKind {
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
  } else if (options.shift) {
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
    case "q":
    case "c":
      return "note";
    case "f":
      return "frame";
    default:
      return null;
  }
}

export function isLibraryKind(
  kind: CanvasNodeKind,
): kind is "item" | "pdf" | "attachment" {
  return kind === "item" || kind === "pdf" || kind === "attachment";
}

export function shouldEditOnCreate(kind: StampKind): boolean {
  return kind === "text" || kind === "note" || kind === "frame";
}

export function noteTemplateShortcut(key: string): string | null {
  if (key.toLowerCase() === "q") return BUILTIN_NOTE_TEMPLATE_IDS.question;
  if (key.toLowerCase() === "c") return BUILTIN_NOTE_TEMPLATE_IDS.claim;
  return null;
}

export function toolAfterDraw(_kind: DrawKind): CanvasTool {
  return "select";
}

export function isBorderHit(
  local: Point,
  box: {
    width: number;
    height: number;
    kind: CanvasNodeKind;
    shape?: CanvasNodeStyle["shape"];
  },
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
  if (box.kind === "rect" && box.shape === "diamond") {
    const nx = (local.x - width / 2) / (width / 2);
    const ny = (local.y - height / 2) / (height / 2);
    const distance = Math.abs(nx) + Math.abs(ny);
    const border = threshold / Math.min(width / 2, height / 2);
    return distance >= 1 - border;
  }
  const inset =
    local.x >= threshold &&
    local.x <= width - threshold &&
    local.y >= threshold &&
    local.y <= height - threshold;
  return !inset;
}
