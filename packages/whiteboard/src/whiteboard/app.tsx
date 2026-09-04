/// <reference lib="dom" />

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./board.css";
import {
  createAcademicNode,
  effectiveCanvasNodeUiTextStyle,
  quoteSourceIdentity,
  type CanvasNode,
  type CanvasNodeKind,
  type LiteratureSource,
  type NoteSource,
} from "../model/academic";
import { createBasicNode } from "../model/basic";
import {
  demoCanvasDocument,
  parseCanvasDocument,
  type CanvasDocument,
} from "../model/document";
import type {
  AcademicAcquisition,
  AcademicAcquisitionFailure,
  AcademicDropFailureCode,
  AcademicDropSourceRef,
  AcademicRequestFailureCode,
  AcademicSourceDescriptor,
  AcademicSourceActionFailure,
  AnnotationCandidate,
  AnnotationListFailure,
  CanvasFailureCode,
  CanvasNotice,
  IndexedAcademicAcquisition,
  SourceResolutionPriority,
  SourceResolutionResult,
  WhiteboardLabels,
  WhiteboardTheme,
} from "../model/protocol";
import { canvasNodeTypes, type CanvasFlowNode } from "../nodes";
import { PropertiesPanel } from "../chrome/PropertiesPanel";
import {
  AnnotationBrowser,
  existingAnnotationKeys,
  toggleAnnotationSelection,
} from "../chrome/AnnotationBrowser";
import { ShortcutsOverlay } from "../chrome/ShortcutsOverlay";
import { StyleBar } from "../chrome/StyleBar";
import { TextStyleBar } from "../chrome/TextStyleBar";
import { TopIsland } from "../chrome/TopIsland";
import { WhiteboardLabelsProvider } from "../chrome/labels";
import {
  frameFromDrag,
  isBorderHit,
  isDrawTool,
  isLibraryKind,
  isStampTool,
  shouldEditOnCreate,
  toolAfterDraw,
  type DrawFrame,
  type DrawKind,
} from "../chrome/draw";
import type { CanvasTool } from "../chrome/tools";
import {
  alignNodes,
  autoLayoutNodes,
  distributeNodes,
  type AlignMode,
} from "./layout";
import { buildCanvasMarkdown, buildCanvasSvg, svgToPngDataUrl } from "./export";
import {
  acceptAnnotationListFailure,
  acceptAnnotationListResult,
  closeAnnotationBrowserSession,
  openAnnotationBrowserSession,
  replaceDocumentAnnotationBrowserSession,
  type AnnotationBrowserSession,
} from "./annotationBrowserState";
import {
  beginNodeEditing,
  canvasDocumentToFlow,
  flowNodeText,
  flowToCanvasDocument,
  labelTextStyle,
  mergeEditingStyle,
  toggleEditingBold,
  type CanvasFlowEdge,
  updateFlowNodeModel,
  verticalAlignmentStyle,
  withEdgeColor,
} from "./document";
import { armEditFocusHold, handleEditBlur } from "./editFocus";
import { IconCopy, IconEdit, IconExport, IconOpen, IconTrash } from "./icons";
import {
  beginFrameDragState,
  deleteNodeFromDocument,
  finishFrameDragState,
  moveNodesInDocument,
  settleFrameDragState,
  updateFrameDragState,
  type FrameDragState,
} from "./frame";
import { captureCanvasArrowKey, handleGlobalCanvasKeyDown } from "./keyboard";
import {
  createAcademicAcquisitionRuntime,
  omitAcademicPlaceholders,
  useCanvasDocumentRuntime,
  type AcademicAcquisitionRuntime,
} from "./runtime";
import {
  createQuoteBatchRuntime,
  createSourceActionCorrelation,
  createSourceRefreshRuntime,
  createSourceResolutionStates,
  prioritizedSourceRequests,
  sourceDescriptor,
  updateSourceResolutionStates,
  type SourceRefreshRuntime,
  type SourceResolutionRequest,
} from "./sourceState";
import {
  createNoteRefreshRuntime,
  type NoteRefreshRuntime,
} from "./noteRefresh";

const DEFAULT_LABELS: WhiteboardLabels = {
  canvas: "Canvas",
  selection: "Selection",
  select: "Select (V)",
  hand: "Hand (H)",
  addItem: "Item",
  addNote: "Note",
  addQuestion: "Question",
  addClaim: "Claim",
  addFrame: "Frame",
  addPdf: "PDF",
  addFile: "File",
  addText: "Text",
  addRect: "Rect",
  addEllipse: "Oval",
  addLine: "Line",
  addArrow: "Arrow",
  kindLiterature: "Literature",
  kindQuote: "Quote",
  kindNote: "Note",
  emptyNote: "Empty note",
  kindQuestion: "Question",
  kindClaim: "Claim",
  kindFrame: "Frame",
  annotationColor: "Annotation color",
  annotations: { one: "annotation", other: "annotations" },
  sourceStatus: "Source status",
  sourceIdle: "Not checked",
  sourceAvailable: "Available",
  sourceLoading: "Checking…",
  sourceMissing: "Source unavailable",
  acquisitionSummary:
    "Added {successCount} source(s); {failureCount} could not be added.",
  dropMalformed: "The Zotero drop could not be read.",
  dropUnsupported: "This Zotero drag type cannot be added to the canvas.",
  acquisitionFailed: "The Zotero source could not be added.",
  sourceOpenFailed: "The Zotero source could not be opened.",
  sourceRefreshFailed: "The Zotero source could not be refreshed.",
  noteRefreshFailed: "The Zotero Note could not be refreshed.",
  failureLibraryMissing: "The Zotero library is unavailable.",
  failureItemMissing: "The Zotero item no longer exists.",
  failureWrongKind: "The Zotero item type no longer matches this source.",
  failureParentMismatch: "The Zotero item's parent has changed.",
  failureAttachmentUnavailable: "The Zotero attachment is unavailable.",
  failureAnnotationUnavailable: "The Zotero annotation is unavailable.",
  failureResolutionFailed: "Zotero could not resolve the current source.",
  failureOpenFailed: "Zotero could not open the current source.",
  failureListFailed: "Zotero could not list annotations for this source.",
  openSource: "Open source",
  refreshSource: "Refresh source",
  refreshNote: "Refresh from Zotero",
  viewAnnotations: "View annotations",
  annotationBrowserTitle: "Annotations",
  searchAnnotations: "Search annotations",
  annotationsLoading: "Loading annotations…",
  annotationsEmpty: "No supported annotations",
  annotationsUnavailable: "Annotations unavailable",
  annotationsPartialFailure: "Some annotations could not be loaded",
  annotationAlreadyAdded: "Already added",
  focusExistingAnnotation: "Focus existing",
  addSelectedAnnotations: "Add selected",
  annotationPage: "Page",
  noteOverwriteTitle: "Replace local Note?",
  noteOverwriteBody:
    "Zotero's current Note will replace local content. Local changes will be lost.",
  confirm: "Replace",
  cancel: "Cancel",
  eraser: "Eraser",
  undo: "Undo",
  redo: "Redo",
  save: "Save",
  editText: "Edit text",
  copy: "Copy",
  delete: "Delete",
  openItem: "Open item",
  alignLeft: "Align left",
  alignRight: "Align right",
  alignTop: "Align top",
  alignBottom: "Align bottom",
  alignHorizontal: "Align horizontal center",
  alignVertical: "Align vertical center",
  distributeHorizontal: "Distribute horizontally",
  distributeVertical: "Distribute vertically",
  fitView: "Fit view",
  autoLayout: "Auto layout",
  edgeColor: "Edge color",
  edgeDash: "Toggle dashed",
  edgeArrow: "Toggle arrow",
  saved: "Saved",
  saving: "Saving…",
  saveFailed: "Save failed",
  exportPng: "Export PNG",
  exportSvg: "Export SVG",
  exportMarkdown: "Export Markdown",
  more: "More",
  shortcutsTitle: "Keyboard shortcuts",
  close: "Close",
  stroke: "Stroke",
  background: "Background",
  style: "Style",
  solid: "Solid",
  dashed: "Dashed",
  corners: "Corners",
  format: "Format",
  color: "Color",
  size: "Size",
  alignment: "Alignment",
  textAlignment: "Text alignment",
  verticalAlignment: "Vertical alignment",
  fontSystem: "System font",
  fontGeorgia: "Georgia",
  fontTimes: "Times",
  fontInter: "Inter",
  fontMenlo: "Menlo",
  fontSerifSc: "Noto Serif SC",
  weightRegular: "Regular",
  weightBold: "Bold",
  commonColors: "Common custom colors",
  recentColors: "Recently used colors",
  shortcutSelect: "Select",
  shortcutHand: "Pan canvas",
  shortcutRect: "Draw rectangle",
  shortcutEllipse: "Draw ellipse",
  shortcutArrow: "Draw arrow",
  shortcutLine: "Draw line",
  shortcutText: "Add text",
  shortcutQuestion: "Add question",
  shortcutClaim: "Add claim",
  shortcutFrame: "Add frame",
  shortcutEraser: "Erase",
  shortcutConstrain: "Constrain ratio or angle while drawing",
  shortcutCancel: "Cancel drawing or close menu",
  shortcutDelete: "Delete selection",
  shortcutUndo: "Undo",
  shortcutRedo: "Redo",
};

