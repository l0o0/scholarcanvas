import type {
  CanvasNode,
  LiteratureSnapshot,
  LiteratureSource,
  NoteSource,
  NoteSourceSnapshot,
  QuoteSnapshot,
  QuoteSource,
  ZoteroLibraryRef,
} from "./academic";
import type {
  AttachmentNodeData,
  ItemNodeData,
  LineNodeData,
  PdfNodeData,
  ShapeNodeData,
  TextNodeData,
} from "./basic";
import type { CanvasConnection, CanvasConnectionBase } from "./connection";
import type {
  CanvasMetadata,
  CanvasNodeBase,
  CanvasNodeStyle,
  CanvasPoint,
  CanvasViewport,
} from "./core";

export const CANVAS_DOCUMENT_VERSION = 2 as const;

export interface CanvasDocument {
  version: typeof CANVAS_DOCUMENT_VERSION;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  viewport?: CanvasViewport;
  metadata?: CanvasMetadata;
  extensions?: Record<string, unknown>;
}

export type CanvasParseIssueCode =
  | "malformed-node"
  | "duplicate-node-id"
  | "malformed-connection"
  | "duplicate-connection-id"
  | "dangling-connection"
  | "invalid-frame"
  | "nested-frame";

export interface CanvasParseIssue {
  code: CanvasParseIssueCode;
  id?: string;
  message: string;
}

export interface CanvasParseResult {
  document: CanvasDocument;
  issues: CanvasParseIssue[];
}

export class CanvasDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasDocumentError";
  }
}

