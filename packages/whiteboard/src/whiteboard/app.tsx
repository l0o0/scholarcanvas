/// <reference lib="dom" />

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
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
  effectiveCanvasNodeTextStyle,
  type CanvasNode,
  type CanvasNodeKind,
} from "../model/academic";
import { createBasicNode } from "../model/basic";
import {
  demoCanvasDocument,
  parseCanvasDocument,
  type CanvasDocument,
} from "../model/document";
import type { WhiteboardLabels, WhiteboardTheme } from "../model/protocol";
import { canvasNodeTypes, type CanvasFlowNode } from "../nodes";
import { PropertiesPanel } from "../chrome/PropertiesPanel";
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
  toolShortcut,
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
  beginNodeEditing,
  canvasDocumentToFlow,
  flowNodeText,
  flowToCanvasDocument,
  labelTextStyle,
  mergeEditingStyle,
  mergePickerData,
  parsePickerNodeData,
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
import { captureCanvasArrowKey } from "./keyboard";
import { useCanvasDocumentRuntime } from "./runtime";

const DEFAULT_LABELS: WhiteboardLabels = {
  canvas: "Canvas",
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
  kindQuestion: "Question",
  kindClaim: "Claim",
  kindFrame: "Frame",
  annotationColor: "Annotation color",
  annotations: { one: "annotation", other: "annotations" },
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
  onPickItem: (
    requestId: string,
    nodeId: string,
    kind: "item" | "pdf" | "attachment",
  ) => void;
  onOpenItem: (payload: {
    itemID?: number;
    attachmentID?: number;
    pdfPage?: number;
  }) => void;
  onDropItems: (
    requestId: string,
    nodeId: string,
    raw: Record<string, string>,
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
  resolvePick: (requestId: string, nodeId: string, data: unknown) => void;
  rejectPick: (requestId: string, message: string) => void;
  setSaveState: (state: "saved" | "saving" | "error") => void;
}

function newId(kind: string) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
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
  const propsRef = useRef(props);
  propsRef.current = props;
  const documentRuntime = useCanvasDocumentRuntime(
    initial,
    (revision) => propsRef.current.onChange(revision),
    (viewport) => flowRef.current?.setViewport(viewport),
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
    loadSnapshot,
    getSnapshot: snapshotNow,
    undo,
    redo,
  } = documentRuntime;
  const [theme, setTheme] = useState<WhiteboardTheme>(props.theme);
  const [labels, setLabels] = useState<WhiteboardLabels>(
    props.labels ?? DEFAULT_LABELS,
  );
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
  const holdEditFocusRef = useRef(false);

  const pendingPicksRef = useRef(new Map<string, string>());
  const runtimeRef = useRef<WhiteboardRuntime | null>(null);
  const drawRef = useRef<DrawSession | null>(null);
  const preDrawRef = useRef<CanvasDocument | null>(null);
  const frameDragRef = useRef<FrameDragState | null>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const applyNodePositions = useCallback(
    (positioned: readonly CanvasFlowNode[]) => {
      const document = moveNodesInDocument(
        snapshotNow(),
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
    [setNodes, snapshotNow],
  );

  const deleteCanvasElements = useCallback(
    (nodeIds: string[], edgeIds: string[] = []) => {
      const nodeIdSet = new Set(nodeIds);
      const edgeIdSet = new Set(edgeIds);
      if (!nodeIdSet.size && !edgeIdSet.size) return;

      let document = snapshotNow();
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
    [applyDocument, bump, pushHistory, snapshotNow],
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
          snapshotNow(),
          draggedNodes.map((dragged) => dragged.id),
        ) ?? null;
    },
    [pushHistory, snapshotNow],
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
      pushHistory();
      const center = position ??
        flowRef.current?.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }) ?? { x: 120, y: 120 };
      const nodeId = newId(kind);
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
      if (isLibraryKind(kind)) {
        const requestId = `pick-${nodeId}-${Date.now().toString(36)}`;
        pendingPicksRef.current.set(requestId, nodeId);
        propsRef.current.onPickItem(requestId, nodeId, kind);
      }
    },
    [bump, pushHistory],
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
    if (previous) applyDocument(previous);
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
      documentHistory.push(previous);
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
      preDrawRef.current = snapshotNow();
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
    [flowPoint, snapshotNow],
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
      if (model.kind === "pdf" && model.data.attachmentID) {
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
    [startEdit],
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

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setActiveTool("select");
      const position = flowRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) ?? { x: 120, y: 120 };
      const nodeId = newId("item");
      pushHistory();
      setNodes((current) => [
        ...current,
        canvasDocumentToFlow({
          version: 2,
          nodes: [createBasicNode("item", position, nodeId)],
          connections: [],
        }).nodes[0],
      ]);
      bump();
      const raw: Record<string, string> = Object.create(null) as Record<
        string,
        string
      >;
      const types = Array.from(event.dataTransfer?.types || []);
      for (const type of types) {
        try {
          raw[type] = event.dataTransfer.getData(type);
        } catch {
          // ignore
        }
      }
      const requestId = `drop-${nodeId}-${Date.now().toString(36)}`;
      pendingPicksRef.current.set(requestId, nodeId);
      propsRef.current.onDropItems(requestId, nodeId, raw);
    },
    [bump, pushHistory],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editing) return;
      if (event.key === "Escape") {
        endFrameDrag();
        if (drawRef.current) {
          event.preventDefault();
          cancelDraw();
          return;
        }
        setMenu(null);
        setHelpOpen(false);
        setStyleTarget(null);
        setActiveTool("select");
        if (editing) cancelEdit();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        const next = toolShortcut(event.key);
        if (next) {
          event.preventDefault();
          setActiveTool(next);
          return;
        }
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        const selectedNodeIds = nodesRef.current
          .filter((node) => node.selected)
          .map((node) => node.id);
        const selectedEdgeIds = edgesRef.current
          .filter((edge) => edge.selected)
          .map((edge) => edge.id);
        if (!selectedNodeIds.length && !selectedEdgeIds.length) return;
        event.preventDefault();
        deleteCanvasElements(selectedNodeIds, selectedEdgeIds);
        return;
      }
      captureCanvasArrowKey(event, Boolean(editing), nudgeSelected);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editing,
    cancelDraw,
    cancelEdit,
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
      resolvePick(requestId, nodeId, data) {
        if (pendingPicksRef.current.get(requestId) !== nodeId) return;
        pendingPicksRef.current.delete(requestId);
        const picker = parsePickerNodeData(data);
        if (!picker) {
          propsRef.current.onError("Invalid Zotero picker payload.");
          return;
        }
        pushHistory();
        setNodes((current) =>
          current.map((node) =>
            node.id === nodeId
              ? updateFlowNodeModel(node, (model) =>
                  mergePickerData(model, picker),
                )
              : node,
          ),
        );
        bump();
      },
      rejectPick(requestId, message) {
        if (!pendingPicksRef.current.delete(requestId)) return;
        propsRef.current.onError(message);
      },
      setSaveState(state) {
        setSaveState(state);
      },
    };
    runtimeRef.current = runtime;
    propsRef.current.onReady(runtime);
  }, [bump, loadSnapshot, pushHistory, redo, snapshotNow, undo]);

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
    ? effectiveCanvasNodeTextStyle(
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
        className={`zmd-board-host${eraser ? " is-eraser" : ""}${activeTool === "hand" ? " is-hand" : ""}${isDrawTool(activeTool) ? " is-draw" : ""}`}
        data-theme={theme}
        onDragOver={(event) => {
          if (event.dataTransfer?.types?.length) event.preventDefault();
        }}
        onDrop={handleDrop}
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
        <PropertiesPanel
          labels={labels}
          node={
            selectedNodes.length === 1 &&
            isLibraryKind(selectedNodes[0].data.model.kind)
              ? selectedNodes[0]
              : null
          }
          onEdit={startEdit}
          onOpen={openNode}
          onCopy={copyNode}
          onDelete={deleteNode}
        />
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
            if (isLibraryKind(kind)) {
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
            if (!isStampTool(activeTool)) return;
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
                    mergeEditingStyle(current, editing.value, {
                      fontWeight:
                        current.data.model.style?.fontWeight === "bold"
                          ? "normal"
                          : "bold",
                    }),
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
                    <span>{labels.openItem}</span>
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