export interface WhiteboardAppProps {
  theme: WhiteboardTheme;
  labels?: WhiteboardLabels;
  initialSnapshot?: CanvasDocument;
  onReady: (api: WhiteboardRuntime) => void;
  onChange: (rev: number) => void;
  onError: (message: string) => void;
  onSave: () => void;
  onPickAcademicSource: (
    requestId: string,
    nodeId: string,
    kind: "literature",
  ) => void;
  onOpenItem: (payload: {
    itemID?: number;
    attachmentID?: number;
    pdfPage?: number;
  }) => void;
  onDropAcademicSources: (
    requestId: string,
    nodeId: string,
    sources: AcademicDropSourceRef[],
  ) => void;
  onResolveAcademicSources?: (
    requestId: string,
    generation: number,
    priority: SourceResolutionPriority,
    sources: SourceResolutionRequest[],
  ) => void;
  onOpenAcademicSource?: (
    requestId: string,
    nodeId: string,
    source: AcademicSourceDescriptor,
  ) => void;
  onRefreshZoteroNote: (
    requestId: string,
    nodeId: string,
    source: NoteSource,
  ) => void;
  onListLiteratureAnnotations?: (
    requestId: string,
    source: LiteratureSource,
  ) => void;
  onExportFile: (payload: {
    requestId: string;
    format: "png" | "svg" | "md";
    mimeType: string;
    dataUrl?: string;
    text?: string;
  }) => void;
}

export interface WhiteboardRuntime {
  setTheme: (theme: WhiteboardTheme) => void;
  setLabels: (labels: WhiteboardLabels) => void;
  loadSnapshot: (snapshot: CanvasDocument) => void;
  getSnapshot: () => CanvasDocument;
  undo: () => void;
  redo: () => void;
  beginAcademicDrop: (
    requestId: string,
    nodeId: string,
    position: { x: number; y: number },
    sources: AcademicDropSourceRef[],
  ) => void;
  rejectAcademicDrop: (code: AcademicDropFailureCode) => void;
  resolveAcademicAcquisition: (
    requestId: string,
    nodeId: string,
    acquisition: AcademicAcquisition,
  ) => void;
  resolveAcademicAcquisitionBatch: (
    requestId: string,
    nodeId: string,
    successes: IndexedAcademicAcquisition[],
    failures: AcademicAcquisitionFailure[],
  ) => void;
  rejectAcademicRequest: (
    requestId: string,
    nodeId: string,
    code: AcademicRequestFailureCode,
  ) => void;
  rejectSourceAction: (
    requestId: string,
    nodeId: string,
    source: AcademicSourceDescriptor,
    failure: AcademicSourceActionFailure,
  ) => void;
  acceptSourceAction: (
    requestId: string,
    nodeId: string,
    action: "open",
    source: AcademicSourceDescriptor,
  ) => void;
  applySourceResolutionBatch: (
    generation: number,
    results: SourceResolutionResult[],
  ) => void;
  applyNoteRefresh: (
    requestId: string,
    nodeId: string,
    acquisition: Extract<AcademicAcquisition, { kind: "note" }>,
  ) => void;
  applyAnnotationCandidates: (
    requestId: string,
    source: LiteratureSource,
    candidates: AnnotationCandidate[],
    failures: AnnotationListFailure[],
  ) => void;
  rejectAnnotationList: (
    requestId: string,
    source: LiteratureSource,
    failure: AnnotationListFailure,
  ) => void;
  setSaveState: (state: "saved" | "saving" | "error") => void;
}

function newId(kind: string) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
}

const SOURCE_PRIORITY_ORDER: Record<SourceResolutionPriority, number> = {
  selected: 0,
  visible: 1,
  idle: 2,
};

export function canvasNoticeText(
  labels: WhiteboardLabels,
  notice: CanvasNotice,
): string {
  const withFailures = (
    message: string,
    codes: readonly CanvasFailureCode[],
  ) => {
    const reasons = [...new Set(codes)]
      .map((code) => canvasFailureText(labels, code))
      .filter((reason): reason is string => Boolean(reason));
    return reasons.length ? `${message} ${reasons.join(" ")}` : message;
  };
  switch (notice.code) {
    case "acquisition-summary":
      return labels.acquisitionSummary
        .replace("{successCount}", String(notice.context.successCount))
        .replace("{failureCount}", String(notice.context.failureCount));
    case "drop-malformed":
      return labels.dropMalformed;
    case "drop-unsupported":
      return labels.dropUnsupported;
    case "acquisition-failed":
      return labels.acquisitionFailed;
    case "source-open-failed":
      return withFailures(labels.sourceOpenFailed, [notice.failureCode]);
    case "source-refresh-failed":
      return withFailures(labels.sourceRefreshFailed, [notice.failureCode]);
    case "note-refresh-failed":
      return withFailures(labels.noteRefreshFailed, [notice.failureCode]);
    case "annotations-unavailable":
      return withFailures(labels.annotationsUnavailable, [notice.failureCode]);
    case "annotations-partial-failure":
      return withFailures(
        labels.annotationsPartialFailure,
        notice.failureCodes,
      );
  }
}

export function canvasFailureText(
  labels: WhiteboardLabels,
  code: CanvasFailureCode,
): string | null {
  switch (code) {
    case "library-missing":
      return labels.failureLibraryMissing;
    case "item-missing":
      return labels.failureItemMissing;
    case "wrong-kind":
      return labels.failureWrongKind;
    case "parent-mismatch":
      return labels.failureParentMismatch;
    case "attachment-unavailable":
      return labels.failureAttachmentUnavailable;
    case "annotation-unavailable":
      return labels.failureAnnotationUnavailable;
    case "resolution-failed":
      return labels.failureResolutionFailed;
    case "open-failed":
      return labels.failureOpenFailed;
    case "list-failed":
      return labels.failureListFailed;
    default:
      return null;
  }
}

const NOTICE_AUTO_DISMISS_MS = 8000;

