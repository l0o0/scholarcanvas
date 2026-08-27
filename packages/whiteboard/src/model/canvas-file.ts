import {
  BOARD_ENGINE,
  parseBoardDocument,
  type BoardDocument,
  type BoardEdge,
  type BoardNode,
  type BoardNodeData,
  type BoardNodeKind,
  type BoardViewport,
} from "./snapshot";

export const CANVAS_FILE_VERSION = 1;
export type StoredCanvasFormat = "canvas" | "legacy";

export interface CanvasFileNode extends Record<string, unknown> {
  id: string;
  type: "text" | "group" | "file" | "link";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  label?: string;
  bamboo: {
    kind: BoardNodeKind;
    data: BoardNodeData;
  };
}

export interface CanvasFileEdge extends Record<string, unknown> {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
  label?: string;
  color?: string;
  bamboo?: {
    dashed?: boolean;
    arrow?: boolean;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  };
}

export interface CanvasFile extends Record<string, unknown> {
  version: typeof CANVAS_FILE_VERSION;
  nodes: CanvasFileNode[];
  edges: CanvasFileEdge[];
  bamboo: {
    schemaVersion: typeof CANVAS_FILE_VERSION;
    engine: typeof BOARD_ENGINE;
    title?: string;
    createdAt: string;
    updatedAt: string;
    viewport: BoardViewport;
  };
}

export interface CanvasFileOptions {
  title?: string;
  now?: string;
}

export interface ParsedStoredCanvas {
  format: StoredCanvasFormat;
  document: BoardDocument;
}

