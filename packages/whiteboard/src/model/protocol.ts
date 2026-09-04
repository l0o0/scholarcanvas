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
  selection: string;
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
  sourceStatus: string;
  sourceIdle: string;
  sourceAvailable: string;
  sourceLoading: string;
  sourceMissing: string;
  acquisitionSummary: string;
  dropMalformed: string;
  dropUnsupported: string;
  acquisitionFailed: string;
  sourceOpenFailed: string;
  sourceRefreshFailed: string;
  noteRefreshFailed: string;
  failureLibraryMissing: string;
  failureItemMissing: string;
  failureWrongKind: string;
  failureParentMismatch: string;
  failureAttachmentUnavailable: string;
  failureAnnotationUnavailable: string;
  failureResolutionFailed: string;
  failureOpenFailed: string;
  failureListFailed: string;
  openSource: string;
  refreshSource: string;
  refreshNote: string;
  viewAnnotations: string;
  annotationBrowserTitle: string;
  searchAnnotations: string;
  annotationsLoading: string;
  annotationsEmpty: string;
  annotationsUnavailable: string;
  annotationsPartialFailure: string;
  annotationAlreadyAdded: string;
  focusExistingAnnotation: string;
  addSelectedAnnotations: string;
  annotationPage: string;
  noteOverwriteTitle: string;
  noteOverwriteBody: string;
  confirm: string;
  cancel: string;
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

export type SourceResolutionPriority = "selected" | "visible" | "idle";

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

export interface IndexedAcademicAcquisition {
  index: number;
  acquisition: AcademicAcquisition;
}

/** Ordered, persistence-safe identity used after the host resolves a Zotero drag. */
export interface AcademicDropSourceRef {
  library: LiteratureSource["library"];
  itemKey: string;
}

export type AcademicDropFailureCode = "drop-malformed" | "drop-unsupported";

export type AcademicRequestFailureCode =
  | "picker-cancelled"
  | "picker-failed"
  | "acquisition-failed"
  | "library-missing"
  | "item-missing"
  | "wrong-kind"
  | "parent-mismatch"
  | "note-refresh-failed";

export type AcademicAcquisitionFailureCode =
  | "item-missing"
  | "unsupported-attachment"
  | "unsupported-kind"
  | "acquisition-failed";

export interface AcademicAcquisitionFailure {
  index: number;
  code: AcademicAcquisitionFailureCode;
  message: string;
}

export interface AcademicAcquisitionBatch {
  successes: IndexedAcademicAcquisition[];
  failures: AcademicAcquisitionFailure[];
}

export interface AcademicSourceActionFailure {
  code: AcademicSourceActionFailureCode;
  message: string;
}

export type AcademicIntegrityFailureCode =
  "library-missing" | "item-missing" | "wrong-kind" | "parent-mismatch";

export type AcademicSourceActionFailureCode =
  AcademicIntegrityFailureCode | "open-failed";

export type SourceResolutionFailureCode =
  AcademicIntegrityFailureCode | "resolution-failed";

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
      code: SourceResolutionFailureCode;
      message: string;
    };

export interface AnnotationCandidate {
  acquisition: Extract<AcademicAcquisition, { kind: "quote" }>;
  attachmentTitle: string;
  sortIndex: string;
}

export type AnnotationListFailureCode =
  | "library-missing"
  | "item-missing"
  | "wrong-kind"
  | "parent-mismatch"
  | "attachment-unavailable"
  | "annotation-unavailable"
  | "list-failed";

export interface AnnotationListFailure {
  code: AnnotationListFailureCode;
  message: string;
  attachmentKey?: string;
  annotationKey?: string;
}

export interface AnnotationListResult {
  candidates: AnnotationCandidate[];
  failures: AnnotationListFailure[];
}

export type CanvasFailureCode =
  | AcademicSourceActionFailureCode
  | SourceResolutionFailureCode
  | AnnotationListFailureCode
  | "note-refresh-failed";

