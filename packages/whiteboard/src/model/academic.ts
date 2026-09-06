import type { BasicNode, BasicNodeKind } from "./basic";
import type { CanvasNodeBase, CanvasNodeStyle, CanvasPoint } from "./core";
import type { WhiteboardTheme } from "./protocol";

export type AcademicNodeKind = "literature" | "quote" | "note" | "frame";

export const ACADEMIC_SOURCE_CARD_SIZE = {
  literature: { width: 280, height: 200 },
  quote: { width: 280, height: 192 },
} as const;

export type ZoteroLibraryRef =
  { type: "user" } | { type: "group"; groupID: number };

export interface LiteratureSource {
  library: ZoteroLibraryRef;
  itemKey: string;
}

export interface QuoteSource extends LiteratureSource {
  attachmentKey: string;
  annotationKey: string;
}

export interface NoteSource {
  library: ZoteroLibraryRef;
  noteKey: string;
  itemKey?: string;
}

function sourceLibraryIdentity(
  library: ZoteroLibraryRef,
): [string, number | null] {
  return library.type === "user" ? ["user", null] : ["group", library.groupID];
}

export function literatureSourceIdentity(source: LiteratureSource): string {
  return JSON.stringify([
    "literature",
    ...sourceLibraryIdentity(source.library),
    source.itemKey,
  ]);
}

export function quoteAttachmentIdentity(source: QuoteSource): string {
  return JSON.stringify([
    "quote-attachment",
    ...sourceLibraryIdentity(source.library),
    source.itemKey,
    source.attachmentKey,
  ]);
}

export function quoteSourceIdentity(source: QuoteSource): string {
  return JSON.stringify([
    "quote",
    ...sourceLibraryIdentity(source.library),
    source.itemKey,
    source.attachmentKey,
    source.annotationKey,
  ]);
}

export function noteSourceIdentity(source: NoteSource): string {
  return JSON.stringify([
    "note",
    ...sourceLibraryIdentity(source.library),
    source.itemKey ?? null,
    source.noteKey,
  ]);
}

export interface LiteratureSnapshot {
  title: string;
  creators?: string;
  year?: string;
  publicationTitle?: string;
  tags?: string[];
  annotationCount?: number;
}

export interface QuoteSnapshot {
  text: string;
  comment?: string;
  citation?: string;
  pageLabel?: string;
  color?: string;
}

export interface NoteSourceSnapshot {
  title?: string;
}

export interface LiteratureNode extends CanvasNodeBase<"literature"> {
  source: LiteratureSource;
  snapshot: LiteratureSnapshot;
}

export interface QuoteNode extends CanvasNodeBase<"quote"> {
  source: QuoteSource;
  snapshot: QuoteSnapshot;
}

export interface NoteNode extends CanvasNodeBase<"note"> {
  content: string;
  badge?: string;
  source?: NoteSource;
  sourceSnapshot?: NoteSourceSnapshot;
}

export interface FrameNode extends Omit<CanvasNodeBase<"frame">, "frameId"> {
  title: string;
}

export type AcademicNode = LiteratureNode | QuoteNode | NoteNode | FrameNode;

export type CanvasNode = BasicNode | AcademicNode;
export type CanvasNodeKind = BasicNodeKind | AcademicNodeKind;

export type CanvasNodeSurfaceDefaults = Required<
  Pick<
    CanvasNodeStyle,
    "stroke" | "fill" | "strokeWidth" | "radius" | "strokeStyle"
  >
>;

export type CanvasNodeTextDefaults = Required<
  Pick<
    CanvasNodeStyle,
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "fontStyle"
    | "textDecoration"
    | "textAlign"
    | "verticalAlign"
    | "textColor"
    | "textOpacity"
  >
>;

export interface CanvasThemePalette {
  surface: string;
  border: string;
  text: string;
  edge: string;
}

export type CanvasNodeUiTextStyle = Omit<
  CanvasNodeTextDefaults,
  "textColor"
> & { textColor?: string };

export function canvasThemePalette(theme: WhiteboardTheme): CanvasThemePalette {
  return theme === "dark"
    ? {
        surface: "#1a1d24",
        border: "#3d4452",
        text: "#e8eaed",
        edge: "#6b7280",
      }
    : {
        surface: "#ffffff",
        border: "#e5e7eb",
        text: "#111827",
        edge: "#9ca3af",
      };
}

export function canvasNodeSurfaceDefaults(
  kind: CanvasNodeKind,
): CanvasNodeSurfaceDefaults {
  if (kind === "frame") {
    return {
      stroke: "#d1d5db",
      fill: "transparent",
      strokeWidth: 1,
      radius: 8,
      strokeStyle: "dashed",
    };
  }
  if (
    kind === "rect" ||
    kind === "ellipse" ||
    kind === "line" ||
    kind === "arrow"
  ) {
    return {
      stroke: "#1f2937",
      fill: "#ffffff",
      strokeWidth: 2,
      radius: 8,
      strokeStyle: "solid",
    };
  }
  return {
    stroke: "#e5e7eb",
    fill: "#ffffff",
    strokeWidth: 1,
    radius: 8,
    strokeStyle: "solid",
  };
}

