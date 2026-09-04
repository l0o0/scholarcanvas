/**
 * postMessage protocol between the Zotero tab (parent) and the
 * whiteboard iframe (@xyflow/react host). Lives in the isolated
 * packages/whiteboard app so the canvas does not import plugin code.
 *
 * Pure module: no Zotero APIs. Distinct source from the Markdown editor
 * so the two iframes cannot accept each other's messages.
 */

import type { AttachmentNodeData, ItemNodeData, PdfNodeData } from "./basic";
import type {
  LiteratureSnapshot,
  LiteratureSource,
  NoteSource,
  NoteSourceSnapshot,
  QuoteSnapshot,
  QuoteSource,
} from "./academic";
import type { CanvasDocument } from "./document";

export const WHITEBOARD_MESSAGE_SOURCE = "zotero-markdown-whiteboard" as const;
export const WHITEBOARD_PROTOCOL_VERSION = 2;

export type WhiteboardTheme = "light" | "dark";

export type WhiteboardCommand = "undo" | "redo";

export type BasicPickerPayload =
  | ({ kind: "item" } & ItemNodeData)
  | ({ kind: "pdf" } & PdfNodeData)
  | ({ kind: "attachment" } & AttachmentNodeData);

export interface WhiteboardProtocolMessage {
  source: typeof WHITEBOARD_MESSAGE_SOURCE;
  channel?: string;
  v?: typeof WHITEBOARD_PROTOCOL_VERSION;
}

export interface WhiteboardLabels {
  canvas: string;
  select: string;
  hand: string;
  addItem: string;
  addNote: string;
  addQuestion: string;
  addClaim: string;
  addFrame: string;
  addPdf: string;
  addFile: string;
  addText: string;
  addRect: string;
  addEllipse: string;
  addLine: string;
  addArrow: string;
  kindLiterature: string;
  kindQuote: string;
  kindNote: string;
  kindQuestion: string;
  kindClaim: string;
  kindFrame: string;
  annotationColor: string;
  annotations: { one: string; other: string };
  eraser: string;
  undo: string;
  redo: string;
  save: string;
  editText: string;
  copy: string;
  delete: string;
  openItem: string;
  alignLeft: string;
  alignRight: string;
  alignTop: string;
  alignBottom: string;
  alignHorizontal: string;
  alignVertical: string;
  distributeHorizontal: string;
  distributeVertical: string;
  fitView: string;
  autoLayout: string;
  edgeColor: string;
  edgeDash: string;
  edgeArrow: string;
  saved: string;
  saving: string;
  saveFailed: string;
  exportPng: string;
  exportSvg: string;
  exportMarkdown: string;
  more: string;
  shortcutsTitle: string;
  close: string;
  stroke: string;
  background: string;
  style: string;
  solid: string;
  dashed: string;
  corners: string;
  format: string;
  color: string;
  size: string;
  alignment: string;
  textAlignment: string;
  verticalAlignment: string;
  fontSystem: string;
  fontGeorgia: string;
  fontTimes: string;
  fontInter: string;
  fontMenlo: string;
  fontSerifSc: string;
  weightRegular: string;
  weightBold: string;
  commonColors: string;
  recentColors: string;
  shortcutSelect: string;
  shortcutHand: string;
  shortcutRect: string;
  shortcutEllipse: string;
  shortcutArrow: string;
  shortcutLine: string;
  shortcutText: string;
  shortcutQuestion: string;
  shortcutClaim: string;
  shortcutFrame: string;
  shortcutEraser: string;
  shortcutConstrain: string;
  shortcutCancel: string;
  shortcutDelete: string;
  shortcutUndo: string;
  shortcutRedo: string;
}

export interface WhiteboardInitPayload {
  theme: WhiteboardTheme;
  snapshot?: CanvasDocument | null;
  labels?: WhiteboardLabels;
}

export type AcademicSourceDescriptor =
  | { kind: "literature"; source: LiteratureSource }
  | { kind: "note"; source: NoteSource }
  | { kind: "quote"; source: QuoteSource };

export type AcademicAcquisition =
  | {
      kind: "literature";
      source: LiteratureSource;
      snapshot: LiteratureSnapshot;
    }
  | {
      kind: "note";
      source: NoteSource;
      sourceSnapshot?: NoteSourceSnapshot;
      content: string;
    }
  | { kind: "quote"; source: QuoteSource; snapshot: QuoteSnapshot };

export type SourceResolutionResult =
  | {
      nodeId: string;
      generation: number;
      status: "resolved";
      acquisition: AcademicAcquisition;
    }
  | {
      nodeId: string;
      generation: number;
      status: "unavailable";
      code:
        "library-missing" | "item-missing" | "wrong-kind" | "parent-mismatch";
      message: string;
    };