export type CanvasNotice =
  | {
      code: "acquisition-summary";
      context: { successCount: number; failureCount: number };
    }
  | { code: AcademicDropFailureCode }
  | { code: "acquisition-failed" }
  | {
      code: "source-open-failed";
      nodeId: string;
      failureCode: AcademicSourceActionFailureCode;
    }
  | {
      code: "source-refresh-failed";
      nodeId: string;
      failureCode: SourceResolutionFailureCode;
    }
  | {
      code: "note-refresh-failed";
      nodeId: string;
      failureCode: AcademicIntegrityFailureCode | "note-refresh-failed";
    }
  | {
      code: "annotations-unavailable";
      requestId: string;
      failureCode: AnnotationListFailureCode;
    }
  | {
      code: "annotations-partial-failure";
      requestId: string;
      failureCodes: AnnotationListFailureCode[];
    };

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
        type: "academicSourcesAcquired";
        payload: {
          requestId: string;
          nodeId: string;
          successes: IndexedAcademicAcquisition[];
          failures: AcademicAcquisitionFailure[];
        };
      }
    | {
        type: "academicDropStarted";
        payload: {
          requestId: string;
          nodeId: string;
          position: { x: number; y: number };
          sources: AcademicDropSourceRef[];
        };
      }
    | {
        type: "academicDropRejected";
        payload: { code: AcademicDropFailureCode };
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
          failures: AnnotationListFailure[];
        };
      }
    | {
        type: "annotationListFailed";
        payload: {
          requestId: string;
          source: LiteratureSource;
          failure: AnnotationListFailure;
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
        payload: {
          requestId: string;
          nodeId: string;
          code: AcademicRequestFailureCode;
          diagnostic?: string;
        };
      }
    | {
        type: "sourceActionFailed";
        payload: {
          requestId: string;
          nodeId: string;
          source: AcademicSourceDescriptor;
          failure: AcademicSourceActionFailure;
        };
      }
    | {
        type: "sourceActionSucceeded";
        payload: {
          requestId: string;
          nodeId: string;
          action: "open";
          source: AcademicSourceDescriptor;
        };
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
          sources: AcademicDropSourceRef[];
        };
      }
    | {
        type: "resolveAcademicSources";
        payload: {
          requestId: string;
          generation: number;
          priority: SourceResolutionPriority;
          sources: Array<{
            nodeId: string;
            source: AcademicSourceDescriptor;
            refresh?: boolean;
          }>;
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
        payload: {
          requestId: string;
          nodeId: string;
          source: AcademicSourceDescriptor;
        };
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
): data is WhiteboardProtocolMessage & { type: string } {
  return isWhiteboardProtocolMessage(data) && data.channel === channel;
}

type ProtocolRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is ProtocolRecord {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isLibraryRef(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  if (value.type === "user") return true;
  return (
    value.type === "group" &&
    Number.isSafeInteger(value.groupID) &&
    (value.groupID as number) > 0
  );
}

function isLiteratureSource(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isLibraryRef(value.library) &&
    isString(value.itemKey)
  );
}

function isNoteSource(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isLibraryRef(value.library) &&
    isString(value.noteKey) &&
    isOptionalString(value.itemKey)
  );
}

function isQuoteSource(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return (
    isLiteratureSource(value) &&
    isString(value.attachmentKey) &&
    isString(value.annotationKey)
  );
}

function isAcademicSourceDescriptor(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  if (value.kind === "literature") return isLiteratureSource(value.source);
  if (value.kind === "note") return isNoteSource(value.source);
  if (value.kind === "quote") return isQuoteSource(value.source);
  return false;
}

function isLiteratureSnapshot(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isString(value.title) &&
    isOptionalString(value.creators) &&
    isOptionalString(value.year) &&
    isOptionalString(value.publicationTitle) &&
    (value.tags === undefined || isStringArray(value.tags)) &&
    isOptionalNumber(value.annotationCount)
  );
}

function isQuoteSnapshot(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isString(value.text) &&
    isOptionalString(value.comment) &&
    isOptionalString(value.citation) &&
    isOptionalString(value.pageLabel) &&
    isOptionalString(value.color)
  );
}

