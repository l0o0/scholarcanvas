import { MarkerType, type Edge, type Viewport } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { CanvasNode } from "../model/academic";
import type { CanvasConnection } from "../model/connection";
import type { CanvasNodeStyle } from "../model/core";
import type { CanvasDocument } from "../model/document";
import type { CanvasFlowNode } from "../nodes";

export interface CanvasFlowEdgeData extends Record<string, unknown> {
  connection: CanvasConnection;
}

export type CanvasFlowEdge = Edge<CanvasFlowEdgeData>;

export function labelTextStyle(style: Partial<CanvasNodeStyle>): CSSProperties {
  return {
    fontFamily: style.fontFamily || "system-ui, sans-serif",
    fontSize: style.fontSize || 16,
    fontWeight: style.fontWeight || "normal",
    fontStyle: style.fontStyle || "normal",
    textDecoration: style.textDecoration || "none",
    textAlign: style.textAlign || "center",
    color: style.textColor || "#111827",
    opacity: style.textOpacity ?? 1,
    lineHeight: 1.25,
    width: "100%",
    display: "block",
  };
}

export function verticalAlignmentStyle(
  style: Partial<CanvasNodeStyle>,
): CSSProperties {
  const alignment = style.verticalAlign || "middle";
  return {
    alignItems:
      alignment === "top"
        ? "flex-start"
        : alignment === "bottom"
          ? "flex-end"
          : "center",
  };
}

export function canvasDocumentToFlow(document: CanvasDocument): {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
} {
  return {
    nodes: document.nodes.map((model) => ({
      id: model.id,
      type: model.kind,
      position: model.position,
      data: { model },
      width: model.width,
      height: model.height,
      style: { width: model.width, height: model.height },
    })),
    edges: document.connections.map((connection) => {
      const color = connection.color ?? "#9ca3af";
      return {
        id: connection.id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        label: connection.label,
        data: { connection },
        style: {
          stroke: color,
          strokeDasharray: connection.dashed ? "6 4" : undefined,
        },
        markerEnd:
          connection.arrow === false
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

export function flowToCanvasDocument(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  viewport: Viewport,
): CanvasDocument {
  return {
    version: 2,
    viewport,
    nodes: nodes.map((node) => ({
      ...node.data.model,
      id: node.id,
      position: node.position,
      width:
        node.measured?.width ??
        node.width ??
        numericStyleDimension(node.style?.width) ??
        node.data.model.width,
      height:
        node.measured?.height ??
        node.height ??
        numericStyleDimension(node.style?.height) ??
        node.data.model.height,
    })),
    connections: edges.map((edge) => {
      const connection = edge.data?.connection ?? {
        id: edge.id,
        kind: "basic" as const,
        source: edge.source,
        target: edge.target,
      };
      return {
        ...connection,
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        label: typeof edge.label === "string" ? edge.label : undefined,
        dashed: Boolean(edge.style?.strokeDasharray),
        color:
          typeof edge.style?.stroke === "string"
            ? edge.style.stroke
            : undefined,
        arrow: Boolean(edge.markerEnd),
      };
    }),
  };
}

export function updateFlowNodeModel(
  node: CanvasFlowNode,
  update: (model: CanvasNode) => CanvasNode,
): CanvasFlowNode {
  const model = update(node.data.model);
  return { ...node, type: model.kind, data: { ...node.data, model } };
}

export function flowNodeText(node: CanvasFlowNode): string {
  const model = node.data.model;
  if (
    model.kind === "note" ||
    model.kind === "question" ||
    model.kind === "claim"
  ) {
    return model.content;
  }
  if (model.kind === "frame") return model.title;
  if (model.kind === "literature") return model.snapshot.title;
  if (model.kind === "quote") return model.snapshot.text;
  return model.data.title;
}

export function mergeEditingStyle(
  node: CanvasFlowNode,
  text: string,
  patch: Partial<CanvasNodeStyle>,
): CanvasFlowNode {
  return updateFlowNodeModel(node, (model) => ({
    ...updateCanvasNodeText(model, text),
    style: { ...(model.style ?? {}), ...patch },
  }));
}

export function withEdgeColor(
  edge: CanvasFlowEdge,
  color: string,
): CanvasFlowEdge {
  return {
    ...edge,
    data: edge.data
      ? {
          ...edge.data,
          connection: { ...edge.data.connection, color },
        }
      : edge.data,
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

export class CanvasDocumentHistory {
  revision = 0;
  private history: CanvasDocument[] = [];
  private future: CanvasDocument[] = [];

  constructor(private readonly onChange: (revision: number) => void) {}

  changed() {
    this.revision += 1;
    this.onChange(this.revision);
  }

  push(document: CanvasDocument) {
    this.history.push(document);
    if (this.history.length > 80) this.history.shift();
    this.future = [];
  }

  replace() {
    this.history = [];
    this.future = [];
  }

  undo(current: CanvasDocument): CanvasDocument | undefined {
    const previous = this.history.pop();
    if (!previous) return undefined;
    this.future.push(current);
    this.changed();
    return previous;
  }

  redo(current: CanvasDocument): CanvasDocument | undefined {
    const next = this.future.pop();
    if (!next) return undefined;
    this.history.push(current);
    this.changed();
    return next;
  }
}

function numericStyleDimension(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function updateCanvasNodeText(model: CanvasNode, text: string): CanvasNode {
  switch (model.kind) {
    case "note":
    case "question":
    case "claim":
      return { ...model, content: text };
    case "frame":
      return { ...model, title: text };
    case "literature":
      return { ...model, snapshot: { ...model.snapshot, title: text } };
    case "quote":
      return { ...model, snapshot: { ...model.snapshot, text } };
    default:
      return { ...model, data: { ...model.data, title: text } };
  }
}
