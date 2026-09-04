import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { Viewport } from "@xyflow/react";
import { createAcademicNode, type LiteratureNode } from "../model/academic";
import { createBasicNode } from "../model/basic";
import { parseCanvasDocument, type CanvasDocument } from "../model/document";
import type { AcademicAcquisition } from "../model/protocol";
import type { SourceResolutionResult } from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";
import {
  CanvasDocumentHistory,
  applySourceResolutionResults,
  canvasDocumentToFlow,
  flowToCanvasDocument,
  type CanvasDocumentShell,
  type CanvasFlowEdge,
} from "./document";

export interface CanvasDocumentRuntime {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  setNodes: Dispatch<SetStateAction<CanvasFlowNode[]>>;
  setEdges: Dispatch<SetStateAction<CanvasFlowEdge[]>>;
  nodesRef: MutableRefObject<CanvasFlowNode[]>;
  edgesRef: MutableRefObject<CanvasFlowEdge[]>;
  viewportRef: MutableRefObject<Viewport>;
  shellRef: MutableRefObject<CanvasDocumentShell>;
  history: CanvasDocumentHistory;
  changed: () => void;
  pushHistory: () => void;
  applyDocument: (value: CanvasDocument) => void;
  loadSnapshot: (value: CanvasDocument) => void;
  applySourceResolutionBatch: (
    generation: number,
    results: SourceResolutionResult[],
  ) => void;
  getRawSnapshot: () => CanvasDocument;
  getSnapshot: () => CanvasDocument;
  undo: () => void;
  redo: () => void;
}

export interface AcademicAcquisitionRuntimeBindings {
  getNodes: () => CanvasFlowNode[];
  setNodes: (nodes: CanvasFlowNode[]) => void;
  getEdges: () => CanvasFlowEdge[];
  setEdges: (edges: CanvasFlowEdge[]) => void;
  pushHistory: () => void;
  changed: () => void;
  onError: (message: string) => void;
  onPickAcademicSource: (
    requestId: string,
    nodeId: string,
    kind: "literature",
  ) => void;
  onDropAcademicSources: (
    requestId: string,
    nodeId: string,
    raw: Record<string, string>,
  ) => void;
}

export interface AcademicAcquisitionRuntime {
  placeLiterature: (
    requestId: string,
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  dropLiterature: (
    requestId: string,
    nodeId: string,
    position: { x: number; y: number },
    raw: Record<string, string>,
  ) => void;
  resolve: (
    requestId: string,
    nodeId: string,
    acquisition: AcademicAcquisition,
  ) => void;
  reject: (requestId: string, nodeId: string, message: string) => void;
  pendingNodeIds: () => string[];
}

export function applySourceResolutionBatch(
  setNodes: Dispatch<SetStateAction<CanvasFlowNode[]>>,
  generation: number,
  results: SourceResolutionResult[],
): void {
  setNodes((current) =>
    applySourceResolutionResults(current, generation, results),
  );
}

export function createAcademicAcquisitionRuntime(
  bindings: AcademicAcquisitionRuntimeBindings,
): AcademicAcquisitionRuntime {
  const pending = new Map<string, string>();

  const addPlaceholder = (
    requestId: string,
    nodeId: string,
    position: { x: number; y: number },
  ) => {
    pending.set(requestId, nodeId);
    const placeholder = canvasDocumentToFlow({
      version: 2,
      nodes: [
        {
          ...createBasicNode("item", position, nodeId),
          data: { title: "Loading…" },
        },
      ],
      connections: [],
    }).nodes[0];
    bindings.setNodes([...bindings.getNodes(), placeholder]);
  };

  const reject = (requestId: string, nodeId: string, message: string) => {
    if (pending.get(requestId) !== nodeId) return;
    pending.delete(requestId);
    bindings.setNodes(rejectAcademicPlaceholder(bindings.getNodes(), nodeId));
    bindings.setEdges(
      rejectAcademicPlaceholderConnections(bindings.getEdges(), nodeId),
    );
    bindings.onError(message);
  };

  return {
    placeLiterature(requestId, nodeId, position) {
      addPlaceholder(requestId, nodeId, position);
      bindings.onPickAcademicSource(requestId, nodeId, "literature");
    },
    dropLiterature(requestId, nodeId, position, raw) {
      addPlaceholder(requestId, nodeId, position);
      bindings.onDropAcademicSources(requestId, nodeId, raw);
    },
    resolve(requestId, nodeId, acquisition) {
      if (pending.get(requestId) !== nodeId) return;
      const resolved = resolveAcademicPlaceholder(
        bindings.getNodes(),
        nodeId,
        acquisition,
      );
      if (!resolved) {
        reject(requestId, nodeId, "Invalid Zotero academic acquisition.");
        return;
      }
      bindings.pushHistory();
      pending.delete(requestId);
      bindings.setNodes(resolved);
      bindings.changed();
    },
    reject,
    pendingNodeIds: () => Array.from(pending.values()),
  };
}

export function resolveAcademicPlaceholder(
  nodes: CanvasFlowNode[],
  nodeId: string,
  acquisition: AcademicAcquisition | LiteratureNode,
): CanvasFlowNode[] | undefined {
  if (acquisition.kind !== "literature" && acquisition.kind !== "note") {
    return undefined;
  }
  const placeholder = nodes.find((node) => node.id === nodeId);
  if (!placeholder) return undefined;
  const academic =
    "id" in acquisition
      ? acquisition
      : acquisition.kind === "literature"
        ? createAcademicNode("literature", placeholder.position, nodeId, {
            source: acquisition.source,
            snapshot: acquisition.snapshot,
          })
        : {
            ...createAcademicNode("note", placeholder.position, nodeId),
            source: acquisition.source,
            ...(acquisition.sourceSnapshot
              ? { sourceSnapshot: acquisition.sourceSnapshot }
              : {}),
            content: acquisition.content,
          };
  const replacement = canvasDocumentToFlow({
    version: 2,
    nodes: [academic],
    connections: [],
  }).nodes[0];
  return nodes.map((node) =>
    node.id === nodeId ? { ...replacement, selected: node.selected } : node,
  );
}

export function rejectAcademicPlaceholder(
  nodes: CanvasFlowNode[],
  nodeId: string,
): CanvasFlowNode[] {
  return nodes.filter((node) => node.id !== nodeId);
}

export function rejectAcademicPlaceholderConnections(
  edges: CanvasFlowEdge[],
  nodeId: string,
): CanvasFlowEdge[] {
  return edges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId,
  );
}