function isAcademicAcquisition(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  if (value.kind === "literature") {
    return (
      isLiteratureSource(value.source) && isLiteratureSnapshot(value.snapshot)
    );
  }
  if (value.kind === "quote") {
    return isQuoteSource(value.source) && isQuoteSnapshot(value.snapshot);
  }
  return (
    value.kind === "note" &&
    isNoteSource(value.source) &&
    isString(value.content) &&
    (value.sourceSnapshot === undefined ||
      (isPlainRecord(value.sourceSnapshot) &&
        isOptionalString(value.sourceSnapshot.title)))
  );
}

function isCanvasDocument(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    value.version === 2 &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.connections)
  );
}

function isAcademicDropSource(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isLibraryRef(value.library) &&
    isString(value.itemKey)
  );
}

function isAcademicSourceRequest(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isString(value.nodeId) &&
    isAcademicSourceDescriptor(value.source) &&
    (value.refresh === undefined || typeof value.refresh === "boolean")
  );
}

const acquisitionFailureCodes = new Set<AcademicAcquisitionFailureCode>([
  "item-missing",
  "unsupported-attachment",
  "unsupported-kind",
  "acquisition-failed",
]);
const requestFailureCodes = new Set<AcademicRequestFailureCode>([
  "picker-cancelled",
  "picker-failed",
  "acquisition-failed",
  "library-missing",
  "item-missing",
  "wrong-kind",
  "parent-mismatch",
  "note-refresh-failed",
]);
const sourceActionFailureCodes = new Set<AcademicSourceActionFailureCode>([
  "library-missing",
  "item-missing",
  "wrong-kind",
  "parent-mismatch",
  "open-failed",
]);
const resolutionFailureCodes = new Set<SourceResolutionFailureCode>([
  "library-missing",
  "item-missing",
  "wrong-kind",
  "parent-mismatch",
  "resolution-failed",
]);
const annotationFailureCodes = new Set<AnnotationListFailureCode>([
  "library-missing",
  "item-missing",
  "wrong-kind",
  "parent-mismatch",
  "attachment-unavailable",
  "annotation-unavailable",
  "list-failed",
]);

function isFailureWithCode(
  value: unknown,
  codes: ReadonlySet<string>,
): boolean {
  return (
    isPlainRecord(value) &&
    isString(value.code) &&
    codes.has(value.code) &&
    isString(value.message)
  );
}

function isIndexedAcquisition(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    Number.isSafeInteger(value.index) &&
    (value.index as number) >= 0 &&
    isAcademicAcquisition(value.acquisition)
  );
}

function isAcquisitionFailure(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return (
    isFailureWithCode(value, acquisitionFailureCodes) &&
    Number.isSafeInteger(value.index) &&
    (value.index as number) >= 0
  );
}

function isSourceActionFailure(value: unknown): boolean {
  return isFailureWithCode(value, sourceActionFailureCodes);
}

function isResolutionResult(value: unknown): boolean {
  if (
    !isPlainRecord(value) ||
    !isString(value.nodeId) ||
    !Number.isSafeInteger(value.generation)
  ) {
    return false;
  }
  if (value.status === "resolved") {
    return isAcademicAcquisition(value.acquisition);
  }
  return (
    value.status === "unavailable" &&
    isFailureWithCode(value, resolutionFailureCodes)
  );
}

function isAnnotationFailure(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return (
    isFailureWithCode(value, annotationFailureCodes) &&
    isOptionalString(value.attachmentKey) &&
    isOptionalString(value.annotationKey)
  );
}

function isAnnotationCandidate(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isString(value.attachmentTitle) &&
    isString(value.sortIndex) &&
    isPlainRecord(value.acquisition) &&
    value.acquisition.kind === "quote" &&
    isAcademicAcquisition(value.acquisition)
  );
}

function hasRequestAndNode(payload: ProtocolRecord): boolean {
  return isString(payload.requestId) && isString(payload.nodeId);
}