export function emptyCanvasDocument(): CanvasDocument {
  return {
    version: CANVAS_DOCUMENT_VERSION,
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function demoCanvasDocument(): CanvasDocument {
  return {
    version: CANVAS_DOCUMENT_VERSION,
    nodes: [
      {
        id: "literature-1",
        kind: "literature",
        position: { x: 0, y: 0 },
        width: 280,
        height: 136,
        source: { library: { type: "user" }, itemKey: "ITEM1234" },
        snapshot: { title: "A paper" },
      },
      {
        id: "quote-1",
        kind: "quote",
        position: { x: 340, y: 0 },
        width: 280,
        height: 168,
        source: {
          library: { type: "user" },
          itemKey: "ITEM1234",
          attachmentKey: "ATTACH12",
          annotationKey: "ANNO1234",
        },
        snapshot: { text: "Evidence" },
      },
      {
        id: "claim-1",
        kind: "claim",
        position: { x: 680, y: 0 },
        width: 260,
        height: 128,
        content: "This evidence supports the claim.",
      },
    ],
    connections: [
      {
        id: "quote-supports-claim",
        kind: "academic",
        source: "quote-1",
        target: "claim-1",
        relation: "supports",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function parseCanvasDocument(value: unknown): CanvasParseResult {
  if (!isRecord(value)) {
    throw new CanvasDocumentError("Canvas document must be an object.");
  }
  if (value.version !== CANVAS_DOCUMENT_VERSION) {
    throw new CanvasDocumentError("Canvas document version must be 2.");
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.connections)) {
    throw new CanvasDocumentError(
      "Canvas document nodes and connections must be arrays.",
    );
  }

  const issues: CanvasParseIssue[] = [];
  const nodes: CanvasNode[] = [];
  const nodeIds = new Set<string>();
  for (const valueNode of value.nodes) {
    const node = parseNode(valueNode);
    if (!node) {
      issues.push(issue("malformed-node", idOf(valueNode), "Malformed node."));
      continue;
    }
    if (nodeIds.has(node.id)) {
      issues.push(
        issue("duplicate-node-id", node.id, `Duplicate node id: ${node.id}.`),
      );
      continue;
    }
    nodeIds.add(node.id);
    nodes.push(node);
  }

  const frameIds = new Set(
    nodes.filter((node) => node.kind === "frame").map((node) => node.id),
  );
  const repairedNodes = nodes.map((node) => {
    const frameId = frameIdOf(node);
    if (frameId === undefined) {
      return node;
    }
    if (node.kind === "frame") {
      issues.push(
        issue(
          "nested-frame",
          node.id,
          `Frame ${node.id} cannot belong to a frame.`,
        ),
      );
      return omitFrameId(node);
    }
    if (!frameIds.has(frameId)) {
      issues.push(
        issue(
          "invalid-frame",
          node.id,
          `Node ${node.id} refers to an unknown frame: ${frameId}.`,
        ),
      );
      return omitFrameId(node);
    }
    return node;
  });

  const connections: CanvasConnection[] = [];
  const connectionIds = new Set<string>();
  for (const valueConnection of value.connections) {
    const connection = parseConnection(valueConnection);
    if (!connection) {
      issues.push(
        issue(
          "malformed-connection",
          idOf(valueConnection),
          "Malformed connection.",
        ),
      );
      continue;
    }
    if (connectionIds.has(connection.id)) {
      issues.push(
        issue(
          "duplicate-connection-id",
          connection.id,
          `Duplicate connection id: ${connection.id}.`,
        ),
      );
      continue;
    }
    connectionIds.add(connection.id);
    if (!nodeIds.has(connection.source) || !nodeIds.has(connection.target)) {
      issues.push(
        issue(
          "dangling-connection",
          connection.id,
          `Connection ${connection.id} has a missing endpoint.`,
        ),
      );
      continue;
    }
    connections.push(connection);
  }

  const viewport = parseViewport(value.viewport);
  const metadata = parseMetadata(value.metadata);
  const extensions = parseExtensions(value.extensions);
  return {
    document: {
      version: CANVAS_DOCUMENT_VERSION,
      nodes: repairedNodes,
      connections,
      ...(viewport ? { viewport } : {}),
      ...(metadata ? { metadata } : {}),
      ...(extensions ? { extensions } : {}),
    },
    issues,
  };
}

function parseNode(value: unknown): CanvasNode | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  const base = parseNodeBase(value, value.kind);
  if (!base) return undefined;

  switch (value.kind) {
    case "item": {
      const data = parseItemData(value.data);
      return data ? { ...base, kind: "item", data } : undefined;
    }
    case "pdf": {
      const data = parsePdfData(value.data);
      return data ? { ...base, kind: "pdf", data } : undefined;
    }
    case "attachment": {
      const data = parseAttachmentData(value.data);
      return data ? { ...base, kind: "attachment", data } : undefined;
    }
    case "text": {
      const data = parseTitleData(value.data);
      return data ? { ...base, kind: "text", data } : undefined;
    }
    case "rect":
    case "ellipse": {
      const data = parseTitleData(value.data);
      return data ? { ...base, kind: value.kind, data } : undefined;
    }
    case "line":
    case "arrow": {
      const data = parseLineData(value.data);
      return data ? { ...base, kind: value.kind, data } : undefined;
    }
    case "literature": {
      const source = parseLiteratureSource(value.source);
      const snapshot = parseLiteratureSnapshot(value.snapshot);
      return source && snapshot
        ? { ...base, kind: "literature", source, snapshot }
        : undefined;
    }
    case "quote": {
      const source = parseQuoteSource(value.source);
      const snapshot = parseQuoteSnapshot(value.snapshot);
      return source && snapshot
        ? { ...base, kind: "quote", source, snapshot }
        : undefined;
    }
    case "note": {
      if (typeof value.content !== "string") return undefined;
      const source = has(value, "source")
        ? parseNoteSource(value.source)
        : undefined;
      const sourceSnapshot = has(value, "sourceSnapshot")
        ? parseNoteSourceSnapshot(value.sourceSnapshot)
        : undefined;
      if (
        (has(value, "source") && !source) ||
        (has(value, "sourceSnapshot") && !sourceSnapshot)
      ) {
        return undefined;
      }
      return {
        ...base,
        kind: "note",
        content: value.content,
        ...(source ? { source } : {}),
        ...(sourceSnapshot ? { sourceSnapshot } : {}),
      };
    }
    case "question":
    case "claim":
      return typeof value.content === "string"
        ? { ...base, kind: value.kind, content: value.content }
        : undefined;
    case "frame":
      return typeof value.title === "string"
        ? { ...base, kind: "frame", title: value.title }
        : undefined;
    default:
      return undefined;
  }
}

function parseNodeBase(
  value: Record<string, unknown>,
  kind: string,
): CanvasNodeBase<string> | undefined {
  if (
    !isNonEmptyString(value.id) ||
    !parsePoint(value.position) ||
    !isPositiveFiniteNumber(value.width) ||
    !isPositiveFiniteNumber(value.height)
  ) {
    return undefined;
  }
  const style = has(value, "style") ? parseNodeStyle(value.style) : undefined;
  const extensions = has(value, "extensions")
    ? parseExtensions(value.extensions)
    : undefined;
  if (
    (has(value, "style") && !style) ||
    (has(value, "extensions") && !extensions)
  ) {
    return undefined;
  }
  if (has(value, "frameId") && typeof value.frameId !== "string") {
    return undefined;
  }
  return {
    id: value.id,
    kind,
    position: parsePoint(value.position)!,
    width: value.width,
    height: value.height,
    ...(typeof value.frameId === "string" ? { frameId: value.frameId } : {}),
    ...(style ? { style } : {}),
    ...(extensions ? { extensions } : {}),
  };
}

function parseConnection(value: unknown): CanvasConnection | undefined {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.source) ||
    !isNonEmptyString(value.target)
  ) {
    return undefined;
  }
  const base = parseConnectionBase(value);
  if (!base || typeof value.kind !== "string") return undefined;
  if (value.kind === "basic") return { ...base, kind: "basic" };
  if (
    value.kind === "academic" &&
    (value.relation === "related" ||
      value.relation === "supports" ||
      value.relation === "contradicts")
  ) {
    return { ...base, kind: "academic", relation: value.relation };
  }
  return undefined;
}

function parseConnectionBase(
  value: Record<string, unknown>,
): CanvasConnectionBase | undefined {
  const sourceHandle = parseOptionalStringOrNull(value, "sourceHandle");
  const targetHandle = parseOptionalStringOrNull(value, "targetHandle");
  const label = parseOptionalString(value, "label");
  const color = parseOptionalString(value, "color");
  const dashed = parseOptionalBoolean(value, "dashed");
  const arrow = parseOptionalBoolean(value, "arrow");
  const extensions = has(value, "extensions")
    ? parseExtensions(value.extensions)
    : undefined;
  if (
    sourceHandle === INVALID ||
    targetHandle === INVALID ||
    label === INVALID ||
    color === INVALID ||
    dashed === INVALID ||
    arrow === INVALID ||
    (has(value, "extensions") && !extensions)
  ) {
    return undefined;
  }
  return {
    id: value.id as string,
    source: value.source as string,
    target: value.target as string,
    ...(sourceHandle !== undefined ? { sourceHandle } : {}),
    ...(targetHandle !== undefined ? { targetHandle } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(dashed !== undefined ? { dashed } : {}),
    ...(arrow !== undefined ? { arrow } : {}),
    ...(extensions ? { extensions } : {}),
  };
}

function parseItemData(value: unknown): ItemNodeData | undefined {
  const common = parseItemLikeData(value);
  if (!common) return undefined;
  const itemID = parseOptionalNumber(common.value, "itemID");
  if (itemID === INVALID) return undefined;
  return { ...common.data, ...(itemID !== undefined ? { itemID } : {}) };
}

function parsePdfData(value: unknown): PdfNodeData | undefined {
  const common = parseItemLikeData(value);
  if (!common) return undefined;
  const attachmentID = parseOptionalNumber(common.value, "attachmentID");
  const itemID = parseOptionalNumber(common.value, "itemID");
  const pdfPage = parseOptionalNumber(common.value, "pdfPage");
  const image = parseOptionalString(common.value, "image");
  const asset = parseOptionalString(common.value, "asset");
  if (
    attachmentID === INVALID ||
    itemID === INVALID ||
    pdfPage === INVALID ||
    image === INVALID ||
    asset === INVALID
  ) {
    return undefined;
  }
  return {
    ...common.data,
    ...(itemID !== undefined ? { itemID } : {}),
    ...(attachmentID !== undefined ? { attachmentID } : {}),
    ...(pdfPage !== undefined ? { pdfPage } : {}),
    ...(image !== undefined ? { image } : {}),
    ...(asset !== undefined ? { asset } : {}),
  };
}

function parseAttachmentData(value: unknown): AttachmentNodeData | undefined {
  const common = parseItemLikeData(value);
  if (!common) return undefined;
  const attachmentID = parseOptionalNumber(common.value, "attachmentID");
  const itemID = parseOptionalNumber(common.value, "itemID");
  if (attachmentID === INVALID || itemID === INVALID) return undefined;
  return {
    ...common.data,
    ...(itemID !== undefined ? { itemID } : {}),
    ...(attachmentID !== undefined ? { attachmentID } : {}),
  };
}

function parseItemLikeData(value: unknown):
  | {
      value: Record<string, unknown>;
      data: { title: string; subtitle?: string; preview?: string };
    }
  | undefined {
  if (!isRecord(value) || typeof value.title !== "string") return undefined;
  const subtitle = parseOptionalString(value, "subtitle");
  const preview = parseOptionalString(value, "preview");
  if (subtitle === INVALID || preview === INVALID) return undefined;
  return {
    value,
    data: {
      title: value.title,
      ...(subtitle !== undefined ? { subtitle } : {}),
      ...(preview !== undefined ? { preview } : {}),
    },
  };
}

function parseTitleData(
  value: unknown,
): TextNodeData | ShapeNodeData | undefined {
  return isRecord(value) && typeof value.title === "string"
    ? { title: value.title }
    : undefined;
}

function parseLineData(value: unknown): LineNodeData | undefined {
  const data = parseTitleData(value);
  if (!data || !isRecord(value)) return undefined;
  const from = has(value, "from") ? parsePoint(value.from) : undefined;
  const to = has(value, "to") ? parsePoint(value.to) : undefined;
  if ((has(value, "from") && !from) || (has(value, "to") && !to))
    return undefined;
  return { ...data, ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

function parseLiteratureSource(value: unknown): LiteratureSource | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.itemKey)) return undefined;
  const library = parseLibrary(value.library);
  return library ? { library, itemKey: value.itemKey } : undefined;
}

function parseQuoteSource(value: unknown): QuoteSource | undefined {
  const source = parseLiteratureSource(value);
  if (
    !source ||
    !isRecord(value) ||
    !isNonEmptyString(value.attachmentKey) ||
    !isNonEmptyString(value.annotationKey)
  ) {
    return undefined;
  }
  return {
    ...source,
    attachmentKey: value.attachmentKey,
    annotationKey: value.annotationKey,
  };
}

function parseNoteSource(value: unknown): NoteSource | undefined {
  if (!isRecord(value) || !isNonEmptyString(value.noteKey)) return undefined;
  const library = parseLibrary(value.library);
  const itemKey = parseOptionalNonEmptyString(value, "itemKey");
  if (!library || itemKey === INVALID) return undefined;
  return {
    library,
    noteKey: value.noteKey,
    ...(itemKey !== undefined ? { itemKey } : {}),
  };
}

function parseLibrary(value: unknown): ZoteroLibraryRef | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type === "user") return { type: "user" };
  if (value.type === "group" && isFiniteNumber(value.groupID)) {
    return { type: "group", groupID: value.groupID };
  }
  return undefined;
}

