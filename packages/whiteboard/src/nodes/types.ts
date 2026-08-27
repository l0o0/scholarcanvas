import type { Node } from "@xyflow/react";
import type { BoardNodeData, BoardNodeKind } from "../model/snapshot";

export type AcademicNode = Node<BoardNodeData, BoardNodeKind>;

export type NodeGroup = "library" | "draw";