function hasProtocolEnvelope(
  data: unknown,
  channel: string,
): data is ProtocolRecord {
  return (
    isPlainRecord(data) &&
    data.source === WHITEBOARD_MESSAGE_SOURCE &&
    data.channel === channel &&
    data.v === WHITEBOARD_PROTOCOL_VERSION &&
    isString(data.type)
  );
}

/** Closed runtime validator for messages handled by the Zotero host. */
export function isWhiteboardToParentMessageForChannel(
  data: unknown,
  channel: string,
): data is WhiteboardToParentMessage {
  if (!hasProtocolEnvelope(data, channel)) return false;
  const payload = data.payload;
  switch (data.type) {
    case "ready":
    case "save":
      return payload === undefined;
    case "change":
      return isPlainRecord(payload) && isFiniteNumber(payload.rev);
    case "snapshot":
      return (
        isPlainRecord(payload) &&
        isString(payload.requestId) &&
        isFiniteNumber(payload.rev) &&
        isCanvasDocument(payload.snapshot)
      );
    case "error":
      return isPlainRecord(payload) && isString(payload.message);
    case "pickAcademicSource":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        payload.kind === "literature"
      );
    case "openItem":
      return (
        isPlainRecord(payload) &&
        isOptionalNumber(payload.itemID) &&
        isOptionalNumber(payload.attachmentID) &&
        isOptionalNumber(payload.pdfPage)
      );
    case "dropAcademicSources":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        Array.isArray(payload.sources) &&
        payload.sources.every(isAcademicDropSource)
      );
    case "resolveAcademicSources":
      return (
        isPlainRecord(payload) &&
        isString(payload.requestId) &&
        Number.isSafeInteger(payload.generation) &&
        (payload.priority === "selected" ||
          payload.priority === "visible" ||
          payload.priority === "idle") &&
        Array.isArray(payload.sources) &&
        payload.sources.every(isAcademicSourceRequest)
      );
    case "listLiteratureAnnotations":
      return (
        isPlainRecord(payload) &&
        isString(payload.requestId) &&
        isLiteratureSource(payload.source)
      );
    case "refreshZoteroNote":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        isNoteSource(payload.source)
      );
    case "openAcademicSource":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        isAcademicSourceDescriptor(payload.source)
      );
    case "exportFile":
      return (
        isPlainRecord(payload) &&
        isString(payload.requestId) &&
        (payload.format === "png" ||
          payload.format === "svg" ||
          payload.format === "md") &&
        isString(payload.mimeType) &&
        isOptionalString(payload.dataUrl) &&
        isOptionalString(payload.text)
      );
    default:
      return false;
  }
}

