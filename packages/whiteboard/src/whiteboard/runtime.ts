import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { Viewport } from "@xyflow/react";
import { parseCanvasDocument, type CanvasDocument } from "../model/document";
import type { CanvasFlowNode } from "../nodes";
import {
  CanvasDocumentHistory,
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
  getSnapshot: () => CanvasDocument;
  undo: () => void;
  redo: () => void;
}

export function useCanvasDocumentRuntime(
  initial: CanvasDocument,
  onChange: (revision: number) => void,
  onViewport: (viewport: Viewport) => void,
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
  onChangeRef.current = onChange;
  onViewportRef.current = onViewport;

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

  const getSnapshot = useCallback(
    () =>
      flowToCanvasDocument(
        nodesRef.current,
        edgesRef.current,
        viewportRef.current,
        shellRef.current,
      ),
    [],
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
    getSnapshot,
    undo,
    redo,
  };
}

function parseRuntimeDocument(value: CanvasDocument): CanvasDocument {
  return parseCanvasDocument(value).document;
}
