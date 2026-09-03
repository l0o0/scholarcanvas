import type { Node } from "@xyflow/react";
import type { CanvasNode, CanvasNodeKind } from "../model/academic";

export interface CanvasFlowData extends Record<string, unknown> {
  model: CanvasNode;
}

export type CanvasFlowNode = Node<CanvasFlowData, CanvasNodeKind>;

export type NodeGroup = "library" | "draw";
