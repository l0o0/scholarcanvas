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
  type Edge,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./board.css";
import type { WhiteboardLabels, WhiteboardTheme } from "../model/protocol";
import {
  createBoardNode,
  demoBoard,
  parseBoardDocument,
  type BoardDocument,
  type BoardNodeData,
  type BoardNodeKind,
} from "../model/snapshot";
import { boardNodeTypes, type AcademicNode } from "../nodes";
import { PropertiesPanel } from "../chrome/PropertiesPanel";
import { ShortcutsOverlay } from "../chrome/ShortcutsOverlay";
import { StyleBar } from "../chrome/StyleBar";
import { TextStyleBar, labelTextStyle } from "../chrome/TextStyleBar";
import { TopIsland } from "../chrome/TopIsland";
import {
  frameFromDrag,
  isBorderHit,
  isDrawTool,
  isLibraryKind,
  isStampTool,
  toolAfterDraw,
  toolShortcut,
  type DrawFrame,
  type DrawKind,
} from "../chrome/draw";
import type { CanvasTool } from "../chrome/tools";
import { getNodeSpec } from "../nodes";
import {
  alignNodes,
  autoLayoutNodes,
  distributeNodes,
  type AlignMode,
} from "./layout";
import { buildBoardMarkdown, buildBoardSvg, svgToPngDataUrl } from "./export";
import { IconCopy, IconEdit, IconExport, IconOpen, IconTrash } from "./icons";

const DEFAULT_LABELS: WhiteboardLabels = {
  addItem: "Item",
  addNote: "Note",
  addPdf: "PDF",
  addFile: "File",
  addText: "Text",
  addRect: "Rect",
  addEllipse: "Oval",
  addLine: "Line",
  addArrow: "Arrow",
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
};

export interface WhiteboardAppProps {
  theme: WhiteboardTheme;
  labels?: WhiteboardLabels;
  initialSnapshot?: BoardDocument | Record<string, unknown> | null;
  onReady: (api: WhiteboardRuntime) => void;
  onChange: (rev: number) => void;
  onError: (message: string) => void;
  onSave: () => void;
  onPickItem: (
    requestId: string,
    nodeId: string,
    kind: "item" | "pdf" | "note" | "attachment",
  ) => void;
  onOpenItem: (payload: {
    itemID?: number;
    attachmentID?: number;
    noteID?: number;
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
  loadSnapshot: (snapshot: BoardDocument | Record<string, unknown>) => void;
  getSnapshot: () => BoardDocument;
  undo: () => void;
  redo: () => void;
  resolvePick: (requestId: string, nodeId: string, data: BoardNodeData) => void;
  rejectPick: (requestId: string, message: string) => void;
  setSaveState: (state: "saved" | "saving" | "error") => void;
}

function newId(kind: string) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
}

function toFlow(doc: BoardDocument): { nodes: AcademicNode[]; edges: Edge[] } {
  return {
    nodes: doc.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      width: node.width,
      height: node.height,
      style:
        node.width || node.height
          ? { width: node.width, height: node.height }
          : undefined,
    })),
    edges: doc.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      label: edge.label,
      style: {
        stroke: edge.color ?? "#9ca3af",
        strokeDasharray: edge.dashed ? "6 4" : undefined,
      },
      markerEnd: edge.color
        ? {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: edge.color,
          }
        : { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    })),
  };
}

function fromFlow(
  nodes: AcademicNode[],
  edges: Edge[],
  viewport: Viewport,
): BoardDocument {
  return {
    v: 1,
    engine: "xyflow",
    viewport,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: (node.type as BoardNodeKind) || "item",
      position: node.position,
      width:
        node.width ??
        (typeof node.style?.width === "number" ? node.style.width : undefined),
      height:
        node.height ??
        (typeof node.style?.height === "number"
          ? node.style.height
          : undefined),
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      label: typeof edge.label === "string" ? edge.label : undefined,
      dashed: edge.style?.strokeDasharray ? true : undefined,
      color:
        typeof edge.style?.stroke === "string" ? edge.style.stroke : undefined,
    })),
  };
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

function nodeSize(node: AcademicNode) {
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
  node: AcademicNode,
  frame: DrawFrame,
  kind: DrawKind,
): AcademicNode {
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
  return {
    ...node,
    position,
    width,
    height,
    style: { width, height },
    data: { ...node.data, from: start, to: end },
  };
}

