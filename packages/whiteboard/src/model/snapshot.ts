/**
 * Versioned board document. Pure JSON, no Zotero types.
 * Later Zotero IDs live in node.data only (itemID, noteID, ...).
 */

export const BOARD_DOCUMENT_VERSION = 1;
export const BOARD_ENGINE = "xyflow" as const;

export type BoardNodeKind =
  | "item"
  | "note"
  | "pdf"
  | "attachment"
  | "text"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow";

export interface BoardNodeData {
  kind: BoardNodeKind;
  title: string;
  subtitle?: string;
  preview?: string;
  itemID?: number;
  noteID?: number;
  attachmentID?: number;
  pdfPage?: number;
  /** Data URL of a rendered PDF page snapshot. */
  image?: string;
  /** Relative path of the saved snapshot file inside the board assets dir. */
  asset?: string;
  /** Line/arrow start in node-local coordinates. */
  from?: { x: number; y: number };
  /** Line/arrow end in node-local coordinates. */
  to?: { x: number; y: number };
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  radius?: number;
  dashed?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  textColor?: string;
  textOpacity?: number;
  strokeOpacity?: number;
  fillStyle?: "none" | "solid" | "hatch";
  strokeStyle?: "solid" | "dotted" | "dashed";
  [key: string]: unknown;
}

export interface BoardNode {
  id: string;
  type: BoardNodeKind;
  position: { x: number; y: number };
  data: BoardNodeData;
  width?: number;
  height?: number;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  dashed?: boolean;
  color?: string;
  /** Legacy edges omit this field and render with an arrow. */
  arrow?: boolean;
}

export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardDocument {
  v: typeof BOARD_DOCUMENT_VERSION;
  engine: typeof BOARD_ENGINE;
  nodes: BoardNode[];
  edges: BoardEdge[];
  viewport?: BoardViewport;
}

export type WhiteboardSnapshot = BoardDocument;