export function omitAcademicPlaceholders(
  document: CanvasDocument,
  nodeIds: Iterable<string>,
): CanvasDocument {
  const omitted = new Set(nodeIds);
  if (!omitted.size) return document;
  return {
    ...document,
    nodes: document.nodes.filter((node) => !omitted.has(node.id)),
    connections: document.connections.filter(
      (connection) =>
        !omitted.has(connection.source) && !omitted.has(connection.target),
    ),
  };
}

export function useCanvasDocumentRuntime(
  initial: CanvasDocument,
  onChange: (revision: number) => void,
  onViewport: (viewport: Viewport) => void,
  snapshotTransform: (document: CanvasDocument) => CanvasDocument = (
    document,
  ) => document,
): CanvasDocumentRuntime {
  const seedRef = useRef(canvasDocumentToFlow(initial));
  const [nodes, setNodesState] = useState(seedRef.current.nodes);
  const [edges, setEdgesState] = useState(seedRef.current.edges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const viewportRef = useRef<Viewport>(
    initial.viewport ?? { x: 0, y: 0, zoom: 1 },
  );
  const shellRef = useRef(seedRef.current.shell);
  const onChangeRef = useRef(onChange);
  const onViewportRef = useRef(onViewport);
  const snapshotTransformRef = useRef(snapshotTransform);
  onChangeRef.current = onChange;
  onViewportRef.current = onViewport;
  snapshotTransformRef.current = snapshotTransform;

  const historyRef = useRef<CanvasDocumentHistory | null>(null);
  if (!historyRef.current) {
    historyRef.current = new CanvasDocumentHistory((revision) =>
      onChangeRef.current(revision),
    );
  }
  const history = historyRef.current;

  const setNodes = useCallback<Dispatch<SetStateAction<CanvasFlowNode[]>>>(
    (update) => {
      const next =
        typeof update === "function" ? update(nodesRef.current) : update;
      nodesRef.current = next;
      setNodesState(next);
    },
    [],
  );

  const setEdges = useCallback<Dispatch<SetStateAction<CanvasFlowEdge[]>>>(
    (update) => {
      const next =
        typeof update === "function" ? update(edgesRef.current) : update;
      edgesRef.current = next;
      setEdgesState(next);
    },
    [],
  );

  const getRawSnapshot = useCallback(
    () =>
      flowToCanvasDocument(
        nodesRef.current,
        edgesRef.current,
        viewportRef.current,
        shellRef.current,
      ),
    [],
  );

  const getSnapshot = useCallback(
    () => snapshotTransformRef.current(getRawSnapshot()),
    [getRawSnapshot],
  );

  const pushHistory = useCallback(() => {
    history.push(getSnapshot());
  }, [getSnapshot, history]);

  const changed = useCallback(() => {
    history.changed();
  }, [history]);

  const applyDocument = useCallback((value: CanvasDocument) => {
    const document = parseRuntimeDocument(value);
    const next = canvasDocumentToFlow(document);
    const viewport = document.viewport ?? { x: 0, y: 0, zoom: 1 };

    nodesRef.current = next.nodes;
    edgesRef.current = next.edges;
    shellRef.current = next.shell;
    viewportRef.current = viewport;

    setNodesState(next.nodes);
    setEdgesState(next.edges);
    onViewportRef.current(viewport);
  }, []);

  const loadSnapshot = useCallback(
    (value: CanvasDocument) => {
      applyDocument(value);
      history.replace();
    },
    [applyDocument, history],
  );

  const applyDocumentSourceResolutionBatch = useCallback(
    (generation: number, results: SourceResolutionResult[]) => {
      applySourceResolutionBatch(setNodes, generation, results);
    },
    [setNodes],
  );

  const undo = useCallback(() => {
    const previous = history.undo(getSnapshot());
    if (previous) applyDocument(previous);
  }, [applyDocument, getSnapshot, history]);

  const redo = useCallback(() => {
    const next = history.redo(getSnapshot());
    if (next) applyDocument(next);
  }, [applyDocument, getSnapshot, history]);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    nodesRef,
    edgesRef,
    viewportRef,
    shellRef,
    history,
    changed,
    pushHistory,
    applyDocument,
    loadSnapshot,
    applySourceResolutionBatch: applyDocumentSourceResolutionBatch,
    getRawSnapshot,
    getSnapshot,
    undo,
    redo,
  };
}

function parseRuntimeDocument(value: CanvasDocument): CanvasDocument {
  return parseCanvasDocument(value).document;
}