export function canvasNodeUiSurfaceDefaults(
  kind: CanvasNodeKind,
  theme: WhiteboardTheme,
): CanvasNodeSurfaceDefaults {
  const defaults = canvasNodeSurfaceDefaults(kind);
  if (theme === "light") return defaults;
  const palette = canvasThemePalette(theme);
  if (kind === "frame") {
    return { ...defaults, stroke: palette.border };
  }
  if (kind === "rect" || kind === "ellipse") {
    return { ...defaults, stroke: palette.text, fill: palette.surface };
  }
  if (kind === "line" || kind === "arrow") {
    return { ...defaults, stroke: palette.edge, fill: palette.surface };
  }
  return { ...defaults, stroke: palette.border, fill: palette.surface };
}

export function canvasNodeTextDefaults(
  kind: CanvasNodeKind,
): CanvasNodeTextDefaults {
  const common = {
    fontFamily: "system-ui, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    textColor: "#111827",
    textOpacity: 1,
  } as const;
  if (
    kind === "item" ||
    kind === "pdf" ||
    kind === "attachment" ||
    kind === "literature" ||
    kind === "frame"
  ) {
    return {
      ...common,
      fontSize: 13,
      fontWeight: "bold",
      textAlign: "left",
      verticalAlign: "top",
    };
  }
  if (kind === "quote" || kind === "note") {
    return {
      ...common,
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "left",
      verticalAlign: "top",
    };
  }
  return {
    ...common,
    fontSize: 16,
    fontWeight: "normal",
    textAlign: "center",
    verticalAlign: "middle",
  };
}

export function effectiveCanvasNodeTextStyle(
  kind: CanvasNodeKind,
  style: Partial<CanvasNodeStyle> = {},
): CanvasNodeTextDefaults {
  const defaults = canvasNodeTextDefaults(kind);
  const fontSize = style.fontSize;
  return {
    fontFamily: style.fontFamily || defaults.fontFamily,
    fontSize:
      typeof fontSize === "number" && Number.isFinite(fontSize) && fontSize > 0
        ? fontSize
        : defaults.fontSize,
    fontWeight: style.fontWeight ?? defaults.fontWeight,
    fontStyle: style.fontStyle ?? defaults.fontStyle,
    textDecoration: style.textDecoration ?? defaults.textDecoration,
    textAlign: style.textAlign ?? defaults.textAlign,
    verticalAlign: style.verticalAlign ?? defaults.verticalAlign,
    textColor: style.textColor || defaults.textColor,
    textOpacity: style.textOpacity ?? defaults.textOpacity,
  };
}

export function effectiveCanvasNodeUiTextStyle(
  kind: CanvasNodeKind,
  style: Partial<CanvasNodeStyle> = {},
): CanvasNodeUiTextStyle {
  const { textColor: _deterministicColor, ...effective } =
    effectiveCanvasNodeTextStyle(kind, style);
  return {
    ...effective,
    ...(style.textColor ? { textColor: style.textColor } : {}),
  };
}

export interface LiteratureNodeOptions {
  source: LiteratureSource;
  snapshot: LiteratureSnapshot;
}

export interface QuoteNodeOptions {
  source: QuoteSource;
  snapshot: QuoteSnapshot;
}

export interface NoteNodeOptions {
  content?: string;
  badge?: string;
  style?: CanvasNodeStyle;
  width?: number;
  height?: number;
}

export function createAcademicNode(
  kind: "literature",
  position: CanvasPoint,
  id: string,
  options: LiteratureNodeOptions,
): LiteratureNode;
export function createAcademicNode(
  kind: "quote",
  position: CanvasPoint,
  id: string,
  options: QuoteNodeOptions,
): QuoteNode;
export function createAcademicNode(
  kind: "note",
  position: CanvasPoint,
  id: string,
  options?: NoteNodeOptions,
): NoteNode;
export function createAcademicNode(
  kind: "frame",
  position: CanvasPoint,
  id: string,
): FrameNode;
export function createAcademicNode(
  kind: AcademicNodeKind,
  position: CanvasPoint,
  id: string,
  options?: LiteratureNodeOptions | QuoteNodeOptions | NoteNodeOptions,
): AcademicNode {
  switch (kind) {
    case "literature":
      return {
        id,
        kind,
        position,
        ...ACADEMIC_SOURCE_CARD_SIZE.literature,
        source: (options as LiteratureNodeOptions).source,
        snapshot: (options as LiteratureNodeOptions).snapshot,
      };
    case "quote":
      return {
        id,
        kind,
        position,
        ...ACADEMIC_SOURCE_CARD_SIZE.quote,
        source: (options as QuoteNodeOptions).source,
        snapshot: (options as QuoteNodeOptions).snapshot,
      };
    case "note":
      return {
        id,
        kind,
        position,
        width: (options as NoteNodeOptions | undefined)?.width ?? 260,
        height: (options as NoteNodeOptions | undefined)?.height ?? 152,
        content: (options as NoteNodeOptions | undefined)?.content ?? "",
        ...((options as NoteNodeOptions | undefined)?.badge !== undefined
          ? { badge: (options as NoteNodeOptions).badge }
          : {}),
        ...((options as NoteNodeOptions | undefined)?.style
          ? { style: { ...(options as NoteNodeOptions).style } }
          : {}),
      };
    case "frame":
      return { id, kind, position, width: 480, height: 320, title: "Frame" };
  }
}