export function WhiteboardApp(props: WhiteboardAppProps): ReactElement {
  const initial = useMemo(
    () => parseBoardDocument(props.initialSnapshot ?? demoBoard()),
    [props.initialSnapshot],
  );
  const seed = useMemo(() => toFlow(initial), [initial]);
  const [nodes, setNodes] = useState<AcademicNode[]>(seed.nodes);
  const [edges, setEdges] = useState<Edge[]>(seed.edges);
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

  const viewportRef = useRef<Viewport>(
    initial.viewport ?? { x: 0, y: 0, zoom: 1 },
  );
  const revRef = useRef(0);
  const historyRef = useRef<BoardDocument[]>([]);
  const futureRef = useRef<BoardDocument[]>([]);
  const flowRef = useRef<ReactFlowInstance<AcademicNode> | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const pendingPicksRef = useRef(new Map<string, string>());
  const runtimeRef = useRef<WhiteboardRuntime | null>(null);
  const drawRef = useRef<DrawSession | null>(null);
  const preDrawRef = useRef<BoardDocument | null>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const bump = useCallback(() => {
    revRef.current += 1;
    propsRef.current.onChange(revRef.current);
  }, []);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const snapshotNow = useCallback(
    () => fromFlow(nodesRef.current, edgesRef.current, viewportRef.current),
    [],
  );

  const pushHistory = useCallback(() => {
    historyRef.current.push(snapshotNow());
    if (historyRef.current.length > 80) historyRef.current.shift();
    futureRef.current = [];
  }, [snapshotNow]);

  const applyDocument = useCallback((doc: BoardDocument) => {
    const next = toFlow(parseBoardDocument(doc));
    setNodes(next.nodes);
    setEdges(next.edges);
    viewportRef.current = doc.viewport ?? { x: 0, y: 0, zoom: 1 };
    flowRef.current?.setViewport(viewportRef.current);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<AcademicNode>[]) => {
      const structural = changes.some(
        (change) => change.type === "remove" || change.type === "add",
      );
      if (structural) pushHistory();
      setNodes((current) => applyNodeChanges(changes, current));
      if (changes.some((change) => change.type !== "select")) bump();
    },
    [bump, pushHistory],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      if (changes.some((change) => change.type === "remove")) pushHistory();
      setEdges((current) => applyEdgeChanges(changes, current));
      if (changes.some((change) => change.type !== "select")) bump();
    },
    [bump, pushHistory],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      pushHistory();
      setEdges((current) =>
        addEdge({ ...connection, id: newId("edge") }, current),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const addNode = useCallback(
    (kind: BoardNodeKind, position?: { x: number; y: number }) => {
      pushHistory();
      const center = position ??
        flowRef.current?.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }) ?? { x: 120, y: 120 };
      const nodeId = newId(kind);
      const spec = getNodeSpec(kind);
      const created = toFlow({
        v: 1,
        engine: "xyflow",
        nodes: [
          {
            ...createBoardNode(kind, center, nodeId),
            width: spec.defaultWidth,
            height: spec.defaultHeight,
          },
        ],
        edges: [],
      }).nodes[0];
      setNodes((current) => [...current, created]);
      bump();
      if (kind === "text") {
        setEditing({ nodeId, value: created.data.title || "" });
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
      historyRef.current.push(previous);
      if (historyRef.current.length > 80) historyRef.current.shift();
      futureRef.current = [];
    }
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.id === session.nodeId,
      })),
    );
    setActiveTool(toolAfterDraw(session.kind));
    bump();
  }, [bump]);

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
        toFlow({
          v: 1,
          engine: "xyflow",
          nodes: [createBoardNode(kind, origin, nodeId)],
          edges: [],
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
      pushHistory();
      setNodes((current) => current.filter((node) => node.id !== id));
      setEdges((current) =>
        current.filter((edge) => edge.source !== id && edge.target !== id),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const eraseEdge = useCallback(
    (id: string) => {
      pushHistory();
      setEdges((current) => current.filter((edge) => edge.id !== id));
      bump();
    },
    [bump, pushHistory],
  );

  const updateNode = useCallback(
    (nodeId: string, updater: (node: AcademicNode) => AcademicNode) => {
      pushHistory();
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? updater(node) : node)),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const startEdit = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((item) => item.id === nodeId);
    if (!node) return;
    setMenu(null);
    setStyleTarget(null);
    setActiveTool("select");
    setNodes((current) =>
      current.map((item) => ({
        ...item,
        className: item.id === nodeId ? "is-editing-label" : undefined,
      })),
    );
    setEditing({ nodeId, value: node.data.title || "" });
  }, []);

  const openNode = useCallback(
    (node: AcademicNode) => {
      const data = node.data;
      if (data.noteID) {
        propsRef.current.onOpenItem({ noteID: data.noteID });
      } else if (data.attachmentID && node.type === "pdf") {
        propsRef.current.onOpenItem({
          attachmentID: data.attachmentID,
          pdfPage: data.pdfPage,
        });
      } else if (data.attachmentID) {
        propsRef.current.onOpenItem({ attachmentID: data.attachmentID });
      } else if (data.itemID) {
        propsRef.current.onOpenItem({ itemID: data.itemID });
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
    if (node.data.title === value) {
      setNodes((current) =>
        current.map((item) => ({ ...item, className: undefined })),
      );
      return;
    }
    updateNode(nodeId, (current) => ({
      ...current,
      className: undefined,
      data: { ...current.data, title: value },
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
        {
          ...node,
          id,
          selected: false,
          position: { x: node.position.x + 24, y: node.position.y + 24 },
        },
      ]);
      bump();
    },
    [bump, pushHistory],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setMenu(null);
      eraseNode(nodeId);
    },
    [eraseNode],
  );

  const alignSelected = useCallback(
    (mode: AlignMode) => {
      const selected = nodesRef.current.filter((node) => node.selected);
      if (selected.length < 2) return;
      pushHistory();
      const aligned = alignNodes(selected, mode);
      setNodes((current) =>
        current.map((node) => {
          const target = aligned.find((item) => item.id === node.id);
          return target ? { ...node, position: target.position } : node;
        }),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const distributeSelected = useCallback(
    (direction: "horizontal" | "vertical") => {
      const selected = nodesRef.current.filter((node) => node.selected);
      if (selected.length < 3) return;
      pushHistory();
      const distributed = distributeNodes(selected, direction);
      setNodes((current) =>
        current.map((node) => {
          const target = distributed.find((item) => item.id === node.id);
          return target ? { ...node, position: target.position } : node;
        }),
      );
      bump();
    },
    [bump, pushHistory],
  );

  const autoLayout = useCallback(() => {
    pushHistory();
    setNodes((current) => autoLayoutNodes(current));
    bump();
  }, [bump, pushHistory]);

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
          item.id === edgeId
            ? {
                ...item,
                style: {
                  ...(item.style ?? {}),
                  stroke: next,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  width: 16,
                  height: 16,
                  color: next,
                },
              }
            : item,
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
          text: buildBoardMarkdown(doc),
        });
        return;
      }
      const svg = buildBoardSvg(doc);
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
        toFlow({
          v: 1,
          engine: "xyflow",
          nodes: [createBoardNode("item", position, nodeId)],
          edges: [],
        }).nodes[0],
      ]);
      bump();
      const raw: Record<string, string> = {};
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
      if (event.key.startsWith("Arrow")) {
        const selected = nodesRef.current.filter((node) => node.selected);
        if (!selected.length) return;
        event.preventDefault();
        const step = event.shiftKey ? 16 : 1;
        const dx =
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0;
        const dy =
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0;
        if (!dx && !dy) return;
        pushHistory();
        setNodes((current) =>
          current.map((node) =>
            node.selected
              ? {
                  ...node,
                  position: {
                    x: node.position.x + dx,
                    y: node.position.y + dy,
                  },
                }
              : node,
          ),
        );
        bump();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, bump, pushHistory, cancelDraw, cancelEdit]);

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
      loadSnapshot(snapshot) {
        applyDocument(parseBoardDocument(snapshot));
        bump();
      },
      getSnapshot: snapshotNow,
      undo() {
        const previous = historyRef.current.pop();
        if (!previous) return;
        futureRef.current.push(snapshotNow());
        applyDocument(previous);
        bump();
      },
      redo() {
        const next = futureRef.current.pop();
        if (!next) return;
        historyRef.current.push(snapshotNow());
        applyDocument(next);
        bump();
      },
      resolvePick(requestId, nodeId, data) {
        if (pendingPicksRef.current.get(requestId) !== nodeId) return;
        pendingPicksRef.current.delete(requestId);
        pushHistory();
        setNodes((current) =>
          current.map((node) =>
            node.id === nodeId ? { ...node, type: data.kind, data } : node,
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
  }, [applyDocument, bump, pushHistory, snapshotNow]);

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
  const menuNode = menu ? nodes.find((node) => node.id === menu.nodeId) : null;
  const styleNode = styleTarget
    ? nodes.find((node) => node.id === styleTarget)
    : null;
  const styleScreen = styleNode
    ? flowRef.current?.flowToScreenPosition(styleNode.position)
    : null;
  const zoom = viewportRef.current.zoom || 1;

  return (
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
          isLibraryKind(
            (selectedNodes[0].type ||
              selectedNodes[0].data.kind) as BoardNodeKind,
          )
            ? selectedNodes[0]
            : null
        }
        onEdit={startEdit}
        onOpen={openNode}
        onCopy={copyNode}
        onDelete={deleteNode}
      />
      <ReactFlow<AcademicNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={boardNodeTypes}
        defaultViewport={initial.viewport}
        fitView={!props.initialSnapshot}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        }}
        snapToGrid={activeTool === "select"}
        snapGrid={[16, 16]}
        deleteKeyCode={editing ? null : ["Backspace", "Delete"]}
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
          const kind = (node.type || node.data.kind) as BoardNodeKind;
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
        onNodeDragStart={pushHistory}
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
      {editing && editingNode && editingScreen ? (
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
                : (editingNode.data.radius ?? 8) *
                  (viewportRef.current.zoom || 1),
          }}
        >
          <textarea
            autoFocus
            className="zmd-board-in-shape-edit"
            value={editing.value}
            style={{
              ...labelTextStyle(editingNode.data),
              lineHeight: `${nodeSize(editingNode).height * (viewportRef.current.zoom || 1)}px`,
              fontSize:
                (editingNode.data.fontSize || 16) *
                (viewportRef.current.zoom || 1),
            }}
            onChange={(event) =>
              setEditing({
                nodeId: editing.nodeId,
                value: event.target.value,
              })
            }
            onBlur={() => {
              if (holdEditFocusRef.current) {
                holdEditFocusRef.current = false;
                return;
              }
              commitEdit();
            }}
            onKeyDown={(event) => {
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "b"
              ) {
                event.preventDefault();
                updateNode(editing.nodeId, (current) => ({
                  ...current,
                  data: {
                    ...current.data,
                    fontWeight:
                      current.data.fontWeight === "bold" ? "normal" : "bold",
                  },
                }));
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
              {(menuNode.data.itemID ||
                menuNode.data.attachmentID ||
                menuNode.data.noteID) && (
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
          data={editingNode.data}
          left={
            editingScreen.x +
            (nodeSize(editingNode).width * (viewportRef.current.zoom || 1)) /
              2 -
            280
          }
          top={Math.max(8, editingScreen.y - 56)}
          onHoldFocus={() => {
            holdEditFocusRef.current = true;
          }}
          onChange={(patch) => {
            holdEditFocusRef.current = true;
            updateNode(editing.nodeId, (current) => ({
              ...current,
              data: { ...current.data, ...patch },
            }));
          }}
        />
      ) : null}
      {styleNode && styleScreen ? (
        <StyleBar
          node={styleNode}
          left={styleScreen.x + (nodeSize(styleNode).width * zoom) / 2 - 280}
          top={Math.max(8, styleScreen.y - 56)}
          onChange={(patch) => {
            const { width, height, ...data } = patch;
            updateNode(styleNode.id, (current) => ({
              ...current,
              width: width ?? current.width,
              height: height ?? current.height,
              style: {
                width: width ?? nodeSize(current).width,
                height: height ?? nodeSize(current).height,
              },
              data: { ...current.data, ...data },
            }));
          }}
        />
      ) : null}
      {helpOpen ? (
        <ShortcutsOverlay onClose={() => setHelpOpen(false)} />
      ) : null}
    </div>
  );
}