function parseLiteratureSnapshot(
  value: unknown,
): LiteratureSnapshot | undefined {
  if (!isRecord(value) || typeof value.title !== "string") return undefined;
  const creators = parseOptionalString(value, "creators");
  const year = parseOptionalString(value, "year");
  const publicationTitle = parseOptionalString(value, "publicationTitle");
  const tags = parseOptionalStringArray(value, "tags");
  const annotationCount = parseOptionalNumber(value, "annotationCount");
  if (
    creators === INVALID ||
    year === INVALID ||
    publicationTitle === INVALID ||
    tags === INVALID ||
    annotationCount === INVALID
  ) {
    return undefined;
  }
  return {
    title: value.title,
    ...(creators !== undefined ? { creators } : {}),
    ...(year !== undefined ? { year } : {}),
    ...(publicationTitle !== undefined ? { publicationTitle } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(annotationCount !== undefined ? { annotationCount } : {}),
  };
}

function parseQuoteSnapshot(value: unknown): QuoteSnapshot | undefined {
  if (!isRecord(value) || typeof value.text !== "string") return undefined;
  const comment = parseOptionalString(value, "comment");
  const citation = parseOptionalString(value, "citation");
  const pageLabel = parseOptionalString(value, "pageLabel");
  const color = parseOptionalString(value, "color");
  if (
    comment === INVALID ||
    citation === INVALID ||
    pageLabel === INVALID ||
    color === INVALID
  ) {
    return undefined;
  }
  return {
    text: value.text,
    ...(comment !== undefined ? { comment } : {}),
    ...(citation !== undefined ? { citation } : {}),
    ...(pageLabel !== undefined ? { pageLabel } : {}),
    ...(color !== undefined ? { color } : {}),
  };
}

function parseNoteSourceSnapshot(
  value: unknown,
): NoteSourceSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const title = parseOptionalString(value, "title");
  return title === INVALID ? undefined : title === undefined ? {} : { title };
}