/** Closed runtime validator for messages handled by the whiteboard iframe. */
export function isParentToWhiteboardMessageForChannel(
  data: unknown,
  channel: string,
): data is ParentToWhiteboardMessage {
  if (!hasProtocolEnvelope(data, channel)) return false;
  const payload = data.payload;
  switch (data.type) {
    case "focus":
    case "destroy":
      return payload === undefined;
    case "init":
      return (
        isPlainRecord(payload) &&
        (payload.theme === "light" || payload.theme === "dark") &&
        (payload.snapshot === undefined ||
          payload.snapshot === null ||
          isCanvasDocument(payload.snapshot)) &&
        (payload.labels === undefined || isPlainRecord(payload.labels))
      );
    case "setTheme":
      return (
        isPlainRecord(payload) &&
        (payload.theme === "light" || payload.theme === "dark")
      );
    case "loadSnapshot":
      return isPlainRecord(payload) && isCanvasDocument(payload.snapshot);
    case "requestSnapshot":
      return isPlainRecord(payload) && isString(payload.requestId);
    case "command":
      return (
        isPlainRecord(payload) &&
        (payload.command === "undo" || payload.command === "redo")
      );
    case "saveState":
      return (
        isPlainRecord(payload) &&
        (payload.state === "saved" ||
          payload.state === "saving" ||
          payload.state === "error")
      );
    case "academicDropStarted":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        isPlainRecord(payload.position) &&
        isFiniteNumber(payload.position.x) &&
        isFiniteNumber(payload.position.y) &&
        Array.isArray(payload.sources) &&
        payload.sources.every(isAcademicDropSource)
      );
    case "academicDropRejected":
      return (
        isPlainRecord(payload) &&
        (payload.code === "drop-malformed" ||
          payload.code === "drop-unsupported")
      );
    case "academicSourceAcquired":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        isAcademicAcquisition(payload.acquisition)
      );
    case "academicSourcesAcquired":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        Array.isArray(payload.successes) &&
        payload.successes.every(isIndexedAcquisition) &&
        Array.isArray(payload.failures) &&
        payload.failures.every(isAcquisitionFailure)
      );
    case "academicRequestFailed":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        isString(payload.code) &&
        requestFailureCodes.has(payload.code as AcademicRequestFailureCode) &&
        isOptionalString(payload.diagnostic)
      );
    case "sourceActionFailed":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        isAcademicSourceDescriptor(payload.source) &&
        isSourceActionFailure(payload.failure)
      );
    case "sourceActionSucceeded":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        payload.action === "open" &&
        isAcademicSourceDescriptor(payload.source)
      );
    case "sourceResolutionBatch":
      return (
        isPlainRecord(payload) &&
        isString(payload.requestId) &&
        Number.isSafeInteger(payload.generation) &&
        Array.isArray(payload.results) &&
        payload.results.every(isResolutionResult)
      );
    case "annotationsListed":
      return (
        isPlainRecord(payload) &&
        isString(payload.requestId) &&
        isLiteratureSource(payload.source) &&
        Array.isArray(payload.candidates) &&
        payload.candidates.every(isAnnotationCandidate) &&
        Array.isArray(payload.failures) &&
        payload.failures.every(isAnnotationFailure)
      );
    case "annotationListFailed":
      return (
        isPlainRecord(payload) &&
        isString(payload.requestId) &&
        isLiteratureSource(payload.source) &&
        isAnnotationFailure(payload.failure)
      );
    case "noteRefreshed":
      return (
        isPlainRecord(payload) &&
        hasRequestAndNode(payload) &&
        isPlainRecord(payload.acquisition) &&
        payload.acquisition.kind === "note" &&
        isAcademicAcquisition(payload.acquisition)
      );
    default:
      return false;
  }
}

type WhiteboardMessageEvent = Pick<MessageEvent, "data" | "source">;

function isExpectedPeerSource(
  source: MessageEventSource | null,
  peer: MessageEventSource | null,
): boolean {
  // Zotero chrome can strip MessageEvent.source in both bridge directions.
  // The exact per-tab channel and closed schema are validated before this
  // narrow null exception. Non-null sources must retain object identity.
  return peer !== null && (source === null || source === peer);
}

export function isWhiteboardToParentMessageEvent(
  event: WhiteboardMessageEvent,
  peer: MessageEventSource | null,
  channel: string,
): event is WhiteboardMessageEvent & { data: WhiteboardToParentMessage } {
  return (
    isWhiteboardToParentMessageForChannel(event.data, channel) &&
    isExpectedPeerSource(event.source, peer)
  );
}

export function isParentToWhiteboardMessageEvent(
  event: WhiteboardMessageEvent,
  peer: MessageEventSource | null,
  channel: string,
): event is WhiteboardMessageEvent & { data: ParentToWhiteboardMessage } {
  return (
    isParentToWhiteboardMessageForChannel(event.data, channel) &&
    isExpectedPeerSource(event.source, peer)
  );
}

export function dispatchWhiteboardParentMessageEvent(
  event: WhiteboardMessageEvent,
  peer: MessageEventSource | null,
  channel: string,
  accept: (message: ParentToWhiteboardMessage) => void,
): boolean {
  if (!isParentToWhiteboardMessageEvent(event, peer, channel)) return false;
  accept(event.data);
  return true;
}

export function whiteboardChannel(tabID: string, canvasId: string) {
  return `${tabID}:${canvasId}`;
}
