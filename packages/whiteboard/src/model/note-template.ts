import {
  createAcademicNode,
  getNoteType,
  getNoteTitle,
  isNoteType,
  type NoteType,
  type NoteNode,
} from "./academic";
import type { CanvasNodeStyle, CanvasPoint } from "./core";

export const NOTE_TEMPLATE_LIMITS = {
  name: 64,
  badge: 64,
  content: 20_000,
  minWidth: 120,
  maxWidth: 1_200,
  minHeight: 72,
  maxHeight: 1_200,
} as const;

export const BUILTIN_NOTE_TEMPLATE_IDS = {
  note: "bamboo.note",
  question: "bamboo.question",
  claim: "bamboo.claim",
  evidence: "bamboo.evidence",
  summary: "bamboo.summary",
} as const;

export interface NoteTemplate {
  id: string;
  name: string;
  noteType?: NoteType;
  badge?: string;
  initialContent?: string;
  style: CanvasNodeStyle;
  defaultSize?: { width: number; height: number };
  sortOrder?: number;
  updatedAt: string;
}

export interface BuiltinNoteTemplateLabels {
  note: string;
  question: string;
  claim: string;
  evidence: string;
  summary: string;
}

const BUILTIN_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function createBuiltinNoteTemplates(
  labels: BuiltinNoteTemplateLabels,
): NoteTemplate[] {
  return (Object.keys(BUILTIN_NOTE_TEMPLATE_IDS) as NoteType[]).map(
    (noteType, index) => ({
      id: BUILTIN_NOTE_TEMPLATE_IDS[noteType],
      name: labels[noteType],
      noteType,
      style: {},
      defaultSize: { width: 260, height: 152 },
      sortOrder: index,
      updatedAt: BUILTIN_TIMESTAMP,
    }),
  );
}

export const BUILTIN_NOTE_TEMPLATES = createBuiltinNoteTemplates({
  note: "Note",
  question: "Question",
  claim: "Viewpoint",
  evidence: "Evidence",
  summary: "Summary",
});

