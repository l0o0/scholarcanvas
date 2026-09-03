import type { AcademicNode } from "./academic";
import type { CanvasNode } from "./academic";
import type { CanvasConnection } from "./connection";
import {
  CANVAS_DOCUMENT_VERSION,
  CanvasDocumentError,
  parseCanvasDocument,
  type CanvasDocument,
  type CanvasParseIssue,
} from "./document";
import type { CanvasViewport } from "./core";

export const JSON_CANVAS_VERSION = 1 as const;
const BAMBOO_SCHEMA_VERSION = 2 as const;

export interface CanvasFileNode extends Record<string, unknown> {
  id: string;
  type: "text" | "group" | "file" | "link";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  label?: string;
  bamboo?: {
    node?: Record<string, unknown>;
    frameId?: string;
    extensions?: Record<string, unknown>;
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
    kind?: "basic" | "academic";
    relation?: "related" | "supports" | "contradicts";
    sourceHandle?: string | null;
    targetHandle?: string | null;
    dashed?: boolean;
    arrow?: boolean;
    extensions?: Record<string, unknown>;
  };
}

export interface CanvasFile extends Record<string, unknown> {
  version: typeof JSON_CANVAS_VERSION;
  nodes: CanvasFileNode[];
  edges: CanvasFileEdge[];
  bamboo: {
    schemaVersion: typeof BAMBOO_SCHEMA_VERSION;
    title?: string;
    createdAt: string;
    updatedAt: string;
    viewport: CanvasViewport;
    extensions?: Record<string, unknown>;
  };
}

export interface CanvasFileOptions {
  title?: string;
  now?: string;
}

export interface ParsedCanvasFile {
  document: CanvasDocument;
  issues: CanvasParseIssue[];
}