const DEFAULT_VIEWPORT: BoardViewport = { x: 0, y: 0, zoom: 1 };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function withoutKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  const blocked = new Set(keys);
  const entries = Object.entries(source).filter(([key]) => !blocked.has(key));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function nodeText(data: BoardNodeData): string {
  return [data.title, data.subtitle || data.preview]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function toCanvasNode(node: BoardNode): CanvasFileNode {
  return {
    ...(node.extra ?? {}),
    id: node.id,
    type: "text",
    x: node.position.x,
    y: node.position.y,
    width: node.width ?? 240,
    height: node.height ?? 120,
    text: nodeText(node.data),
    bamboo: {
      kind: node.data.kind,
      data: { ...node.data },
    },
  };
}

function toCanvasEdge(edge: BoardEdge): CanvasFileEdge {
  return {
    ...(edge.extra ?? {}),
    id: edge.id,
    fromNode: edge.source,
    toNode: edge.target,
    label: edge.label,
    color: edge.color,
    bamboo: {
      dashed: edge.dashed,
      arrow: edge.arrow,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    },
  };
}

export function boardDocumentToCanvasFile(
  document: BoardDocument,
  options: CanvasFileOptions = {},
): CanvasFile {
  const now = options.now ?? new Date().toISOString();
  const viewport = document.viewport ?? DEFAULT_VIEWPORT;
  return {
    ...(document.extra ?? {}),
    version: CANVAS_FILE_VERSION,
    nodes: document.nodes.map(toCanvasNode),
    edges: document.edges.map(toCanvasEdge),
    bamboo: {
      schemaVersion: CANVAS_FILE_VERSION,
      engine: BOARD_ENGINE,
      title: options.title ?? document.metadata?.title,
      createdAt: document.metadata?.createdAt ?? now,
      updatedAt: now,
      viewport: { ...viewport },
    },
  };
}

function canvasNodeToRuntime(node: unknown): Record<string, unknown> | null {
  const raw = asRecord(node);
  if (!raw || typeof raw.id !== "string") return null;
  if (typeof raw.x !== "number" || typeof raw.y !== "number") return null;

  const bamboo = asRecord(raw.bamboo);
  const bambooData = asRecord(bamboo?.data) ?? {};
  const kind =
    typeof bamboo?.kind === "string"
      ? bamboo.kind
      : typeof bambooData.kind === "string"
        ? bambooData.kind
        : "text";
  const fallbackText =
    typeof raw.text === "string"
      ? raw.text.split(/\n\s*\n/, 1)[0]
      : typeof raw.label === "string"
        ? raw.label
        : "Untitled";
  return {
    id: raw.id,
    type: kind,
    position: { x: raw.x, y: raw.y },
    width: typeof raw.width === "number" ? raw.width : 240,
    height: typeof raw.height === "number" ? raw.height : 120,
    data: {
      ...bambooData,
      kind,
      title:
        typeof bambooData.title === "string" ? bambooData.title : fallbackText,
    },
    extra: withoutKeys(raw, [
      "id",
      "type",
      "x",
      "y",
      "width",
      "height",
      "text",
      "label",
      "bamboo",
    ]),
  };
}

function canvasEdgeToRuntime(edge: unknown): Record<string, unknown> | null {
  const raw = asRecord(edge);
  if (
    !raw ||
    typeof raw.id !== "string" ||
    typeof raw.fromNode !== "string" ||
    typeof raw.toNode !== "string"
  ) {
    return null;
  }
  const bamboo = asRecord(raw.bamboo);
  return {
    id: raw.id,
    source: raw.fromNode,
    target: raw.toNode,
    sourceHandle:
      typeof bamboo?.sourceHandle === "string" ? bamboo.sourceHandle : null,
    targetHandle:
      typeof bamboo?.targetHandle === "string" ? bamboo.targetHandle : null,
    label: typeof raw.label === "string" ? raw.label : undefined,
    color: typeof raw.color === "string" ? raw.color : undefined,
    dashed: typeof bamboo?.dashed === "boolean" ? bamboo.dashed : undefined,
    arrow: typeof bamboo?.arrow === "boolean" ? bamboo.arrow : undefined,
    extra: withoutKeys(raw, [
      "id",
      "fromNode",
      "toNode",
      "fromSide",
      "toSide",
      "label",
      "color",
      "bamboo",
    ]),
  };
}

export function canvasFileToBoardDocument(value: unknown): BoardDocument {
  const file = asRecord(value);
  if (!file) return parseBoardDocument(null);
  const bamboo = asRecord(file.bamboo);
  const viewport = asRecord(bamboo?.viewport);
  const nodes = Array.isArray(file.nodes)
    ? file.nodes.map(canvasNodeToRuntime).filter(Boolean)
    : [];
  const edges = Array.isArray(file.edges)
    ? file.edges.map(canvasEdgeToRuntime).filter(Boolean)
    : [];
  return parseBoardDocument({
    v: 1,
    engine: BOARD_ENGINE,
    nodes,
    edges,
    viewport,
    metadata: {
      title: typeof bamboo?.title === "string" ? bamboo.title : undefined,
      createdAt:
        typeof bamboo?.createdAt === "string" ? bamboo.createdAt : undefined,
      updatedAt:
        typeof bamboo?.updatedAt === "string" ? bamboo.updatedAt : undefined,
    },
    extra: withoutKeys(file, ["version", "nodes", "edges", "bamboo"]),
  });
}

function parsedValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function parseStoredCanvas(value: unknown): ParsedStoredCanvas {
  const parsed = parsedValue(value);
  const root = asRecord(parsed);
  const bamboo = asRecord(root?.bamboo);
  if (bamboo?.schemaVersion === CANVAS_FILE_VERSION) {
    return {
      format: "canvas",
      document: canvasFileToBoardDocument(root),
    };
  }
  return { format: "legacy", document: parseBoardDocument(parsed) };
}

function legacyDocument(document: BoardDocument): Record<string, unknown> {
  return {
    ...(document.extra ?? {}),
    v: document.v,
    engine: document.engine,
    nodes: document.nodes.map((node) => ({
      ...(node.extra ?? {}),
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      width: node.width,
      height: node.height,
    })),
    edges: document.edges.map((edge) => ({
      ...(edge.extra ?? {}),
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
      dashed: edge.dashed,
      color: edge.color,
      arrow: edge.arrow,
    })),
    viewport: document.viewport,
    metadata: document.metadata,
  };
}

export function serializeStoredCanvas(
  document: BoardDocument,
  format: StoredCanvasFormat,
  options: CanvasFileOptions = {},
): string {
  const value =
    format === "canvas"
      ? boardDocumentToCanvasFile(document, options)
      : legacyDocument(document);
  return `${JSON.stringify(value, null, 2)}\n`;
}