export function parseNoteTemplate(value: unknown): NoteTemplate | undefined {
  if (!isRecord(value)) return undefined;
  const id = ownString(value, "id");
  const name = ownString(value, "name");
  const updatedAt = ownString(value, "updatedAt");
  if (
    !id ||
    !withinTextLimit(name, NOTE_TEMPLATE_LIMITS.name) ||
    !updatedAt ||
    !Number.isFinite(Date.parse(updatedAt)) ||
    !isRecord(value.style)
  ) {
    return undefined;
  }
  const badge = optionalText(value, "badge", NOTE_TEMPLATE_LIMITS.badge);
  const initialContent = optionalText(
    value,
    "initialContent",
    NOTE_TEMPLATE_LIMITS.content,
  );
  if (
    badge === INVALID ||
    initialContent === INVALID ||
    (hasOwn(value, "noteType") && !isNoteType(value.noteType))
  )
    return undefined;
  const defaultSize = hasOwn(value, "defaultSize")
    ? parseDefaultSize(value.defaultSize)
    : undefined;
  if (hasOwn(value, "defaultSize") && !defaultSize) return undefined;
  const sortOrder = hasOwn(value, "sortOrder") ? value.sortOrder : undefined;
  if (
    sortOrder !== undefined &&
    (typeof sortOrder !== "number" || !Number.isFinite(sortOrder))
  ) {
    return undefined;
  }
  return {
    id,
    name,
    ...(isNoteType(value.noteType) ? { noteType: value.noteType } : {}),
    ...(badge !== undefined ? { badge } : {}),
    ...(initialContent !== undefined ? { initialContent } : {}),
    style: parseTemplateStyle(value.style),
    ...(defaultSize ? { defaultSize } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    updatedAt,
  };
}

export function parseNoteTemplateRegistry(value: unknown): NoteTemplate[] {
  if (!Array.isArray(value)) return [];
  const templates: NoteTemplate[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    const template = parseNoteTemplate(entry);
    if (!template || ids.has(template.id)) continue;
    ids.add(template.id);
    templates.push(template);
  }
  return templates.sort(
    (a, b) =>
      (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}

export function materializeNoteTemplate(
  template: NoteTemplate,
  position: CanvasPoint,
  id: string,
): NoteNode {
  return createAcademicNode("note", position, id, {
    content: template.initialContent ?? "",
    ...(template.noteType ? { noteType: template.noteType } : {}),
    ...(template.badge !== undefined ? { badge: template.badge } : {}),
    style: { ...template.style },
    width: template.defaultSize?.width ?? 260,
    height: template.defaultSize?.height ?? 152,
  });
}

export function applyNoteTemplate(
  note: NoteNode,
  template: NoteTemplate,
): NoteNode {
  const { badge: _previousBadge, ...noteWithoutBadge } = note;
  return {
    ...noteWithoutBadge,
    ...(template.noteType ? { noteType: template.noteType } : {}),
    width: template.defaultSize?.width ?? note.width,
    height: template.defaultSize?.height ?? note.height,
    style: { ...template.style },
    ...(template.badge !== undefined ? { badge: template.badge } : {}),
  };
}

/** Type changes never replace written content or reset the user's layout/style. */
export function changeNoteType(note: NoteNode, noteType: NoteType): NoteNode {
  const { badge: _badge, ...rest } = note;
  const title = getNoteTitle(note);
  return {
    ...rest,
    noteType,
    ...(title !== undefined ? { badge: title } : {}),
  };
}

export function createCustomNoteTemplate(
  note: NoteNode,
  options: {
    id: string;
    name: string;
    includeContent: boolean;
    updatedAt: string;
    sortOrder?: number;
  },
): NoteTemplate {
  const template = parseNoteTemplate({
    id: options.id,
    name: options.name,
    noteType: getNoteType(note),
    ...(getNoteTitle(note) !== undefined ? { badge: getNoteTitle(note) } : {}),
    ...(options.includeContent ? { initialContent: note.content } : {}),
    style: { ...(note.style ?? {}) },
    defaultSize: { width: note.width, height: note.height },
    ...(options.sortOrder !== undefined
      ? { sortOrder: options.sortOrder }
      : {}),
    updatedAt: options.updatedAt,
  });
  if (!template) throw new Error("Invalid Note template values.");
  return template;
}

function parseTemplateStyle(value: Record<string, unknown>): CanvasNodeStyle {
  const style: CanvasNodeStyle = {};
  copyString(value, style, "stroke", 128);
  copyString(value, style, "fill", 128);
  copyNumber(value, style, "strokeWidth", 0, 12);
  copyNumber(value, style, "radius", 0, 64);
  copyBoolean(value, style, "dashed");
  copyString(value, style, "fontFamily", 256);
  copyNumber(value, style, "fontSize", 8, 96);
  copyEnum(value, style, "fontWeight", ["normal", "bold"]);
  copyEnum(value, style, "fontStyle", ["normal", "italic"]);
  copyEnum(value, style, "textDecoration", [
    "none",
    "underline",
    "line-through",
  ]);
  copyEnum(value, style, "textAlign", ["left", "center", "right"]);
  copyEnum(value, style, "verticalAlign", ["top", "middle", "bottom"]);
  copyString(value, style, "textColor", 128);
  copyNumber(value, style, "textOpacity", 0, 1);
  copyNumber(value, style, "strokeOpacity", 0, 1);
  copyEnum(value, style, "fillStyle", ["none", "solid", "hatch"]);
  copyEnum(value, style, "strokeStyle", ["solid", "dotted", "dashed"]);
  return style;
}

function parseDefaultSize(
  value: unknown,
): { width: number; height: number } | undefined {
  if (!isRecord(value)) return undefined;
  const { width, height } = value;
  if (
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width < NOTE_TEMPLATE_LIMITS.minWidth ||
    width > NOTE_TEMPLATE_LIMITS.maxWidth ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    height < NOTE_TEMPLATE_LIMITS.minHeight ||
    height > NOTE_TEMPLATE_LIMITS.maxHeight
  ) {
    return undefined;
  }
  return { width, height };
}

const INVALID = Symbol("invalid");

function optionalText(
  value: Record<string, unknown>,
  key: string,
  limit: number,
): string | undefined | typeof INVALID {
  if (!hasOwn(value, key)) return undefined;
  const field = value[key];
  return typeof field === "string" && field.length <= limit ? field : INVALID;
}

function withinTextLimit(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= limit;
}

function copyString<K extends "stroke" | "fill" | "fontFamily" | "textColor">(
  source: Record<string, unknown>,
  target: CanvasNodeStyle,
  key: K,
  limit: number,
) {
  const value = source[key];
  if (typeof value === "string" && value.length <= limit) target[key] = value;
}

function copyNumber<
  K extends
    "strokeWidth" | "radius" | "fontSize" | "textOpacity" | "strokeOpacity",
>(
  source: Record<string, unknown>,
  target: CanvasNodeStyle,
  key: K,
  minimum: number,
  maximum: number,
) {
  const value = source[key];
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  ) {
    target[key] = value;
  }
}

function copyBoolean<K extends "dashed">(
  source: Record<string, unknown>,
  target: CanvasNodeStyle,
  key: K,
) {
  const value = source[key];
  if (typeof value === "boolean") target[key] = value;
}

function copyEnum<K extends keyof CanvasNodeStyle>(
  source: Record<string, unknown>,
  target: CanvasNodeStyle,
  key: K,
  allowed: readonly string[],
) {
  const value = source[key];
  if (typeof value === "string" && allowed.includes(value)) {
    (target as Record<string, unknown>)[key] = value;
  }
}

function ownString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  return hasOwn(value, key) && typeof value[key] === "string"
    ? value[key]
    : undefined;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
