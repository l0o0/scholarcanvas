import type { CanvasNode } from "../model/academic";
import type {
  AcademicAcquisition,
  AcademicSourceDescriptor,
  SourceResolutionPriority,
} from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";

export type SourceResolutionState =
  | { status: "idle" | "loading" | "resolved" }
  | { status: "unavailable"; message: string };

export type SourceResolutionStateUpdate =
  | { nodeId: string; status: "idle" | "loading" | "resolved" }
  | { nodeId: string; status: "unavailable"; message: string };

export interface SourceResolutionRequest {
  nodeId: string;
  source: AcademicSourceDescriptor;
}

export function sourceDescriptor(
  node: CanvasNode,
): AcademicSourceDescriptor | undefined {
  if (node.kind === "literature")
    return { kind: "literature", source: node.source };
  if (node.kind === "quote") return { kind: "quote", source: node.source };
  if (node.kind === "note" && node.source) {
    return { kind: "note", source: node.source };
  }
  return undefined;
}

export function sourceCacheKey(descriptor: AcademicSourceDescriptor): string {
  const library =
    descriptor.source.library.type === "user"
      ? "user"
      : `group:${descriptor.source.library.groupID}`;
  if (descriptor.kind === "literature") {
    return `literature:${library}:${descriptor.source.itemKey}`;
  }
  if (descriptor.kind === "note") {
    return `note:${library}:${descriptor.source.itemKey ?? ""}:${descriptor.source.noteKey}`;
  }
  return `quote:${library}:${descriptor.source.itemKey}:${descriptor.source.attachmentKey}:${descriptor.source.annotationKey}`;
}

export function applyResolvedAcquisition(
  node: CanvasFlowNode,
  acquisition: AcademicAcquisition,
): CanvasFlowNode {
  const descriptor = sourceDescriptor(node.data.model);
  const acquiredDescriptor = descriptorForAcquisition(acquisition);
  if (
    !descriptor ||
    descriptor.kind !== acquisition.kind ||
    sourceCacheKey(descriptor) !== sourceCacheKey(acquiredDescriptor)
  ) {
    return node;
  }

  const model = node.data.model;
  let resolved: CanvasNode;
  if (model.kind === "literature" && acquisition.kind === "literature") {
    resolved = { ...model, snapshot: acquisition.snapshot };
  } else if (model.kind === "quote" && acquisition.kind === "quote") {
    resolved = { ...model, snapshot: acquisition.snapshot };
  } else if (model.kind === "note" && acquisition.kind === "note") {
    const { sourceSnapshot: _previousSourceSnapshot, ...withoutTitle } = model;
    resolved = acquisition.sourceSnapshot
      ? { ...withoutTitle, sourceSnapshot: acquisition.sourceSnapshot }
      : withoutTitle;
  } else {
    return node;
  }
  return { ...node, data: { ...node.data, model: resolved } };
}

export function createSourceResolutionStates(
  nodes: readonly CanvasNode[],
): Map<string, SourceResolutionState> {
  return new Map(
    nodes.flatMap((node) =>
      sourceDescriptor(node) ? ([[node.id, { status: "idle" }]] as const) : [],
    ),
  );
}

export function updateSourceResolutionStates(
  current: ReadonlyMap<string, SourceResolutionState>,
  updates: readonly SourceResolutionStateUpdate[],
): Map<string, SourceResolutionState> {
  const next = new Map(current);
  for (const { nodeId, ...state } of updates) {
    next.set(nodeId, state);
  }
  return next;
}

export function visibleSourceNodeIds(
  nodes: readonly CanvasFlowNode[],
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number },
): string[] {
  const zoom =
    Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
  const bounds = {
    left: -viewport.x / zoom,
    top: -viewport.y / zoom,
    right: (size.width - viewport.x) / zoom,
    bottom: (size.height - viewport.y) / zoom,
  };
  return nodes.flatMap((node) => {
    if (!sourceDescriptor(node.data.model)) return [];
    const width = node.measured?.width ?? node.width ?? node.data.model.width;
    const height =
      node.measured?.height ?? node.height ?? node.data.model.height;
    const visible =
      node.position.x + width >= bounds.left &&
      node.position.x <= bounds.right &&
      node.position.y + height >= bounds.top &&
      node.position.y <= bounds.bottom;
    return visible ? [node.id] : [];
  });
}

export function prioritizedSourceRequests(
  nodes: readonly CanvasFlowNode[],
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number },
): Record<SourceResolutionPriority, SourceResolutionRequest[]> {
  const visible = new Set(visibleSourceNodeIds(nodes, viewport, size));
  const requests: Record<SourceResolutionPriority, SourceResolutionRequest[]> =
    {
      selected: [],
      visible: [],
      idle: [],
    };
  for (const node of nodes) {
    const source = sourceDescriptor(node.data.model);
    if (!source) continue;
    const priority: SourceResolutionPriority = node.selected
      ? "selected"
      : visible.has(node.id)
        ? "visible"
        : "idle";
    requests[priority].push({ nodeId: node.id, source });
  }
  return requests;
}

function descriptorForAcquisition(
  acquisition: AcademicAcquisition,
): AcademicSourceDescriptor {
  return {
    kind: acquisition.kind,
    source: acquisition.source,
  } as AcademicSourceDescriptor;
}
