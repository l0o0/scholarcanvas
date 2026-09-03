import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { CanvasNodeKind } from "../model/academic";
import {
  ClaimNode,
  FrameNode,
  LiteratureNode,
  NoteNode,
  QuestionNode,
  QuoteNode,
} from "./academic";
import { AttachmentNode, ItemNode, PdfNode } from "./library";
import { ArrowNode, EllipseNode, LineNode, RectNode, TextNode } from "./shapes";
import type { CanvasFlowNode, NodeGroup } from "./types";

export interface WhiteboardNodeSpec {
  kind: CanvasNodeKind;
  group: NodeGroup;
  defaultWidth: number;
  defaultHeight: number;
  Component: ComponentType<NodeProps<CanvasFlowNode>>;
}

/**
 * Registry of custom React nodes. Add a spec here to expose a new
 * canvas type without touching React Flow wiring.
 */
const NODE_SPECS: WhiteboardNodeSpec[] = [
  {
    kind: "item",
    group: "library",
    defaultWidth: 240,
    defaultHeight: 96,
    Component: ItemNode,
  },
  {
    kind: "pdf",
    group: "library",
    defaultWidth: 240,
    defaultHeight: 220,
    Component: PdfNode,
  },
  {
    kind: "attachment",
    group: "library",
    defaultWidth: 240,
    defaultHeight: 96,
    Component: AttachmentNode,
  },
  {
    kind: "literature",
    group: "academic",
    defaultWidth: 280,
    defaultHeight: 136,
    Component: LiteratureNode,
  },
  {
    kind: "quote",
    group: "academic",
    defaultWidth: 280,
    defaultHeight: 168,
    Component: QuoteNode,
  },
  {
    kind: "note",
    group: "academic",
    defaultWidth: 260,
    defaultHeight: 152,
    Component: NoteNode,
  },
  {
    kind: "question",
    group: "academic",
    defaultWidth: 260,
    defaultHeight: 128,
    Component: QuestionNode,
  },
  {
    kind: "claim",
    group: "academic",
    defaultWidth: 260,
    defaultHeight: 128,
    Component: ClaimNode,
  },
  {
    kind: "frame",
    group: "academic",
    defaultWidth: 480,
    defaultHeight: 320,
    Component: FrameNode,
  },
  {
    kind: "text",
    group: "draw",
    defaultWidth: 240,
    defaultHeight: 72,
    Component: TextNode,
  },
  {
    kind: "rect",
    group: "draw",
    defaultWidth: 140,
    defaultHeight: 88,
    Component: RectNode,
  },
  {
    kind: "ellipse",
    group: "draw",
    defaultWidth: 140,
    defaultHeight: 88,
    Component: EllipseNode,
  },
  {
    kind: "line",
    group: "draw",
    defaultWidth: 160,
    defaultHeight: 32,
    Component: LineNode,
  },
  {
    kind: "arrow",
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

export function getNodeSpec(kind: CanvasNodeKind): WhiteboardNodeSpec {
  const spec = byKind.get(kind);
  if (!spec) throw new Error(`Unknown whiteboard node kind: ${kind}`);
  return spec;
}

export const boardNodeTypes = Object.fromEntries(
  NODE_SPECS.map((spec) => [spec.kind, spec.Component]),
) as Record<CanvasNodeKind, WhiteboardNodeSpec["Component"]>;