export function CanvasNoticeRegion(props: {
  labels: WhiteboardLabels;
  notice: CanvasNotice | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}): ReactElement | null {
  const { labels, notice, onDismiss } = props;
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(
      onDismiss,
      props.autoDismissMs ?? NOTICE_AUTO_DISMISS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss, props.autoDismissMs]);
  if (!notice) return null;
  return (
    <div
      className="zmd-board-notice"
      data-tone={notice.code === "acquisition-summary" ? "info" : "error"}
    >
      <span role="status" aria-live="polite" aria-atomic="true">
        {canvasNoticeText(labels, notice)}
      </span>
      <button
        type="button"
        aria-label={labels.close}
        onClick={onDismiss}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onDismiss();
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

interface DrawSession {
  nodeId: string;
  kind: DrawKind;
  origin: { x: number; y: number };
  pointerId: number;
}

function nodeSize(node: CanvasFlowNode) {
  return {
    width:
      node.width ??
      (typeof node.style?.width === "number" ? node.style.width : 120),
    height:
      node.height ??
      (typeof node.style?.height === "number" ? node.style.height : 80),
  };
}

function applyDrawFrame(
  node: CanvasFlowNode,
  frame: DrawFrame,
  kind: DrawKind,
): CanvasFlowNode {
  let { position, width, height, start, end } = frame;
  if ((kind === "line" || kind === "arrow") && height < 16) {
    const pad = (16 - height) / 2;
    position = { x: position.x, y: position.y - pad };
    height = 16;
    start = { x: start.x, y: start.y + pad };
    end = { x: end.x, y: end.y + pad };
  }
  width = Math.max(width, 8);
  height = Math.max(height, 8);
  const next = updateFlowNodeModel(node, (model) => {
    if (model.kind !== "line" && model.kind !== "arrow") return model;
    return { ...model, data: { ...model.data, from: start, to: end } };
  });
  return {
    ...next,
    position,
    width,
    height,
    style: { width, height },
  };
}

function createCanvasNode(
  kind: CanvasNodeKind,
  position: { x: number; y: number },
  id: string,
): CanvasNode {
  if (kind === "note") return createAcademicNode("note", position, id);
  if (kind === "question") return createAcademicNode("question", position, id);
  if (kind === "claim") return createAcademicNode("claim", position, id);
  if (kind === "frame") return createAcademicNode("frame", position, id);
  if (kind === "literature" || kind === "quote") {
    throw new Error(`${kind} nodes require a Zotero source and snapshot.`);
  }
  return createBasicNode(kind, position, id);
}

function hasOpenTarget(node: CanvasFlowNode): boolean {
  const model = node.data.model;
  if (sourceDescriptor(model)) return true;
  if (!("data" in model)) return false;
  return (
    ("itemID" in model.data && Boolean(model.data.itemID)) ||
    ("attachmentID" in model.data && Boolean(model.data.attachmentID))
  );
}

export function WhiteboardApp(props: WhiteboardAppProps): ReactElement {
  const initial = useMemo(
    () =>
      parseCanvasDocument(props.initialSnapshot ?? demoCanvasDocument())
        .document,
    [props.initialSnapshot],
  );
  const flowRef = useRef<ReactFlowInstance<
    CanvasFlowNode,
    CanvasFlowEdge
  > | null>(null);
  const sourceGenerationRef = useRef(1);
  const sourceGenerationAnnouncedRef = useRef(0);
  const sourcePrioritiesRef = useRef(
    new Map<string, SourceResolutionPriority>(),
  );
  const sourceStatesRef = useRef(createSourceResolutionStates(initial.nodes));
  const [, renderSourceState] = useState(0);
  const cancelIdleResolutionRef = useRef<(() => void) | null>(null);
  const [sourceCycle, setSourceCycle] = useState(1);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [canvasNotice, setCanvasNotice] = useState<CanvasNotice | null>(null);
  const clearCanvasNotice = useCallback(() => setCanvasNotice(null), []);
  const showCanvasNotice = useCallback(
    (notice: CanvasNotice) => setCanvasNotice(notice),
    [],
  );
  const clearMatchingNotice = useCallback(
    (matches: (notice: CanvasNotice) => boolean) => {
      setCanvasNotice((current) => {
        if (!current || !matches(current)) return current;
        return null;
      });
    },
    [],
  );
  const openSourceRequestsRef = useRef(createSourceActionCorrelation());
  const academicAcquisitionRef = useRef<AcademicAcquisitionRuntime | null>(
    null,
  );
  const noteRefreshRuntimeRef = useRef<NoteRefreshRuntime | null>(null);
  const sourceRefreshRuntimeRef = useRef<SourceRefreshRuntime | null>(null);
  const documentRuntime = useCanvasDocumentRuntime(
    initial,
    (revision) => propsRef.current.onChange(revision),
    (viewport) => flowRef.current?.setViewport(viewport),
    (document) =>
      omitAcademicPlaceholders(
        document,
        academicAcquisitionRef.current?.pendingNodeIds() ?? [],
      ),
  );
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    nodesRef,
    edgesRef,
    viewportRef,
    shellRef,
    history: documentHistory,
    changed: bump,
    pushHistory,
    applyDocument,
    loadSnapshot: loadDocumentSnapshot,
    applySourceResolutionBatch: applyDocumentSourceResolutionBatch,
    applyLiteratureAnnotationCount,
    getRawSnapshot: workingSnapshot,
    getSnapshot: snapshotNow,
    undo,
    redo,
  } = documentRuntime;
  if (!academicAcquisitionRef.current) {
    academicAcquisitionRef.current = createAcademicAcquisitionRuntime({
      getNodes: () => nodesRef.current,
      setNodes,
      getEdges: () => edgesRef.current,
      setEdges,
      pushHistory,
      changed: bump,
      onError: (message) => propsRef.current.onError(message),
      onNotice: showCanvasNotice,
      createNodeId: () => newId("academic"),
      onPickAcademicSource: (requestId, nodeId, kind) =>
        propsRef.current.onPickAcademicSource(requestId, nodeId, kind),
      onDropAcademicSources: (requestId, nodeId, sources) =>
        propsRef.current.onDropAcademicSources(requestId, nodeId, sources),
    });
  }
  const academicAcquisition = academicAcquisitionRef.current;
  const [theme, setTheme] = useState<WhiteboardTheme>(props.theme);
  const [labels, setLabels] = useState<WhiteboardLabels>(
    props.labels ?? DEFAULT_LABELS,
  );
  if (!noteRefreshRuntimeRef.current) {
    noteRefreshRuntimeRef.current = createNoteRefreshRuntime({
      getWorkingDocument: workingSnapshot,
      getHistoryDocument: snapshotNow,
      applyDocument,
      commitHistory: (document) => documentHistory.commit(document),
      confirm: (warning) => window.confirm(warning),
      request: (requestId, nodeId, source) =>
        propsRef.current.onRefreshZoteroNote(requestId, nodeId, source),
      onError: (_message, nodeId) =>
        showCanvasNotice({
          code: "note-refresh-failed",
          nodeId,
          failureCode: "note-refresh-failed",
        }),
      createRequestId: () => newId("note-refresh"),
    });
  }
  const noteRefreshRuntime = noteRefreshRuntimeRef.current;
  if (!sourceRefreshRuntimeRef.current) {
    sourceRefreshRuntimeRef.current = createSourceRefreshRuntime({
      getNodes: () => nodesRef.current,
      applyResolutionBatch: applyDocumentSourceResolutionBatch,
      changed: bump,
    });
  }
  const sourceRefreshRuntime = sourceRefreshRuntimeRef.current;
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const eraser = activeTool === "eraser";
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [editing, setEditing] = useState<{
    nodeId: string;
    value: string;
  } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [styleTarget, setStyleTarget] = useState<string | null>(null);
  const [annotationBrowser, setAnnotationBrowser] =
    useState<AnnotationBrowserSession | null>(null);
  const annotationBrowserRef = useRef<AnnotationBrowserSession | null>(null);
  annotationBrowserRef.current = annotationBrowser;
  const annotationBrowserOriginNodeIdRef = useRef<string | null>(null);
  const viewAnnotationsRef = useRef<HTMLButtonElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const holdEditFocusRef = useRef(false);

  const runtimeRef = useRef<WhiteboardRuntime | null>(null);
  const drawRef = useRef<DrawSession | null>(null);
  const preDrawRef = useRef<{
    working: CanvasDocument;
    history: CanvasDocument;
  } | null>(null);
  const frameDragRef = useRef<FrameDragState | null>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const cancelIdleResolution = useCallback(() => {
    cancelIdleResolutionRef.current?.();
    cancelIdleResolutionRef.current = null;
  }, []);

  const requestSources = useCallback(
    (
      priority: SourceResolutionPriority,
      sources: readonly SourceResolutionRequest[],
      generation = sourceGenerationRef.current,
    ) => {
      if (generation !== sourceGenerationRef.current) return;
      const requested = sources.filter(({ nodeId, refresh }) => {
        const previous = sourcePrioritiesRef.current.get(nodeId);
        if (
          !refresh &&
          previous &&
          SOURCE_PRIORITY_ORDER[previous] <= SOURCE_PRIORITY_ORDER[priority]
        ) {
          return false;
        }
        sourcePrioritiesRef.current.set(nodeId, priority);
        return true;
      });
      const generationWasAnnounced =
        sourceGenerationAnnouncedRef.current === generation;
      if (!requested.length && generationWasAnnounced) return;
      sourceStatesRef.current = updateSourceResolutionStates(
        sourceStatesRef.current,
        requested.map(({ nodeId }) => ({ nodeId, status: "loading" })),
      );
      if (requested.length) renderSourceState((revision) => revision + 1);
      sourceGenerationAnnouncedRef.current = generation;
      propsRef.current.onResolveAcademicSources?.(
        newId("source-resolution"),
        generation,
        priority,
        requested,
      );
    },
    [],
  );

  const currentSourceRequests = useCallback(
    () =>
      prioritizedSourceRequests(nodesRef.current, viewportRef.current, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    [nodesRef, viewportRef],
  );

  const scheduleSourceResolution = useCallback(() => {
    cancelIdleResolution();
    const generation = sourceGenerationRef.current;
    const requests = currentSourceRequests();
    requestSources("selected", requests.selected, generation);
    requestSources("visible", requests.visible, generation);

    const runIdle = () => {
      cancelIdleResolutionRef.current = null;
      if (generation !== sourceGenerationRef.current) return;
      requestSources("idle", currentSourceRequests().idle, generation);
    };
    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(runIdle);
      cancelIdleResolutionRef.current = () => window.cancelIdleCallback(idleId);
    } else {
      const timeoutId = window.setTimeout(runIdle, 0);
      cancelIdleResolutionRef.current = () => window.clearTimeout(timeoutId);
    }
  }, [cancelIdleResolution, currentSourceRequests, requestSources]);

  const requestVisibleSources = useCallback(() => {
    const requests = currentSourceRequests();
    requestSources("selected", requests.selected);
    requestSources("visible", requests.visible);
  }, [currentSourceRequests, requestSources]);

  const loadSnapshot = useCallback(
    (value: CanvasDocument) => {
      cancelIdleResolution();
      annotationBrowserRef.current = replaceDocumentAnnotationBrowserSession(
        annotationBrowserRef.current,
      );
      setAnnotationBrowser(annotationBrowserRef.current);
      noteRefreshRuntimeRef.current?.clear();
      sourceRefreshRuntimeRef.current?.clear();
      academicAcquisitionRef.current?.clear();
      openSourceRequestsRef.current.clear();
      clearCanvasNotice();
      annotationBrowserOriginNodeIdRef.current = null;
      sourceGenerationRef.current += 1;
      sourcePrioritiesRef.current.clear();
      sourceStatesRef.current = createSourceResolutionStates(value.nodes);
      loadDocumentSnapshot(value);
      setSourceCycle(sourceGenerationRef.current);
    },
    [cancelIdleResolution, clearCanvasNotice, loadDocumentSnapshot],
  );

  const applySourceResolutionBatch = useCallback(
    (generation: number, results: SourceResolutionResult[]) => {
      if (generation !== sourceGenerationRef.current) return;
      const current = results.filter(
        (result) => result.generation === generation,
      );
      if (!current.length) return;
      sourceStatesRef.current = updateSourceResolutionStates(
        sourceStatesRef.current,
        current.map((result) =>
          result.status === "resolved"
            ? { nodeId: result.nodeId, status: "resolved" as const }
            : {
                nodeId: result.nodeId,
                status: "unavailable" as const,
                message: result.message,
              },
        ),
      );
      renderSourceState((revision) => revision + 1);
      const explicitResults = sourceRefreshRuntime.apply(generation, current);
      for (const result of explicitResults) {
        if (result.status !== "resolved") continue;
        clearMatchingNotice(
          (notice) =>
            notice.code === "source-refresh-failed" &&
            notice.nodeId === result.nodeId,
        );
      }
      const failedRefresh = explicitResults.find(
        (result) => result.status === "unavailable",
      );
      if (failedRefresh?.status === "unavailable") {
        showCanvasNotice({
          code: "source-refresh-failed",
          nodeId: failedRefresh.nodeId,
          failureCode: failedRefresh.code,
        });
      }
    },
    [clearMatchingNotice, showCanvasNotice, sourceRefreshRuntime],
  );

  const refreshNoteSource = useCallback(
    (node: CanvasFlowNode) => {
      noteRefreshRuntime.request(node, labels);
    },
    [labels, noteRefreshRuntime],
  );

  const refreshAcademicSource = useCallback(
    (node: CanvasFlowNode) => {
      const request = sourceRefreshRuntime.request(node);
      if (!request) return;
      requestSources("selected", [{ ...request, refresh: true }]);
    },
    [requestSources, sourceRefreshRuntime],
  );

  const refreshNodeSource = useCallback(
    (node: CanvasFlowNode) => {
      if (node.data.model.kind === "note") refreshNoteSource(node);
      else refreshAcademicSource(node);
    },
    [refreshAcademicSource, refreshNoteSource],
  );

  const applyNoteRefresh = useCallback(
    (
      requestId: string,
      nodeId: string,
      acquisition: Extract<AcademicAcquisition, { kind: "note" }>,
    ) => {
      if (noteRefreshRuntime.resolve(requestId, nodeId, acquisition)) {
        clearMatchingNotice(
          (notice) =>
            notice.code === "note-refresh-failed" && notice.nodeId === nodeId,
        );
        sourceStatesRef.current = updateSourceResolutionStates(
          sourceStatesRef.current,
          [{ nodeId, status: "resolved" }],
        );
        renderSourceState((revision) => revision + 1);
      }
    },
    [clearMatchingNotice, noteRefreshRuntime],
  );

  const openAnnotationBrowser = useCallback((node: CanvasFlowNode) => {
    const model = node.data.model;
    if (model.kind !== "literature" || annotationBrowserRef.current) return;
    const requestId = newId("annotations");
    const session = openAnnotationBrowserSession(requestId, model.source);
    annotationBrowserOriginNodeIdRef.current = node.id;
    annotationBrowserRef.current = session;
    setAnnotationBrowser(session);
    propsRef.current.onListLiteratureAnnotations?.(requestId, model.source);
  }, []);

  const applyAnnotationCandidates = useCallback(
    (
      requestId: string,
      source: LiteratureSource,
      candidates: AnnotationCandidate[],
      failures: AnnotationListFailure[],
    ) => {
      const current = annotationBrowserRef.current;
      const next = acceptAnnotationListResult(current, requestId, source, {
        candidates,
        failures,
      });
      if (next === current) return;
      const originNodeId = annotationBrowserOriginNodeIdRef.current;
      if (originNodeId) {
        applyLiteratureAnnotationCount(originNodeId, source, candidates.length);
      }
      annotationBrowserRef.current = next;
      setAnnotationBrowser(next);
      if (failures.length) {
        showCanvasNotice({
          code: "annotations-partial-failure",
          requestId,
          failureCodes: failures.map((failure) => failure.code),
        });
      } else {
        clearMatchingNotice(
          (notice) =>
            notice.code === "annotations-unavailable" ||
            notice.code === "annotations-partial-failure",
        );
      }
    },
    [applyLiteratureAnnotationCount, clearMatchingNotice, showCanvasNotice],
  );

  const rejectAnnotationList = useCallback(
    (
      requestId: string,
      source: LiteratureSource,
      failure: AnnotationListFailure,
    ) => {
      const current = annotationBrowserRef.current;
      const next = acceptAnnotationListFailure(
        current,
        requestId,
        source,
        failure,
      );
      if (next === current) return;
      annotationBrowserRef.current = next;
      setAnnotationBrowser(next);
      showCanvasNotice({
        code: "annotations-unavailable",
        requestId,
        failureCode: failure.code,
      });
    },
    [showCanvasNotice],
  );

  const closeAnnotationBrowser = useCallback(() => {
    annotationBrowserRef.current = closeAnnotationBrowserSession(
      annotationBrowserRef.current,
    );
    setAnnotationBrowser(annotationBrowserRef.current);
    annotationBrowserOriginNodeIdRef.current = null;
  }, []);

  const addSelectedAnnotations = useCallback(() => {
    const session = annotationBrowserRef.current;
    const literatureNodeId = annotationBrowserOriginNodeIdRef.current;
    if (!session || !literatureNodeId || session.state.status !== "ready") {
      closeAnnotationBrowser();
      return;
    }
    const addedNodeIds = createQuoteBatchRuntime({
      getWorkingDocument: workingSnapshot,
      getHistoryDocument: snapshotNow,
      applyDocument,
      commitHistory: (document) => documentHistory.commit(document),
      createNodeId: () => newId("quote"),
    }).add(literatureNodeId, session.state.candidates, session.selectedKeys);
    if (addedNodeIds.length) {
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: node.id === literatureNodeId,
        })),
      );
      sourceStatesRef.current = updateSourceResolutionStates(
        sourceStatesRef.current,
        addedNodeIds.map((nodeId) => ({ nodeId, status: "idle" })),
      );
      renderSourceState((revision) => revision + 1);
      setSourceCycle((cycle) => cycle + 1);
    }
    closeAnnotationBrowser();
  }, [
    applyDocument,
    closeAnnotationBrowser,
    documentHistory,
    setNodes,
    snapshotNow,
    workingSnapshot,
  ]);

  const focusExistingAnnotation = useCallback(
    (annotationIdentity: string) => {
      const existing = nodesRef.current.find(
        (node) =>
          node.data.model.kind === "quote" &&
          quoteSourceIdentity(node.data.model.source) === annotationIdentity,
      );
      if (!existing) return;
      closeAnnotationBrowser();
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: node.id === existing.id,
        })),
      );
      void flowRef.current?.fitView({
        nodes: [{ id: existing.id }],
        padding: 0.4,
        duration: 200,
      });
      window.requestAnimationFrame(() => {
        const canvasHost = canvasHostRef.current;
        const existingElement = Array.from(
          canvasHost?.querySelectorAll<HTMLElement>(".react-flow__node") ?? [],
        ).find((element) => element.dataset.id === existing.id);
        (existingElement ?? canvasHost)?.focus();
      });
    },
    [closeAnnotationBrowser, nodesRef, setNodes],
  );

  const applyNodePositions = useCallback(
    (positioned: readonly CanvasFlowNode[]) => {
      const document = moveNodesInDocument(
        workingSnapshot(),
        positioned.map((node) => ({ id: node.id, position: node.position })),
      );
      const models = new Map(document.nodes.map((node) => [node.id, node]));
      setNodes((current) =>
        current.map((node) => {
          const model = models.get(node.id);
          return model
            ? {
                ...node,
                position: model.position,
                data: { ...node.data, model },
              }
            : node;
        }),
      );
    },
    [setNodes, workingSnapshot],
  );

  const deleteCanvasElements = useCallback(
    (nodeIds: string[], edgeIds: string[] = []) => {
      const nodeIdSet = new Set(nodeIds);
      const edgeIdSet = new Set(edgeIds);
      if (!nodeIdSet.size && !edgeIdSet.size) return;

      let document = workingSnapshot();
      const existingNodeIds = new Set(document.nodes.map((node) => node.id));
      const existingEdgeIds = new Set(
        document.connections.map((connection) => connection.id),
      );
      if (
        !nodeIds.some((id) => existingNodeIds.has(id)) &&
        !edgeIds.some((id) => existingEdgeIds.has(id))
      ) {
        return;
      }

      const settledDrag = settleFrameDragState(
        frameDragRef.current ?? undefined,
      );
      frameDragRef.current = settledDrag.state ?? null;
      pushHistory();
      for (const nodeId of nodeIdSet) {
        document = deleteNodeFromDocument(document, nodeId);
      }
      if (edgeIdSet.size) {
        document = {
          ...document,
          connections: document.connections.filter(
            (connection) => !edgeIdSet.has(connection.id),
          ),
        };
      }
      applyDocument(document);
      bump();
    },
    [applyDocument, bump, pushHistory, workingSnapshot],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const removedNodeIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);
      if (removedNodeIds.length) {
        deleteCanvasElements(removedNodeIds);
      }

      let retainedChanges = changes.filter(
        (change) => change.type !== "remove",
      );
      if (!retainedChanges.length) return;
      if (retainedChanges.some((change) => change.type === "add")) {
        pushHistory();
      }

      const drag = frameDragRef.current;
      if (drag?.phase === "ending") {
        retainedChanges = retainedChanges.filter(
          (change) => change.type !== "position",
        );
        if (!retainedChanges.length) return;
      }
      const positionUpdates = retainedChanges.flatMap((change) =>
        change.type === "position" && change.position
          ? [{ id: change.id, position: change.position }]
          : [],
      );

      if (drag && positionUpdates.length) {
        setNodes((current) => {
          const currentDocument = flowToCanvasDocument(
            current,
            edgesRef.current,
            viewportRef.current,
            shellRef.current,
          );
          const moved = updateFrameDragState(
            currentDocument,
            drag,
            positionUpdates,
          );
          frameDragRef.current = moved.state;
          const movedById = new Map(
            moved.document.nodes.map((node) => [node.id, node]),
          );
          const movedNodes = current.map((node) => {
            const model = movedById.get(node.id);
            return model
              ? {
                  ...node,
                  position: model.position,
                  data: { ...node.data, model },
                }
              : node;
          });
          return applyNodeChanges(retainedChanges, movedNodes);
        });
      } else {
        setNodes((current) => applyNodeChanges(retainedChanges, current));
      }

      if (!drag && retainedChanges.some((change) => change.type !== "select")) {
        bump();
      }
    },
    [bump, deleteCanvasElements, edgesRef, pushHistory, shellRef, viewportRef],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<CanvasFlowEdge>[]) => {
      const removedEdgeIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);
      if (removedEdgeIds.length) {
        deleteCanvasElements([], removedEdgeIds);
      }
      const retainedChanges = changes.filter(
        (change) => change.type !== "remove",
      );
      if (!retainedChanges.length) return;
      setEdges((current) => applyEdgeChanges(retainedChanges, current));
      if (retainedChanges.some((change) => change.type !== "select")) bump();
    },
    [bump, deleteCanvasElements],
  );

  const beginNodeDrag = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_event, _node, draggedNodes) => {
      pushHistory();
      frameDragRef.current =
        beginFrameDragState(
          workingSnapshot(),
          draggedNodes.map((dragged) => dragged.id),
        ) ?? null;
    },
    [pushHistory, workingSnapshot],
  );

  const endFrameDrag = useCallback(() => {
    const settled = settleFrameDragState(frameDragRef.current ?? undefined);
    frameDragRef.current = settled.state ?? null;
    if (settled.notify) bump();
  }, [bump]);

  const finishNodeDrag = useCallback<OnNodeDrag<CanvasFlowNode>>(() => {
    const stopped = finishFrameDragState(frameDragRef.current ?? undefined);
    frameDragRef.current = stopped.state ?? null;
    if (stopped.notify) bump();
  }, [bump]);

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory();
      const id = newId("edge");
      const color = "#9ca3af";
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id,
            data: {
              connection: {
                id,
                kind: "basic",
                source: connection.source,
                target: connection.target,
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
                color,
                arrow: true,
              },
            },
            style: { stroke: color },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color,
            },
          },
          current,
        ),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const addNode = useCallback(
    (kind: CanvasNodeKind, position?: { x: number; y: number }) => {
      const center = position ??
        flowRef.current?.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }) ?? { x: 120, y: 120 };
      const nodeId = newId(kind);
      if (kind === "literature") {
        const requestId = `pick-${nodeId}-${Date.now().toString(36)}`;
        academicAcquisition.placeLiterature(requestId, nodeId, center);
        return;
      }
      pushHistory();
      const created = canvasDocumentToFlow({
        version: 2,
        nodes: [createCanvasNode(kind, center, nodeId)],
        connections: [],
      }).nodes[0];
      const editOnCreate = isStampTool(kind) && shouldEditOnCreate(kind);
      setNodes((current) => {
        const next = [...current, created];
        return editOnCreate
          ? (beginNodeEditing(next, nodeId)?.nodes ?? next)
          : next;
      });
      bump();
      if (editOnCreate) {
        setEditing({ nodeId, value: flowNodeText(created) });
      }
    },
    [academicAcquisition, bump, pushHistory],
  );

  const flowPoint = useCallback((clientX: number, clientY: number) => {
    return (
      flowRef.current?.screenToFlowPosition({ x: clientX, y: clientY }) ?? {
        x: clientX,
        y: clientY,
      }
    );
  }, []);

  const cancelDraw = useCallback(() => {
    const session = drawRef.current;
    if (!session) return;
    drawRef.current = null;
    const previous = preDrawRef.current;
    preDrawRef.current = null;
    if (previous) applyDocument(previous.working);
    else {
      setNodes((current) =>
        current.filter((node) => node.id !== session.nodeId),
      );
    }
  }, [applyDocument]);

  const updateDraw = useCallback(
    (clientX: number, clientY: number, shift: boolean) => {
      const session = drawRef.current;
      if (!session) return;
      const current = flowPoint(clientX, clientY);
      const frame = frameFromDrag(session.origin, current, {
        kind: session.kind,
        shift,
      });
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === session.nodeId
            ? applyDrawFrame(node, frame, session.kind)
            : node,
        ),
      );
    },
    [flowPoint],
  );

  const finishDraw = useCallback(() => {
    const session = drawRef.current;
    if (!session) return;
    drawRef.current = null;
    const previous = preDrawRef.current;
    preDrawRef.current = null;
    if (previous) {
      documentHistory.push(previous.history);
    }
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.id === session.nodeId,
      })),
    );
    setActiveTool(toolAfterDraw(session.kind));
    bump();
  }, [bump, documentHistory]);

  const beginDraw = useCallback(
    (
      event: {
        clientX: number;
        clientY: number;
        pointerId: number;
        shiftKey: boolean;
      },
      kind: DrawKind,
    ) => {
      const origin = flowPoint(event.clientX, event.clientY);
      const nodeId = newId(kind);
      const frame = frameFromDrag(origin, origin, {
        kind,
        shift: event.shiftKey,
      });
      preDrawRef.current = {
        working: workingSnapshot(),
        history: snapshotNow(),
      };
      const created = applyDrawFrame(
        canvasDocumentToFlow({
          version: 2,
          nodes: [createBasicNode(kind, origin, nodeId)],
          connections: [],
        }).nodes[0],
        frame,
        kind,
      );
      drawRef.current = {
        nodeId,
        kind,
        origin,
        pointerId: event.pointerId,
      };
      setNodes((current) => [...current, created]);
    },
    [flowPoint, snapshotNow, workingSnapshot],
  );

  const eraseNode = useCallback(
    (id: string) => {
      deleteCanvasElements([id]);
    },
    [deleteCanvasElements],
  );

  const eraseEdge = useCallback(
    (id: string) => {
      deleteCanvasElements([], [id]);
    },
    [deleteCanvasElements],
  );

  const updateNode = useCallback(
    (nodeId: string, updater: (node: CanvasFlowNode) => CanvasFlowNode) => {
      pushHistory();
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? updater(node) : node)),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const startEdit = useCallback((nodeId: string) => {
    const transition = beginNodeEditing(nodesRef.current, nodeId);
    if (!transition) return;
    setMenu(null);
    setStyleTarget(null);
    setActiveTool("select");
    setNodes(transition.nodes);
    setEditing(transition.editing);
  }, []);

  const openNode = useCallback(
    (node: CanvasFlowNode) => {
      const model = node.data.model;
      const academicSource = sourceDescriptor(model);
      if (academicSource) {
        requestSources("selected", [
          { nodeId: node.id, source: academicSource },
        ]);
        const requestId = newId("open-source");
        openSourceRequestsRef.current.begin(requestId, node.id, academicSource);
        propsRef.current.onOpenAcademicSource?.(
          requestId,
          node.id,
          academicSource,
        );
      } else if (model.kind === "pdf" && model.data.attachmentID) {
        propsRef.current.onOpenItem({
          attachmentID: model.data.attachmentID,
          pdfPage: model.data.pdfPage,
        });
      } else if (model.kind === "attachment" && model.data.attachmentID) {
        propsRef.current.onOpenItem({
          attachmentID: model.data.attachmentID,
        });
      } else if (model.kind === "item" && model.data.itemID) {
        propsRef.current.onOpenItem({ itemID: model.data.itemID });
      } else {
        startEdit(node.id);
      }
    },
    [requestSources, startEdit],
  );

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const { nodeId, value } = editing;
    setEditing(null);
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) {
      setNodes((current) =>
        current.map((item) => ({ ...item, className: undefined })),
      );
      return;
    }
    if (flowNodeText(node) === value) {
      setNodes((current) =>
        current.map((item) => ({ ...item, className: undefined })),
      );
      return;
    }
    updateNode(nodeId, (current) => ({
      ...mergeEditingStyle(current, value, {}),
      className: undefined,
    }));
  }, [editing, updateNode]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
    setNodes((current) =>
      current.map((item) => ({ ...item, className: undefined })),
    );
  }, []);

  const copyNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((item) => item.id === nodeId);
      if (!node) return;
      pushHistory();
      const id = newId(node.type || "item");
      setNodes((current) => [
        ...current,
        updateFlowNodeModel(
          {
            ...node,
            id,
            selected: false,
            position: { x: node.position.x + 24, y: node.position.y + 24 },
          },
          (model) => ({ ...model, id }),
        ),
      ]);
      bump();
    },
    [bump, pushHistory],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setMenu(null);
      deleteCanvasElements([nodeId]);
    },
    [deleteCanvasElements],
  );

  const alignSelected = useCallback(
    (mode: AlignMode) => {
      const selected = nodesRef.current.filter((node) => node.selected);
      if (selected.length < 2) return;
      pushHistory();
      const aligned = alignNodes(selected, mode);
      applyNodePositions(aligned);
      bump();
    },
    [applyNodePositions, bump, pushHistory],
  );

  const distributeSelected = useCallback(
    (direction: "horizontal" | "vertical") => {
      const selected = nodesRef.current.filter((node) => node.selected);
      if (selected.length < 3) return;
      pushHistory();
      const distributed = distributeNodes(selected, direction);
      applyNodePositions(distributed);
      bump();
    },
    [applyNodePositions, bump, pushHistory],
  );

  const autoLayout = useCallback(() => {
    pushHistory();
    applyNodePositions(autoLayoutNodes(nodesRef.current));
    bump();
  }, [applyNodePositions, bump, nodesRef, pushHistory]);

  const nudgeSelected = useCallback(
    (key: string, shift: boolean): boolean => {
      const selected = nodesRef.current.filter((node) => node.selected);
      if (!selected.length || !key.startsWith("Arrow")) return false;
      const step = shift ? 16 : 1;
      const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
      const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
      if (!dx && !dy) return false;

      pushHistory();
      const positioned = selected.map((node) => ({
        ...node,
        position: {
          x: node.position.x + dx,
          y: node.position.y + dy,
        },
      }));
      applyNodePositions(positioned);
      bump();
      return true;
    },
    [applyNodePositions, bump, nodesRef, pushHistory],
  );

  const fitView = useCallback(() => {
    void flowRef.current?.fitView({ padding: 0.2, duration: 300 });
  }, []);

  const EDGE_COLORS = ["#9ca3af", "#2563eb", "#059669", "#d97706", "#dc2626"];

  const cycleEdgeColor = useCallback(
    (edgeId: string) => {
      const edge = edgesRef.current.find((item) => item.id === edgeId);
      if (!edge) return;
      const current = edge.style?.stroke ?? "#9ca3af";
      const next =
        EDGE_COLORS[
          (EDGE_COLORS.indexOf(String(current)) + 1) % EDGE_COLORS.length
        ];
      pushHistory();
      setEdges((currentEdges) =>
        currentEdges.map((item) =>
          item.id === edgeId ? withEdgeColor(item, next) : item,
        ),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const toggleEdgeDashed = useCallback(
    (edgeId: string) => {
      const edge = edgesRef.current.find((item) => item.id === edgeId);
      if (!edge) return;
      const dashed = !edge.style?.strokeDasharray;
      pushHistory();
      setEdges((currentEdges) =>
        currentEdges.map((item) =>
          item.id === edgeId
            ? {
                ...item,
                style: {
                  ...(item.style ?? {}),
                  strokeDasharray: dashed ? "6 4" : undefined,
                },
              }
            : item,
        ),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const toggleEdgeArrow = useCallback(
    (edgeId: string) => {
      const edge = edgesRef.current.find((item) => item.id === edgeId);
      if (!edge) return;
      const hasArrow = !!edge.markerEnd;
      pushHistory();
      setEdges((currentEdges) =>
        currentEdges.map((item) =>
          item.id === edgeId
            ? {
                ...item,
                markerEnd: hasArrow
                  ? undefined
                  : {
                      type: MarkerType.ArrowClosed,
                      width: 16,
                      height: 16,
                      color: String(item.style?.stroke ?? "#9ca3af"),
                    },
              }
            : item,
        ),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const exportAs = useCallback(
    (format: "png" | "svg" | "md") => {
      setMenu(null);
      const doc = snapshotNow();
      const requestId = `export-${Date.now().toString(36)}`;
      if (format === "md") {
        propsRef.current.onExportFile({
          requestId,
          format,
          mimeType: "text/markdown",
          text: buildCanvasMarkdown(doc),
        });
        return;
      }
      const svg = buildCanvasSvg(doc);
      if (format === "svg") {
        propsRef.current.onExportFile({
          requestId,
          format,
          mimeType: "image/svg+xml",
          dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        });
        return;
      }
      void svgToPngDataUrl(svg).then((dataUrl) => {
        propsRef.current.onExportFile({
          requestId,
          format,
          mimeType: "image/png",
          dataUrl,
        });
      });
    },
    [snapshotNow],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleGlobalCanvasKeyDown(
        event,
        {
          annotationBrowserOpen: annotationBrowserRef.current !== null,
          editing: Boolean(editing),
          drawing: drawRef.current !== null,
          selectedNodeIds: nodesRef.current
            .filter((node) => node.selected)
            .map((node) => node.id),
          selectedEdgeIds: edgesRef.current
            .filter((edge) => edge.selected)
            .map((edge) => edge.id),
        },
        {
          endFrameDrag,
          cancelDraw,
          dismissTransientUi() {
            setMenu(null);
            setHelpOpen(false);
            setStyleTarget(null);
          },
          setActiveTool,
          deleteSelection: deleteCanvasElements,
          nudgeSelected,
        },
      );
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editing,
    cancelDraw,
    deleteCanvasElements,
    edgesRef,
    endFrameDrag,
    nudgeSelected,
  ]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!drawRef.current || event.pointerId !== drawRef.current.pointerId)
        return;
      updateDraw(event.clientX, event.clientY, event.shiftKey);
    };
    const onUp = (event: PointerEvent) => {
      if (!drawRef.current || event.pointerId !== drawRef.current.pointerId)
        return;
      updateDraw(event.clientX, event.clientY, event.shiftKey);
      finishDraw();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [finishDraw, updateDraw]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".zmd-board-context-menu")) {
        setMenu(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menu]);

  useEffect(() => {
    const runtime: WhiteboardRuntime = {
      setTheme,
      setLabels,
      loadSnapshot,
      getSnapshot: snapshotNow,
      undo,
      redo,
      beginAcademicDrop(requestId, nodeId, screenPosition, sources) {
        setActiveTool("select");
        const position =
          flowRef.current?.screenToFlowPosition(screenPosition) ??
          screenPosition;
        academicAcquisition.dropLiterature(
          requestId,
          nodeId,
          position,
          sources,
        );
      },
      rejectAcademicDrop(code) {
        showCanvasNotice({ code });
      },
      resolveAcademicAcquisition(requestId, nodeId, acquisition) {
        academicAcquisition.resolve(requestId, nodeId, acquisition);
      },
      resolveAcademicAcquisitionBatch(requestId, nodeId, successes, failures) {
        const addedNodeIds = academicAcquisition.resolveBatch(
          requestId,
          nodeId,
          successes,
          failures,
        );
        if (addedNodeIds.length) {
          sourceStatesRef.current = updateSourceResolutionStates(
            sourceStatesRef.current,
            addedNodeIds.map((addedNodeId) => ({
              nodeId: addedNodeId,
              status: "idle",
            })),
          );
          renderSourceState((revision) => revision + 1);
          setSourceCycle((cycle) => cycle + 1);
        }
      },
      rejectAcademicRequest(requestId, nodeId, code) {
        if (
          noteRefreshRuntime.reject(requestId, nodeId, labels.noteRefreshFailed)
        ) {
          showCanvasNotice({
            code: "note-refresh-failed",
            nodeId,
            failureCode:
              code === "library-missing" ||
              code === "item-missing" ||
              code === "wrong-kind" ||
              code === "parent-mismatch"
                ? code
                : "note-refresh-failed",
          });
          return;
        }
        academicAcquisition.reject(requestId, nodeId, code);
      },
      rejectSourceAction(requestId, nodeId, source, failure) {
        if (!openSourceRequestsRef.current.accept(requestId, nodeId, source)) {
          return;
        }
        showCanvasNotice({
          code: "source-open-failed",
          nodeId,
          failureCode: failure.code,
        });
      },
      acceptSourceAction(requestId, nodeId, action, source) {
        if (action !== "open") return;
        if (!openSourceRequestsRef.current.accept(requestId, nodeId, source)) {
          return;
        }
        clearMatchingNotice(
          (notice) =>
            notice.code === "source-open-failed" && notice.nodeId === nodeId,
        );
      },
      applySourceResolutionBatch,
      applyNoteRefresh,
      applyAnnotationCandidates,
      rejectAnnotationList,
      setSaveState(state) {
        setSaveState(state);
      },
    };
    runtimeRef.current = runtime;
    propsRef.current.onReady(runtime);
  }, [
    academicAcquisition,
    applySourceResolutionBatch,
    applyNoteRefresh,
    applyAnnotationCandidates,
    clearMatchingNotice,
    labels.noteRefreshFailed,
    loadSnapshot,
    noteRefreshRuntime,
    rejectAnnotationList,
    redo,
    snapshotNow,
    showCanvasNotice,
    undo,
  ]);

  useEffect(() => {
    scheduleSourceResolution();
    return cancelIdleResolution;
  }, [cancelIdleResolution, scheduleSourceResolution, sourceCycle]);

  useEffect(
    () => () => {
      openSourceRequestsRef.current.clear();
      academicAcquisitionRef.current?.clear();
      noteRefreshRuntimeRef.current?.clear();
      sourceRefreshRuntimeRef.current?.clear();
    },
    [],
  );

  useEffect(() => {
    requestSources("selected", currentSourceRequests().selected);
  }, [currentSourceRequests, nodes, requestSources]);

  useEffect(() => {
    setTheme(props.theme);
  }, [props.theme]);

  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedEdges = edges.filter((edge) => edge.selected);
  const editingNode = editing
    ? nodes.find((node) => node.id === editing.nodeId)
    : null;
  const editingScreen = editingNode
    ? flowRef.current?.flowToScreenPosition(editingNode.position)
    : null;
  const editingTextStyle = editingNode
    ? effectiveCanvasNodeUiTextStyle(
        editingNode.data.model.kind,
        editingNode.data.model.style,
      )
    : null;
  const menuNode = menu ? nodes.find((node) => node.id === menu.nodeId) : null;
  const styleNode = styleTarget
    ? nodes.find((node) => node.id === styleTarget)
    : null;
  const styleScreen = styleNode
    ? flowRef.current?.flowToScreenPosition(styleNode.position)
    : null;
  const zoom = viewportRef.current.zoom || 1;

  return (
    <WhiteboardLabelsProvider value={labels}>
      <div
        ref={canvasHostRef}
        className={`zmd-board-host${eraser ? " is-eraser" : ""}${activeTool === "hand" ? " is-hand" : ""}${isDrawTool(activeTool) ? " is-draw" : ""}`}
        data-theme={theme}
        tabIndex={-1}
        onPointerDown={(event) => {
          if (event.button !== 0 || editing) return;
          if (!isDrawTool(activeToolRef.current)) return;
          const target = event.target as HTMLElement | null;
          if (!target?.closest(".react-flow__pane")) return;
          event.preventDefault();
          beginDraw(event, activeToolRef.current);
        }}
      >
        <TopIsland
          labels={labels}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          saveState={saveState}
          selectedNodeCount={selectedNodes.length}
          selectedEdgeCount={selectedEdges.length}
          onUndo={() => runtimeRef.current?.undo()}
          onRedo={() => runtimeRef.current?.redo()}
          onSave={() => propsRef.current.onSave()}
          onFitView={fitView}
          onAutoLayout={autoLayout}
          onOpenShortcuts={() => setHelpOpen(true)}
          onAlign={alignSelected}
          onDistribute={distributeSelected}
          onEdgeColor={() =>
            selectedEdges[0] && cycleEdgeColor(selectedEdges[0].id)
          }
          onEdgeDash={() =>
            selectedEdges[0] && toggleEdgeDashed(selectedEdges[0].id)
          }
          onEdgeArrow={() =>
            selectedEdges[0] && toggleEdgeArrow(selectedEdges[0].id)
          }
        />
        <CanvasNoticeRegion
          labels={labels}
          notice={canvasNotice}
          onDismiss={clearCanvasNotice}
        />
        <PropertiesPanel
          labels={labels}
          node={
            selectedNodes.length === 1 &&
            (isLibraryKind(selectedNodes[0].data.model.kind) ||
              selectedNodes[0].data.model.kind === "literature" ||
              selectedNodes[0].data.model.kind === "quote" ||
              selectedNodes[0].data.model.kind === "note")
              ? selectedNodes[0]
              : null
          }
          sourceState={
            selectedNodes.length === 1
              ? sourceStatesRef.current.get(selectedNodes[0].id)
              : undefined
          }
          onEdit={startEdit}
          onOpen={openNode}
          onRefreshSource={refreshNodeSource}
          onViewAnnotations={openAnnotationBrowser}
          viewAnnotationsRef={viewAnnotationsRef}
          onCopy={copyNode}
          onDelete={deleteNode}
        />
        {annotationBrowser ? (
          <AnnotationBrowser
            labels={{
              title: labels.annotationBrowserTitle,
              search: labels.searchAnnotations,
              loading: labels.annotationsLoading,
              empty: labels.annotationsEmpty,
              unavailable: labels.annotationsUnavailable,
              partialFailure: labels.annotationsPartialFailure,
              alreadyAdded: labels.annotationAlreadyAdded,
              focusExisting: labels.focusExistingAnnotation,
              addSelected: labels.addSelectedAnnotations,
              page: labels.annotationPage,
              close: labels.close,
            }}
            state={annotationBrowser.state}
            query={annotationBrowser.query}
            selectedKeys={annotationBrowser.selectedKeys}
            existingKeys={existingAnnotationKeys(workingSnapshot())}
            returnFocusRef={viewAnnotationsRef}
            onQueryChange={(query) =>
              setAnnotationBrowser((current) =>
                current ? { ...current, query } : current,
              )
            }
            onToggle={(annotationKey, checked) =>
              setAnnotationBrowser((current) =>
                current
                  ? {
                      ...current,
                      selectedKeys: toggleAnnotationSelection(
                        current.selectedKeys,
                        annotationKey,
                        checked,
                      ),
                    }
                  : current,
              )
            }
            onClose={closeAnnotationBrowser}
            onFocusExisting={focusExistingAnnotation}
            onAddSelected={addSelectedAnnotations}
          />
        ) : null}
        <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={canvasNodeTypes}
          defaultViewport={initial.viewport}
          fitView={!props.initialSnapshot}
          minZoom={0.1}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          }}
          snapToGrid={activeTool === "select"}
          snapGrid={[16, 16]}
          deleteKeyCode={null}
          onKeyDownCapture={(event) => {
            captureCanvasArrowKey(event, Boolean(editing), nudgeSelected);
          }}
          panOnDrag={activeTool === "hand" ? true : [1, 2]}
          selectionOnDrag={activeTool === "select"}
          elementsSelectable={activeTool === "select"}
          nodesDraggable={!eraser && !editing && activeTool === "select"}
          nodesConnectable={!eraser && activeTool === "select"}
          onInit={(instance) => {
            flowRef.current = instance;
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(event, node) => {
            if (!eraser) return;
            event.preventDefault();
            eraseNode(node.id);
          }}
          onNodeDoubleClick={(event, node) => {
            event.preventDefault();
            const origin = flowRef.current?.flowToScreenPosition(node.position);
            const size = nodeSize(node);
            const zoom = viewportRef.current.zoom || 1;
            const kind = node.data.model.kind;
            if (origin) {
              const local = {
                x: (event.clientX - origin.x) / zoom,
                y: (event.clientY - origin.y) / zoom,
              };
              if (
                isBorderHit(local, {
                  width: size.width,
                  height: size.height,
                  kind,
                })
              ) {
                setEditing(null);
                setStyleTarget(node.id);
                return;
              }
            }
            if (
              isLibraryKind(kind) ||
              kind === "literature" ||
              kind === "quote"
            ) {
              openNode(node);
              return;
            }
            startEdit(node.id);
          }}
          onEdgeClick={(event, edge) => {
            if (!eraser) return;
            event.preventDefault();
            eraseEdge(edge.id);
          }}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
          }}
          onPaneClick={(event) => {
            setMenu(null);
            setStyleTarget(null);
            if (eraser) {
              setActiveTool("select");
              return;
            }
            if (isDrawTool(activeTool) || drawRef.current) return;
            if (!isStampTool(activeTool) && activeTool !== "literature") return;
            const position = flowRef.current?.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            });
            addNode(activeTool, position);
          }}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY, nodeId: "" });
          }}
          onNodeDragStart={beginNodeDrag}
          onNodeDragStop={finishNodeDrag}
          onMoveEnd={(_, viewport) => {
            const previous = viewportRef.current;
            if (
              previous.x === viewport.x &&
              previous.y === viewport.y &&
              previous.zoom === viewport.zoom
            ) {
              return;
            }
            viewportRef.current = viewport;
            requestVisibleSources();
            bump();
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
        {editing && editingNode && editingScreen && editingTextStyle ? (
          <div
            className="zmd-board-editor is-in-shape"
            style={{
              left: editingScreen.x,
              top: editingScreen.y,
              width:
                nodeSize(editingNode).width * (viewportRef.current.zoom || 1),
              height:
                nodeSize(editingNode).height * (viewportRef.current.zoom || 1),
              borderRadius:
                editingNode.type === "ellipse"
                  ? 999
                  : (editingNode.data.model.style?.radius ?? 8) *
                    (viewportRef.current.zoom || 1),
              ...verticalAlignmentStyle(editingTextStyle),
            }}
          >
            <textarea
              autoFocus
              aria-label={labels.editText}
              className="zmd-board-in-shape-edit"
              value={editing.value}
              style={{
                ...labelTextStyle(editingTextStyle),
                fontSize:
                  editingTextStyle.fontSize * (viewportRef.current.zoom || 1),
              }}
              onChange={(event) =>
                setEditing({
                  nodeId: editing.nodeId,
                  value: event.target.value,
                })
              }
              onBlur={() => {
                handleEditBlur(holdEditFocusRef, commitEdit);
              }}
              onKeyDown={(event) => {
                if (
                  (event.metaKey || event.ctrlKey) &&
                  event.key.toLowerCase() === "b"
                ) {
                  event.preventDefault();
                  updateNode(editing.nodeId, (current) =>
                    toggleEditingBold(current, editing.value),
                  );
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  commitEdit();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEdit();
                }
              }}
            />
          </div>
        ) : null}
        {menu ? (
          <div
            className="zmd-board-context-menu"
            style={{ left: menu.x, top: menu.y }}
          >
            {menuNode ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    startEdit(menuNode.id);
                  }}
                >
                  <IconEdit />
                  <span>{labels.editText}</span>
                </button>
                {hasOpenTarget(menuNode) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      openNode(menuNode);
                    }}
                  >
                    <IconOpen />
                    <span>
                      {sourceDescriptor(menuNode.data.model)
                        ? labels.openSource
                        : labels.openItem}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    copyNode(menuNode.id);
                  }}
                >
                  <IconCopy />
                  <span>{labels.copy}</span>
                </button>
                <button type="button" onClick={() => deleteNode(menuNode.id)}>
                  <IconTrash />
                  <span>{labels.delete}</span>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => exportAs("png")}>
                  <IconExport />
                  <span>{labels.exportPng}</span>
                </button>
                <button type="button" onClick={() => exportAs("svg")}>
                  <IconExport />
                  <span>{labels.exportSvg}</span>
                </button>
                <button type="button" onClick={() => exportAs("md")}>
                  <IconExport />
                  <span>{labels.exportMarkdown}</span>
                </button>
              </>
            )}
          </div>
        ) : null}
        {editing && editingNode && editingScreen ? (
          <TextStyleBar
            node={editingNode}
            labels={labels}
            theme={theme}
            left={
              editingScreen.x +
              (nodeSize(editingNode).width * (viewportRef.current.zoom || 1)) /
                2 -
              280
            }
            top={Math.max(8, editingScreen.y - 56)}
            onHoldFocus={() => {
              armEditFocusHold(holdEditFocusRef);
            }}
            onChange={(patch) => {
              updateNode(editing.nodeId, (current) =>
                mergeEditingStyle(current, editing.value, patch),
              );
            }}
          />
        ) : null}
        {styleNode && styleScreen ? (
          <StyleBar
            node={styleNode}
            labels={labels}
            theme={theme}
            left={styleScreen.x + (nodeSize(styleNode).width * zoom) / 2 - 280}
            top={Math.max(8, styleScreen.y - 56)}
            onChange={(patch) => {
              const { width, height, ...style } = patch;
              updateNode(styleNode.id, (current) => {
                const next = updateFlowNodeModel(current, (model) => ({
                  ...model,
                  style: { ...(model.style ?? {}), ...style },
                }));
                return {
                  ...next,
                  width: width ?? current.width,
                  height: height ?? current.height,
                  style: {
                    width: width ?? nodeSize(current).width,
                    height: height ?? nodeSize(current).height,
                  },
                };
              });
            }}
          />
        ) : null}
        {helpOpen ? (
          <ShortcutsOverlay
            labels={labels}
            onClose={() => setHelpOpen(false)}
          />
        ) : null}
      </div>
    </WhiteboardLabelsProvider>
  );
}