function parseNodeStyle(value: unknown): CanvasNodeStyle | undefined {
  if (!isRecord(value)) return undefined;
  const stringFields = ["stroke", "fill", "fontFamily", "textColor"] as const;
  const numberFields = [
    "strokeWidth",
    "radius",
    "fontSize",
    "textOpacity",
    "strokeOpacity",
  ] as const;
  const booleanFields = ["dashed"] as const;
  const style: CanvasNodeStyle = {};
  for (const field of stringFields) {
    const fieldValue = parseOptionalString(value, field);
    if (fieldValue === INVALID) return undefined;
    if (fieldValue !== undefined) style[field] = fieldValue;
  }
  for (const field of numberFields) {
    const fieldValue = parseOptionalNumber(value, field);
    if (fieldValue === INVALID) return undefined;
    if (fieldValue !== undefined) style[field] = fieldValue;
  }
  for (const field of booleanFields) {
    const fieldValue = parseOptionalBoolean(value, field);
    if (fieldValue === INVALID) return undefined;
    if (fieldValue !== undefined) style[field] = fieldValue;
  }
  const enumFields = {
    fontWeight: ["normal", "bold"],
    fontStyle: ["normal", "italic"],
    textDecoration: ["none", "underline", "line-through"],
    textAlign: ["left", "center", "right"],
    verticalAlign: ["top", "middle", "bottom"],
    fillStyle: ["none", "solid", "hatch"],
    strokeStyle: ["solid", "dotted", "dashed"],
  } as const;
  for (const [field, values] of Object.entries(enumFields)) {
    const fieldValue = parseOptionalEnum(value, field, values);
    if (fieldValue === INVALID) return undefined;
    if (fieldValue !== undefined) {
      (style as Record<string, unknown>)[field] = fieldValue;
    }
  }
  return style;
}

