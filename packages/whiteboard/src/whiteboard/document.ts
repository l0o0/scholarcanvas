import { MarkerType, type Edge, type Viewport } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { CanvasNode } from "../model/academic";
import type { CanvasConnection } from "../model/connection";
import type { CanvasNodeStyle } from "../model/core";
import type { CanvasDocument } from "../model/document";
import type { BasicPickerPayload } from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";

export interface CanvasFlowEdgeData extends Record<string, unknown> {
  connection: CanvasConnection;
}

export type CanvasFlowEdge = Edge<CanvasFlowEdgeData>;

export interface CanvasDocumentShell {
  metadata?: CanvasDocument["metadata"];
  extensions?: CanvasDocument["extensions"];
}

export interface CanvasFlowDocument {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  shell: CanvasDocumentShell;
}

export type PickerNodeData = BasicPickerPayload;

export function parsePickerNodeData(
  value: unknown,
): PickerNodeData | undefined {
  if (!isRecord(value) || typeof value.title !== "string") return undefined;
  if (!hasValidOptionalPickerFields(value, ["subtitle", "preview"], [])) {
    return undefined;
  }
  const common = {
    title: value.title,
    ...optionalStringProperty(value, "subtitle"),
    ...optionalStringProperty(value, "preview"),
  };
  switch (value.kind) {
    case "item": {
      if (!hasValidOptionalPickerFields(value, [], ["itemID"])) {
        return undefined;
      }
      return {
        kind: "item",
        ...common,
        ...optionalNumberProperty(value, "itemID"),
      };
    }
    case "pdf": {
      if (
        !hasValidOptionalPickerFields(
          value,
          ["image", "asset"],
          ["itemID", "attachmentID", "pdfPage"],
        )
      ) {
        return undefined;
      }
      return {
        kind: "pdf",
        ...common,
        ...optionalNumberProperty(value, "itemID"),
        ...optionalNumberProperty(value, "attachmentID"),
        ...optionalNumberProperty(value, "pdfPage"),
        ...optionalStringProperty(value, "image"),
        ...optionalStringProperty(value, "asset"),
      };
    }
    case "attachment": {
      if (
        !hasValidOptionalPickerFields(value, [], ["itemID", "attachmentID"])
      ) {
        return undefined;
      }
      return {
        kind: "attachment",
        ...common,
        ...optionalNumberProperty(value, "itemID"),
        ...optionalNumberProperty(value, "attachmentID"),
      };
    }
    default:
      return undefined;
  }
}

export function mergePickerData(
  model: CanvasNode,
  picker: PickerNodeData,
): CanvasNode {
  const shared = {
    id: model.id,
    position: model.position,
    width: model.width,
    height: model.height,
    ...(model.kind !== "frame" && model.frameId
      ? { frameId: model.frameId }
      : {}),
    ...(model.style ? { style: model.style } : {}),
    ...(model.extensions ? { extensions: model.extensions } : {}),
  };
  switch (picker.kind) {
    case "item":
      return {
        ...shared,
        kind: "item",
        data: {
          title: picker.title,
          ...definedString("subtitle", picker.subtitle),
          ...definedString("preview", picker.preview),
          ...definedNumber("itemID", picker.itemID),
        },
      };
    case "pdf":
      return {
        ...shared,
        kind: "pdf",
        data: {
          title: picker.title,
          ...definedString("subtitle", picker.subtitle),
          ...definedString("preview", picker.preview),
          ...definedNumber("itemID", picker.itemID),
          ...definedNumber("attachmentID", picker.attachmentID),
          ...definedNumber("pdfPage", picker.pdfPage),
          ...definedString("image", picker.image),
          ...definedString("asset", picker.asset),
        },
      };
    case "attachment":
      return {
        ...shared,
        kind: "attachment",
        data: {
          title: picker.title,
          ...definedString("subtitle", picker.subtitle),
          ...definedString("preview", picker.preview),
          ...definedNumber("itemID", picker.itemID),
          ...definedNumber("attachmentID", picker.attachmentID),
        },
      };
  }
}

export function nodeTextStyle(style: Partial<CanvasNodeStyle>): CSSProperties {
  return {
    ...(style.fontFamily !== undefined ? { fontFamily: style.fontFamily } : {}),
    ...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
    ...(style.fontWeight !== undefined ? { fontWeight: style.fontWeight } : {}),
    ...(style.fontStyle !== undefined ? { fontStyle: style.fontStyle } : {}),
    ...(style.textDecoration !== undefined
      ? { textDecoration: style.textDecoration }
      : {}),
    ...(style.textAlign !== undefined ? { textAlign: style.textAlign } : {}),
    ...(style.textColor !== undefined ? { color: style.textColor } : {}),
    ...(style.textOpacity !== undefined ? { opacity: style.textOpacity } : {}),
  };
}

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
    ...nodeTextStyle(style),
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

export function canvasDocumentToFlow(
  document: CanvasDocument,
): CanvasFlowDocument {
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
    shell: {
      ...(document.metadata ? { metadata: document.metadata } : {}),
      ...(document.extensions ? { extensions: document.extensions } : {}),
    },
  };
}

export function flowToCanvasDocument(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  viewport: Viewport,
  shell: CanvasDocumentShell = {},
): CanvasDocument {
  return {
    version: 2,
    viewport,
    ...(shell.metadata ? { metadata: shell.metadata } : {}),
    ...(shell.extensions ? { extensions: shell.extensions } : {}),
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

export function beginNodeEditing(
  nodes: CanvasFlowNode[],
  nodeId: string,
): {
  nodes: CanvasFlowNode[];
  editing: { nodeId: string; value: string };
} | null {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  return {
    nodes: nodes.map((item) => ({
      ...item,
      className: item.id === nodeId ? "is-editing-label" : undefined,
    })),
    editing: { nodeId, value: flowNodeText(node) },
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function optionalStringProperty<K extends string>(
  value: Record<string, unknown>,
  key: K,
): Partial<Record<K, string>> {
  return typeof value[key] === "string"
    ? ({ [key]: value[key] } as Partial<Record<K, string>>)
    : {};
}

function optionalNumberProperty<K extends string>(
  value: Record<string, unknown>,
  key: K,
): Partial<Record<K, number>> {
  return typeof value[key] === "number" && Number.isFinite(value[key])
    ? ({ [key]: value[key] } as Partial<Record<K, number>>)
    : {};
}

function hasValidOptionalPickerFields(
  value: Record<string, unknown>,
  stringKeys: string[],
  numberKeys: string[],
): boolean {
  return (
    stringKeys.every(
      (key) => !Object.hasOwn(value, key) || typeof value[key] === "string",
    ) &&
    numberKeys.every(
      (key) =>
        !Object.hasOwn(value, key) ||
        (typeof value[key] === "number" && Number.isFinite(value[key])),
    )
  );
}

function definedString<K extends string>(
  key: K,
  value: string | undefined,
): Partial<Record<K, string>> {
  return value === undefined
    ? {}
    : ({ [key]: value } as Partial<Record<K, string>>);
}

function definedNumber<K extends string>(
  key: K,
  value: number | undefined,
): Partial<Record<K, number>> {
  return value === undefined
    ? {}
    : ({ [key]: value } as Partial<Record<K, number>>);
}