const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };
const BAMBOO_EXTENSION_KEY = "bamboo";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function withoutKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  const blocked = new Set(keys);
  const entries = Object.entries(source).filter(([key]) => !blocked.has(key));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function mergeRecords(
  ...records: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  for (const record of records) {
    if (!record) continue;
    for (const [key, value] of Object.entries(record)) {
      const current = asRecord(result[key]);
      const incoming = asRecord(value);
      result[key] =
        current && incoming ? (mergeRecords(current, incoming) ?? {}) : value;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function has(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isViewport(value: unknown): value is CanvasViewport {
  const viewport = asRecord(value);
  return Boolean(
    viewport &&
    isFiniteNumber(viewport.x) &&
    isFiniteNumber(viewport.y) &&
    isFiniteNumber(viewport.zoom) &&
    viewport.zoom > 0,
  );
}

function hasValidBambooNodeEnvelope(node: Record<string, unknown>): boolean {
  if (
    node.type !== "text" &&
    node.type !== "group" &&
    node.type !== "file" &&
    node.type !== "link"
  ) {
    return false;
  }
  if (
    !isFiniteNumber(node.x) ||
    !isFiniteNumber(node.y) ||
    !isFiniteNumber(node.width) ||
    node.width <= 0 ||
    !isFiniteNumber(node.height) ||
    node.height <= 0
  ) {
    return false;
  }
  if (node.type === "text") return typeof node.text === "string";
  if (node.type === "group") return typeof node.label === "string";
  return true;
}

function standardExtensions(
  extensions: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return extensions
    ? withoutKeys(extensions, [BAMBOO_EXTENSION_KEY])
    : undefined;
}

function bambooExtensions(
  extensions: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return asRecord(extensions?.[BAMBOO_EXTENSION_KEY]);
}

function decodedExtensions(
  standard: Record<string, unknown> | undefined,
  bamboo: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return mergeRecords(
    standard,
    bamboo ? { [BAMBOO_EXTENSION_KEY]: bamboo } : undefined,
  );
}

function academicText(node: AcademicNode): string {
  switch (node.kind) {
    case "literature":
      return [node.snapshot.title, node.snapshot.creators, node.snapshot.year]
        .filter(Boolean)
        .join("\n\n");
    case "quote":
      return [
        node.snapshot.text,
        node.snapshot.citation,
        node.snapshot.pageLabel,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "note":
    case "question":
    case "claim":
      return node.content;
    case "frame":
      return node.title;
  }
}

interface PayloadSchema {
  [key: string]: true | PayloadSchema;
}

const POINT_SCHEMA: PayloadSchema = { x: true, y: true };
const LIBRARY_SCHEMA: PayloadSchema = { type: true, groupID: true };
const STYLE_SCHEMA: PayloadSchema = {
  stroke: true,
  fill: true,
  strokeWidth: true,
  radius: true,
  dashed: true,
  fontFamily: true,
  fontSize: true,
  fontWeight: true,
  fontStyle: true,
  textDecoration: true,
  textAlign: true,
  verticalAlign: true,
  textColor: true,
  textOpacity: true,
  strokeOpacity: true,
  fillStyle: true,
  strokeStyle: true,
};

function payloadSchema(kind: unknown): PayloadSchema | undefined {
  const common: PayloadSchema = { kind: true, style: STYLE_SCHEMA };
  const itemData: PayloadSchema = {
    title: true,
    subtitle: true,
    preview: true,
    itemID: true,
  };
  switch (kind) {
    case "item":
      return { ...common, data: itemData };
    case "pdf":
      return {
        ...common,
        data: {
          ...itemData,
          attachmentID: true,
          pdfPage: true,
          image: true,
          asset: true,
        },
      };
    case "attachment":
      return { ...common, data: { ...itemData, attachmentID: true } };
    case "text":
    case "rect":
    case "ellipse":
      return { ...common, data: { title: true } };
    case "line":
    case "arrow":
      return {
        ...common,
        data: { title: true, from: POINT_SCHEMA, to: POINT_SCHEMA },
      };
    case "literature":
      return {
        ...common,
        source: { library: LIBRARY_SCHEMA, itemKey: true },
        snapshot: {
          title: true,
          creators: true,
          year: true,
          publicationTitle: true,
          tags: true,
          annotationCount: true,
        },
      };
    case "quote":
      return {
        ...common,
        source: {
          library: LIBRARY_SCHEMA,
          itemKey: true,
          attachmentKey: true,
          annotationKey: true,
        },
        snapshot: {
          text: true,
          comment: true,
          citation: true,
          pageLabel: true,
          color: true,
        },
      };
    case "note":
      return {
        ...common,
        content: true,
        source: {
          library: LIBRARY_SCHEMA,
          noteKey: true,
          itemKey: true,
        },
        sourceSnapshot: { title: true },
      };
    case "question":
    case "claim":
      return { ...common, content: true };
    case "frame":
      return { ...common, title: true };
    default:
      return undefined;
  }
}

function unknownPayloadFields(
  value: Record<string, unknown>,
  schema: PayloadSchema,
): Record<string, unknown> | undefined {
  const unknown: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    const fieldSchema = schema[key];
    if (!fieldSchema) {
      unknown[key] = fieldValue;
      continue;
    }
    if (fieldSchema === true) continue;
    const fieldRecord = asRecord(fieldValue);
    if (!fieldRecord) continue;
    const nested = unknownPayloadFields(fieldRecord, fieldSchema);
    if (nested) unknown[key] = nested;
  }
  return Object.keys(unknown).length ? unknown : undefined;
}

function unknownNodePayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const schema = payloadSchema(payload.kind);
  return schema ? unknownPayloadFields(payload, schema) : undefined;
}

function basicText(node: Exclude<CanvasNode, AcademicNode>): string {
  return "data" in node
    ? [
        node.data.title,
        "subtitle" in node.data ? node.data.subtitle : undefined,
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";
}

function nodePayload(node: CanvasNode): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...node };
  delete payload.id;
  delete payload.position;
  delete payload.width;
  delete payload.height;
  delete payload.frameId;
  delete payload.extensions;
  return payload;
}

function toCanvasNode(node: CanvasNode): CanvasFileNode {
  const extensions = bambooExtensions(node.extensions);
  const frameId = "frameId" in node ? node.frameId : undefined;
  const bamboo = {
    node: nodePayload(node),
    ...(frameId !== undefined ? { frameId } : {}),
    ...(extensions ? { extensions } : {}),
  };
  if (node.kind === "frame") {
    return {
      ...(standardExtensions(node.extensions) ?? {}),
      id: node.id,
      type: "group",
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
      label: node.title,
      bamboo,
    };
  }
  return {
    ...(standardExtensions(node.extensions) ?? {}),
    id: node.id,
    type: "text",
    x: node.position.x,
    y: node.position.y,
    width: node.width,
    height: node.height,
    text:
      node.kind === "literature" ||
      node.kind === "quote" ||
      node.kind === "note" ||
      node.kind === "question" ||
      node.kind === "claim"
        ? academicText(node)
        : basicText(node),
    bamboo,
  };
}

function toCanvasEdge(connection: CanvasConnection): CanvasFileEdge {
  const extensions = bambooExtensions(connection.extensions);
  return {
    ...(standardExtensions(connection.extensions) ?? {}),
    id: connection.id,
    fromNode: connection.source,
    toNode: connection.target,
    ...(connection.label !== undefined ? { label: connection.label } : {}),
    ...(connection.color !== undefined ? { color: connection.color } : {}),
    bamboo: {
      kind: connection.kind,
      ...(connection.kind === "academic"
        ? { relation: connection.relation }
        : {}),
      ...(connection.sourceHandle !== undefined
        ? { sourceHandle: connection.sourceHandle }
        : {}),
      ...(connection.targetHandle !== undefined
        ? { targetHandle: connection.targetHandle }
        : {}),
      ...(connection.dashed !== undefined ? { dashed: connection.dashed } : {}),
      ...(connection.arrow !== undefined ? { arrow: connection.arrow } : {}),
      ...(extensions ? { extensions } : {}),
    },
  };
}

export function canvasDocumentToFile(
  document: CanvasDocument,
  options: CanvasFileOptions = {},
): CanvasFile {
  const now = options.now ?? new Date().toISOString();
  const title = options.title ?? document.metadata?.title;
  const extensions = bambooExtensions(document.extensions);
  return {
    ...(standardExtensions(document.extensions) ?? {}),
    version: JSON_CANVAS_VERSION,
    nodes: document.nodes.map(toCanvasNode),
    edges: document.connections.map(toCanvasEdge),
    bamboo: {
      schemaVersion: BAMBOO_SCHEMA_VERSION,
      ...(title !== undefined ? { title } : {}),
      createdAt: document.metadata?.createdAt ?? now,
      updatedAt: now,
      viewport: { ...(document.viewport ?? DEFAULT_VIEWPORT) },
      ...(extensions ? { extensions } : {}),
    },
  };
}

const INVALID_EXTENSIONS = Symbol("invalid-extensions");

function decodedBambooExtensions(
  bamboo: Record<string, unknown> | undefined,
  knownKeys: readonly string[],
): Record<string, unknown> | undefined | typeof INVALID_EXTENSIONS {
  if (bamboo && has(bamboo, "extensions") && !asRecord(bamboo.extensions)) {
    return INVALID_EXTENSIONS;
  }
  return mergeRecords(
    asRecord(bamboo?.extensions),
    bamboo ? withoutKeys(bamboo, [...knownKeys, "extensions"]) : undefined,
  );
}

function decodeNode(value: unknown): unknown {
  const raw = asRecord(value);
  if (!raw) return value;
  const bamboo = asRecord(raw.bamboo);
  const payload = asRecord(bamboo?.node);
  const standard = withoutKeys(raw, [
    "id",
    "type",
    "x",
    "y",
    "width",
    "height",
    "bamboo",
    ...(raw.type === "text" ? ["text"] : []),
    ...(raw.type === "group" ? ["label"] : []),
  ]);
  const decodedBamboo = decodedBambooExtensions(bamboo, ["node", "frameId"]);
  const extensions = decodedExtensions(
    standard,
    decodedBamboo === INVALID_EXTENSIONS
      ? undefined
      : mergeRecords(decodedBamboo, unknownNodePayload(payload)),
  );
  const base = {
    id: raw.id,
    position: { x: raw.x, y: raw.y },
    width: raw.width,
    height: raw.height,
    ...(extensions ? { extensions } : {}),
  };

  if (
    (raw.bamboo !== undefined && !bamboo) ||
    decodedBamboo === INVALID_EXTENSIONS
  ) {
    return base;
  }
  if (bamboo) {
    if (!hasValidBambooNodeEnvelope(raw)) return base;
    return {
      ...(payload ?? {}),
      ...base,
      ...(bamboo.frameId !== undefined ? { frameId: bamboo.frameId } : {}),
    };
  }
  if (raw.type === "text") {
    if (typeof raw.text !== "string") return base;
    return {
      ...base,
      kind: "text",
      data: {
        title: raw.text,
      },
    };
  }
  if (raw.type === "group") {
    if (raw.label !== undefined && typeof raw.label !== "string") return base;
    return {
      ...base,
      kind: "frame",
      title: typeof raw.label === "string" ? raw.label : "",
    };
  }
  return base;
}

function decodeEdge(value: unknown): unknown {
  const raw = asRecord(value);
  if (!raw) return value;
  const bamboo = asRecord(raw.bamboo);
  const standard = withoutKeys(raw, [
    "id",
    "fromNode",
    "toNode",
    "label",
    "color",
    "bamboo",
  ]);
  const decodedBamboo = decodedBambooExtensions(bamboo, [
    "kind",
    "relation",
    "sourceHandle",
    "targetHandle",
    "dashed",
    "arrow",
  ]);
  const extensions = decodedExtensions(
    standard,
    decodedBamboo === INVALID_EXTENSIONS ? undefined : decodedBamboo,
  );
  return {
    id: raw.id,
    kind:
      (raw.bamboo !== undefined && !bamboo) ||
      decodedBamboo === INVALID_EXTENSIONS
        ? undefined
        : (bamboo?.kind ?? "basic"),
    source: raw.fromNode,
    target: raw.toNode,
    ...(bamboo?.relation !== undefined ? { relation: bamboo.relation } : {}),
    ...(bamboo?.sourceHandle !== undefined
      ? { sourceHandle: bamboo.sourceHandle }
      : {}),
    ...(bamboo?.targetHandle !== undefined
      ? { targetHandle: bamboo.targetHandle }
      : {}),
    ...(raw.label !== undefined ? { label: raw.label } : {}),
    ...(raw.color !== undefined ? { color: raw.color } : {}),
    ...(bamboo?.dashed !== undefined ? { dashed: bamboo.dashed } : {}),
    ...(bamboo?.arrow !== undefined ? { arrow: bamboo.arrow } : {}),
    ...(extensions ? { extensions } : {}),
  };
}

export function canvasFileToDocument(value: unknown): ParsedCanvasFile {
  const file = asRecord(value);
  if (!file) throw new CanvasDocumentError("Canvas file must be an object.");
  if (file.v === 1 && file.engine === "xyflow") {
    throw new CanvasDocumentError(
      "Legacy xyflow canvas files are unsupported.",
    );
  }
  if (file.version !== JSON_CANVAS_VERSION) {
    throw new CanvasDocumentError("JSON Canvas version must be 1.");
  }
  if (!Array.isArray(file.nodes) || !Array.isArray(file.edges)) {
    throw new CanvasDocumentError(
      "Canvas file nodes and edges must be arrays.",
    );
  }

  const bamboo = asRecord(file.bamboo);
  if (file.bamboo !== undefined && !bamboo) {
    throw new CanvasDocumentError("Canvas file Bamboo data must be an object.");
  }
  if (bamboo && bamboo.schemaVersion !== BAMBOO_SCHEMA_VERSION) {
    throw new CanvasDocumentError("Bamboo schema version must be 2.");
  }
  if (
    bamboo &&
    ((bamboo.title !== undefined && typeof bamboo.title !== "string") ||
      typeof bamboo.createdAt !== "string" ||
      typeof bamboo.updatedAt !== "string" ||
      !isViewport(bamboo.viewport))
  ) {
    throw new CanvasDocumentError("Canvas file Bamboo metadata is malformed.");
  }

  const standard = withoutKeys(file, ["version", "nodes", "edges", "bamboo"]);
  const decodedBamboo = decodedBambooExtensions(bamboo, [
    "schemaVersion",
    "title",
    "createdAt",
    "updatedAt",
    "viewport",
  ]);
  if (decodedBamboo === INVALID_EXTENSIONS) {
    throw new CanvasDocumentError(
      "Canvas file Bamboo extensions must be an object.",
    );
  }
  const extensions = decodedExtensions(standard, decodedBamboo);
  return parseCanvasDocument({
    version: CANVAS_DOCUMENT_VERSION,
    nodes: file.nodes.map(decodeNode),
    connections: file.edges.map(decodeEdge),
    ...(bamboo?.viewport !== undefined ? { viewport: bamboo.viewport } : {}),
    ...(bamboo
      ? {
          metadata: {
            ...(bamboo.title !== undefined ? { title: bamboo.title } : {}),
            ...(bamboo.createdAt !== undefined
              ? { createdAt: bamboo.createdAt }
              : {}),
            ...(bamboo.updatedAt !== undefined
              ? { updatedAt: bamboo.updatedAt }
              : {}),
          },
        }
      : {}),
    ...(extensions ? { extensions } : {}),
  });
}

export function parseStoredCanvas(value: unknown): ParsedCanvasFile {
  if (typeof value !== "string") return canvasFileToDocument(value);
  try {
    return canvasFileToDocument(JSON.parse(value) as unknown);
  } catch (error) {
    if (error instanceof CanvasDocumentError) throw error;
    throw new CanvasDocumentError("Canvas file must contain valid JSON.");
  }
}

export function serializeCanvasDocument(
  document: CanvasDocument,
  options: CanvasFileOptions = {},
): string {
  return `${JSON.stringify(canvasDocumentToFile(document, options), null, 2)}\n`;
}