function parseViewport(value: unknown): CanvasViewport | undefined {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isPositiveFiniteNumber(value.zoom)
  ) {
    return undefined;
  }
  return { x: value.x, y: value.y, zoom: value.zoom };
}

function parseMetadata(value: unknown): CanvasMetadata | undefined {
  if (!isRecord(value)) return undefined;
  const title = parseOptionalString(value, "title");
  const createdAt = parseOptionalString(value, "createdAt");
  const updatedAt = parseOptionalString(value, "updatedAt");
  if (title === INVALID || createdAt === INVALID || updatedAt === INVALID) {
    return undefined;
  }
  return {
    ...(title !== undefined ? { title } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}

function parseExtensions(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? { ...value } : undefined;
}

function parsePoint(value: unknown): CanvasPoint | undefined {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y)
  ) {
    return undefined;
  }
  return { x: value.x, y: value.y };
}

const INVALID = Symbol("invalid");

function parseOptionalString(
  value: Record<string, unknown>,
  key: string,
): string | undefined | typeof INVALID {
  if (!has(value, key)) return undefined;
  return typeof value[key] === "string" ? value[key] : INVALID;
}

function parseOptionalNonEmptyString(
  value: Record<string, unknown>,
  key: string,
): string | undefined | typeof INVALID {
  const fieldValue = parseOptionalString(value, key);
  return fieldValue === undefined ||
    fieldValue === INVALID ||
    fieldValue.length > 0
    ? fieldValue
    : INVALID;
}

function parseOptionalStringOrNull(
  value: Record<string, unknown>,
  key: string,
): string | null | undefined | typeof INVALID {
  if (!has(value, key)) return undefined;
  return typeof value[key] === "string" || value[key] === null
    ? value[key]
    : INVALID;
}

function parseOptionalNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined | typeof INVALID {
  if (!has(value, key)) return undefined;
  return isFiniteNumber(value[key]) ? value[key] : INVALID;
}

function parseOptionalBoolean(
  value: Record<string, unknown>,
  key: string,
): boolean | undefined | typeof INVALID {
  if (!has(value, key)) return undefined;
  return typeof value[key] === "boolean" ? value[key] : INVALID;
}

function parseOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
): string[] | undefined | typeof INVALID {
  if (!has(value, key)) return undefined;
  return Array.isArray(value[key]) &&
    value[key].every((item) => typeof item === "string")
    ? [...value[key]]
    : INVALID;
}

function parseOptionalEnum(
  value: Record<string, unknown>,
  key: string,
  values: readonly string[],
): string | undefined | typeof INVALID {
  if (!has(value, key)) return undefined;
  return typeof value[key] === "string" && values.includes(value[key])
    ? value[key]
    : INVALID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function has(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function idOf(value: unknown): string | undefined {
  return isRecord(value) && typeof value.id === "string" ? value.id : undefined;
}

function issue(
  code: CanvasParseIssueCode,
  id: string | undefined,
  message: string,
): CanvasParseIssue {
  return { code, ...(id ? { id } : {}), message };
}

function omitFrameId<T extends CanvasNode>(node: T): T {
  const copy = { ...node } as CanvasNode & { frameId?: string };
  delete copy.frameId;
  return copy as T;
}

function frameIdOf(node: CanvasNode): string | undefined {
  return "frameId" in node ? node.frameId : undefined;
}
