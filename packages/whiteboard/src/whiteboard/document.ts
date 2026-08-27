import { MarkerType, type Edge, type Viewport } from "@xyflow/react";
import type {
  BoardDocument,
  BoardNodeData,
  BoardNodeKind,
} from "../model/snapshot";
import type { AcademicNode } from "../nodes";

export function boardDocumentToFlow(doc: BoardDocument): {
  nodes: AcademicNode[];
  edges: Edge[];
} {
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
    edges: doc.edges.map((edge) => {
      const color = edge.color ?? "#9ca3af";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        label: edge.label,
        style: {
          stroke: color,
          strokeDasharray: edge.dashed ? "6 4" : undefined,
        },
        markerEnd:
          edge.arrow === false
            ? undefined
            : {
                type: MarkerType.ArrowClosed,
                width: 16,
                height: 16,
                color,
              },
      };
    }),
  };
}

export function flowToBoardDocument(
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
      arrow: Boolean(edge.markerEnd),
    })),
  };
}

export function mergeEditingStyle(
  node: AcademicNode,
  title: string,
  patch: Partial<BoardNodeData>,
): AcademicNode {
  return {
    ...node,
    data: { ...node.data, title, ...patch },
  };
}

export function withEdgeColor(edge: Edge, color: string): Edge {
  return {
    ...edge,
    style: { ...(edge.style ?? {}), stroke: color },
    markerEnd: edge.markerEnd
      ? {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color,
        }
      : undefined,
  };
}

export class BoardDocumentHistory {
  revision = 0;
  private history: BoardDocument[] = [];
  private future: BoardDocument[] = [];

  constructor(private readonly onChange: (revision: number) => void) {}

  changed() {
    this.revision += 1;
    this.onChange(this.revision);
  }

  push(document: BoardDocument) {
    this.history.push(document);
    if (this.history.length > 80) this.history.shift();
    this.future = [];
  }

  replace() {
    this.history = [];
    this.future = [];
  }

  undo(current: BoardDocument): BoardDocument | undefined {
    const previous = this.history.pop();
    if (!previous) return undefined;
    this.future.push(current);
    this.changed();
    return previous;
  }

  redo(current: BoardDocument): BoardDocument | undefined {
    const next = this.future.pop();
    if (!next) return undefined;
    this.history.push(current);
    this.changed();
    return next;
  }
}
