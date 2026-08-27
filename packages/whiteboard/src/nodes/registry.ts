import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { BoardNodeKind } from "../model/snapshot";
import { AttachmentNode, ItemNode, NoteNode, PdfNode } from "./library";
import { ArrowNode, EllipseNode, LineNode, RectNode, TextNode } from "./shapes";
import type { AcademicNode, NodeGroup } from "./types";

export interface WhiteboardNodeSpec {
  kind: BoardNodeKind;
  label: string;
  group: NodeGroup;
  defaultWidth: number;
  defaultHeight: number;
  Component: ComponentType<NodeProps<AcademicNode>>;
}

/**
 * Registry of custom React nodes. Add a spec here to expose a new
 * canvas type without touching React Flow wiring.
 */
const NODE_SPECS: WhiteboardNodeSpec[] = [
  {
    kind: "item",
    label: "Item",
    group: "library",
    defaultWidth: 240,
    defaultHeight: 96,
    Component: ItemNode,
  },
  {
    kind: "note",
    label: "Note",
    group: "library",
    defaultWidth: 240,
    defaultHeight: 128,
    Component: NoteNode,
  },
  {
    kind: "pdf",
    label: "PDF",
    group: "library",
    defaultWidth: 240,
    defaultHeight: 220,
    Component: PdfNode,
  },
  {
    kind: "attachment",
    label: "File",
    group: "library",
    defaultWidth: 240,
    defaultHeight: 96,
    Component: AttachmentNode,
  },
  {
    kind: "text",
    label: "Text",
    group: "draw",
    defaultWidth: 240,
    defaultHeight: 72,
    Component: TextNode,
  },
  {
    kind: "rect",
    label: "Rect",
    group: "draw",
    defaultWidth: 140,
    defaultHeight: 88,
    Component: RectNode,
  },
  {
    kind: "ellipse",
    label: "Oval",
    group: "draw",
    defaultWidth: 140,
    defaultHeight: 88,
    Component: EllipseNode,
  },
  {
    kind: "line",
    label: "Line",
    group: "draw",
    defaultWidth: 160,
    defaultHeight: 32,
    Component: LineNode,
  },
  {
    kind: "arrow",
    label: "Arrow",
    group: "draw",
    defaultWidth: 160,
    defaultHeight: 32,
    Component: ArrowNode,
  },
];

const byKind = new Map(NODE_SPECS.map((spec) => [spec.kind, spec]));

export function listNodeSpecs(group?: NodeGroup): WhiteboardNodeSpec[] {
  return group
    ? NODE_SPECS.filter((spec) => spec.group === group)
    : NODE_SPECS.slice();
}

export function getNodeSpec(kind: BoardNodeKind): WhiteboardNodeSpec {
  const spec = byKind.get(kind);
  if (!spec) throw new Error(`Unknown whiteboard node kind: ${kind}`);
  return spec;
}

export const boardNodeTypes = Object.fromEntries(
  NODE_SPECS.map((spec) => [spec.kind, spec.Component]),
) as Record<BoardNodeKind, WhiteboardNodeSpec["Component"]>;