export interface AnnotationCandidate {
  acquisition: Extract<AcademicAcquisition, { kind: "quote" }>;
  attachmentTitle: string;
  sortIndex: string;
}

export type ParentToWhiteboardMessage = WhiteboardProtocolMessage &
  (
    | { type: "init"; payload: WhiteboardInitPayload }
    | { type: "setTheme"; payload: { theme: WhiteboardTheme } }
    | {
        type: "loadSnapshot";
        payload: { snapshot: CanvasDocument };
      }
    | { type: "requestSnapshot"; payload: { requestId: string } }
    | { type: "command"; payload: { command: WhiteboardCommand } }
    | { type: "focus" }
    | { type: "destroy" }
    | {
        type: "itemPicked";
        payload: {
          requestId: string;
          nodeId: string;
          data: BasicPickerPayload;
        };
      }
    | {
        type: "pickFailed";
        payload: { requestId: string; message: string };
      }
    | {
        type: "academicSourceAcquired";
        payload: {
          requestId: string;
          nodeId: string;
          acquisition: AcademicAcquisition;
        };
      }
    | {
        type: "sourceResolutionBatch";
        payload: {
          requestId: string;
          generation: number;
          results: SourceResolutionResult[];
        };
      }
    | {
        type: "annotationsListed";
        payload: {
          requestId: string;
          source: LiteratureSource;
          candidates: AnnotationCandidate[];
        };
      }
    | {
        type: "noteRefreshed";
        payload: {
          requestId: string;
          nodeId: string;
          acquisition: Extract<AcademicAcquisition, { kind: "note" }>;
        };
      }
    | {
        type: "academicRequestFailed";
        payload: { requestId: string; nodeId: string; message: string };
      }
    | {
        type: "saveState";
        payload: { state: "saved" | "saving" | "error" };
      }
  );

export type WhiteboardToParentMessage = WhiteboardProtocolMessage &
  (
    | { type: "ready" }
    | { type: "change"; payload: { rev: number } }
    | {
        type: "snapshot";
        payload: {
          requestId: string;
          rev: number;
          snapshot: CanvasDocument;
        };
      }
    | { type: "save" }
    | { type: "error"; payload: { message: string } }
    | {
        type: "pickItem";
        payload: {
          requestId: string;
          nodeId: string;
          kind: "item" | "pdf" | "attachment";
        };
      }
    | {
        type: "openItem";
        payload: {
          itemID?: number;
          attachmentID?: number;
          pdfPage?: number;
        };
      }
    | {
        type: "dropItems";
        payload: {
          requestId: string;
          nodeId: string;
          raw: Record<string, string>;
        };
      }
    | {
        type: "pickAcademicSource";
        payload: {
          requestId: string;
          nodeId: string;
          kind: "literature";
        };
      }
    | {
        type: "dropAcademicSources";
        payload: {
          requestId: string;
          nodeId: string;
          raw: Record<string, string>;
        };
      }
    | {
        type: "resolveAcademicSources";
        payload: {
          requestId: string;
          generation: number;
          sources: Array<{ nodeId: string; source: AcademicSourceDescriptor }>;
        };
      }
    | {
        type: "listLiteratureAnnotations";
        payload: { requestId: string; source: LiteratureSource };
      }
    | {
        type: "refreshZoteroNote";
        payload: { requestId: string; nodeId: string; source: NoteSource };
      }
    | {
        type: "openAcademicSource";
        payload: { requestId: string; source: AcademicSourceDescriptor };
      }
    | {
        type: "exportFile";
        payload: {
          requestId: string;
          format: "png" | "svg" | "md";
          mimeType: string;
          dataUrl?: string;
          text?: string;
        };
      }
  );

export function isWhiteboardProtocolMessage(
  data: unknown,
): data is WhiteboardProtocolMessage & { type: string } {
  if (!data || typeof data !== "object") return false;
  const message = data as Partial<WhiteboardProtocolMessage> & {
    type?: unknown;
  };
  return (
    message.source === WHITEBOARD_MESSAGE_SOURCE &&
    typeof message.channel === "string" &&
    message.v === WHITEBOARD_PROTOCOL_VERSION &&
    typeof message.type === "string"
  );
}

export function isWhiteboardProtocolMessageForChannel(
  data: unknown,
  channel: string,
): data is WhiteboardToParentMessage {
  return isWhiteboardProtocolMessage(data) && data.channel === channel;
}

export function whiteboardChannel(tabID: string, canvasId: string) {
  return `${tabID}:${canvasId}`;
}