const KINDS = new Set<BoardNodeKind>([
  "item",
  "note",
  "pdf",
  "attachment",
  "text",
  "rect",
  "ellipse",
  "line",
  "arrow",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parsePoint(value: unknown): { x: number; y: number } | undefined {
  const point = asRecord(value);
  if (!point || typeof point.x !== "number" || typeof point.y !== "number") {
    return undefined;
  }
  return { x: point.x, y: point.y };
}

function parseNode(value: unknown): BoardNode | null {
  const node = asRecord(value);
  if (!node || typeof node.id !== "string") return null;
  const type = node.type as BoardNodeKind;
  if (!KINDS.has(type)) return null;
  const position = asRecord(node.position);
  if (
    !position ||
    typeof position.x !== "number" ||
    typeof position.y !== "number"
  ) {
    return null;
  }
  const data = asRecord(node.data) ?? {};
  const kind = KINDS.has(data.kind as BoardNodeKind)
    ? (data.kind as BoardNodeKind)
    : type;
  return {
    id: node.id,
    type,
    position: { x: position.x, y: position.y },
    width: typeof node.width === "number" ? node.width : undefined,
    height: typeof node.height === "number" ? node.height : undefined,
    data: {
      kind,
      title: typeof data.title === "string" ? data.title : "Untitled",
      subtitle: typeof data.subtitle === "string" ? data.subtitle : undefined,
      preview: typeof data.preview === "string" ? data.preview : undefined,
      itemID: typeof data.itemID === "number" ? data.itemID : undefined,
      noteID: typeof data.noteID === "number" ? data.noteID : undefined,
      attachmentID:
        typeof data.attachmentID === "number" ? data.attachmentID : undefined,
      pdfPage: typeof data.pdfPage === "number" ? data.pdfPage : undefined,
      image: typeof data.image === "string" ? data.image : undefined,
      asset: typeof data.asset === "string" ? data.asset : undefined,
      from: parsePoint(data.from),
      to: parsePoint(data.to),
      stroke: typeof data.stroke === "string" ? data.stroke : undefined,
      fill: typeof data.fill === "string" ? data.fill : undefined,
      strokeWidth:
        typeof data.strokeWidth === "number" ? data.strokeWidth : undefined,
      radius: typeof data.radius === "number" ? data.radius : undefined,
      dashed: typeof data.dashed === "boolean" ? data.dashed : undefined,
      fontFamily:
        typeof data.fontFamily === "string" ? data.fontFamily : undefined,
      fontSize: typeof data.fontSize === "number" ? data.fontSize : undefined,
      fontWeight:
        data.fontWeight === "bold" || data.fontWeight === "normal"
          ? data.fontWeight
          : undefined,
      textAlign:
        data.textAlign === "left" ||
        data.textAlign === "center" ||
        data.textAlign === "right"
          ? data.textAlign
          : undefined,
      textColor:
        typeof data.textColor === "string" ? data.textColor : undefined,
      fontStyle:
        data.fontStyle === "italic" || data.fontStyle === "normal"
          ? data.fontStyle
          : undefined,
      textDecoration:
        data.textDecoration === "underline" ||
        data.textDecoration === "line-through" ||
        data.textDecoration === "none"
          ? data.textDecoration
          : undefined,
      verticalAlign:
        data.verticalAlign === "top" ||
        data.verticalAlign === "middle" ||
        data.verticalAlign === "bottom"
          ? data.verticalAlign
          : undefined,
      textOpacity:
        typeof data.textOpacity === "number" ? data.textOpacity : undefined,
      strokeOpacity:
        typeof data.strokeOpacity === "number" ? data.strokeOpacity : undefined,
      fillStyle:
        data.fillStyle === "none" ||
        data.fillStyle === "solid" ||
        data.fillStyle === "hatch"
          ? data.fillStyle
          : undefined,
      strokeStyle:
        data.strokeStyle === "solid" ||
        data.strokeStyle === "dotted" ||
        data.strokeStyle === "dashed"
          ? data.strokeStyle
          : undefined,
    },
  };
}

function parseEdge(value: unknown): BoardEdge | null {
  const edge = asRecord(value);
  if (!edge || typeof edge.id !== "string") return null;
  if (typeof edge.source !== "string" || typeof edge.target !== "string") {
    return null;
  }
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle:
      typeof edge.sourceHandle === "string" ? edge.sourceHandle : null,
    targetHandle:
      typeof edge.targetHandle === "string" ? edge.targetHandle : null,
    label: typeof edge.label === "string" ? edge.label : undefined,
    dashed: typeof edge.dashed === "boolean" ? edge.dashed : undefined,
    color: typeof edge.color === "string" ? edge.color : undefined,
    arrow: typeof edge.arrow === "boolean" ? edge.arrow : undefined,
  };
}

export function emptyBoard(): BoardDocument {
  return {
    v: BOARD_DOCUMENT_VERSION,
    engine: BOARD_ENGINE,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

/** Sample cards so an empty v1 tab is inspectable. Not bound to library items. */
export function demoBoard(): BoardDocument {
  return {
    v: BOARD_DOCUMENT_VERSION,
    engine: BOARD_ENGINE,
    viewport: { x: 80, y: 40, zoom: 1 },
    nodes: [
      {
        id: "demo-item",
        type: "item",
        position: { x: 40, y: 80 },
        data: {
          kind: "item",
          title: "Attention Is All You Need",
          subtitle: "Vaswani et al. · 2017 · journalArticle",
        },
      },
      {
        id: "demo-pdf",
        type: "pdf",
        position: { x: 360, y: 40 },
        data: {
          kind: "pdf",
          title: "Attention Is All You Need.pdf",
          subtitle: "Page 3",
          pdfPage: 3,
        },
      },
      {
        id: "demo-note",
        type: "note",
        position: { x: 40, y: 280 },
        data: {
          kind: "note",
          title: "Reading note",
          preview:
            "The scaled dot-product attention is the piece to reread against the later sparse variants.",
        },
      },
      {
        id: "demo-file",
        type: "attachment",
        position: { x: 360, y: 360 },
        data: {
          kind: "attachment",
          title: "supplement.zip",
          subtitle: "Linked file",
        },
      },
    ],
    edges: [
      {
        id: "e-item-pdf",
        source: "demo-item",
        target: "demo-pdf",
      },
      {
        id: "e-item-note",
        source: "demo-item",
        target: "demo-note",
      },
    ],
  };
}

export function parseBoardDocument(value: unknown): BoardDocument {
  const raw = asRecord(value);
  if (!raw) return emptyBoard();
  const nodes = Array.isArray(raw.nodes)
    ? raw.nodes.map(parseNode).filter((node): node is BoardNode => !!node)
    : [];
  const edges = Array.isArray(raw.edges)
    ? raw.edges.map(parseEdge).filter((edge): edge is BoardEdge => !!edge)
    : [];
  const viewport = asRecord(raw.viewport);
  return {
    v: BOARD_DOCUMENT_VERSION,
    engine: BOARD_ENGINE,
    nodes,
    edges,
    viewport:
      viewport &&
      typeof viewport.x === "number" &&
      typeof viewport.y === "number" &&
      typeof viewport.zoom === "number"
        ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
        : { x: 0, y: 0, zoom: 1 },
  };
}

export function createBoardNode(
  kind: BoardNodeKind,
  position: { x: number; y: number },
  id: string,
): BoardNode {
  const titles: Record<BoardNodeKind, BoardNodeData> = {
    item: { kind, title: "New item", subtitle: "Zotero item" },
    note: { kind, title: "New note", preview: "" },
    pdf: { kind, title: "PDF page", subtitle: "Page 1", pdfPage: 1 },
    attachment: { kind, title: "Attachment", subtitle: "File" },
    text: { kind, title: "Text" },
    rect: {
      kind,
      title: "",
      stroke: "#1f2937",
      fill: "#ffffff",
      strokeWidth: 2,
      radius: 8,
    },
    ellipse: {
      kind,
      title: "",
      stroke: "#1f2937",
      fill: "#ffffff",
      strokeWidth: 2,
    },
    line: { kind, title: "", stroke: "#1f2937", strokeWidth: 2 },
    arrow: { kind, title: "", stroke: "#1f2937", strokeWidth: 2 },
  };
  return { id, type: kind, position, data: titles[kind] };
}
