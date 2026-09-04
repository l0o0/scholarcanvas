import type { CanvasDocument } from "../model/document";
import type { AcademicAcquisition, WhiteboardLabels } from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";
import { sourceCacheKey, sourceDescriptor } from "./sourceState";

type NoteAcquisition = Extract<AcademicAcquisition, { kind: "note" }>;
type NoteRefreshLabels = Pick<
  WhiteboardLabels,
  "noteOverwriteTitle" | "noteOverwriteBody"
>;

export function requestConfirmedNoteRefresh(
  node: CanvasFlowNode,
  labels: NoteRefreshLabels,
  confirm: (warning: string) => boolean,
  request: (
    requestId: string,
    nodeId: string,
    source: NoteAcquisition["source"],
  ) => void,
  createRequestId: () => string,
): string | undefined {
  const model = node.data.model;
  if (model.kind !== "note" || !model.source) return undefined;
  const warning = `${labels.noteOverwriteTitle}\n\n${labels.noteOverwriteBody}`;
  if (!confirm(warning)) return undefined;
  const requestId = createRequestId();
  request(requestId, node.id, model.source);
  return requestId;
}

export function applyConfirmedNoteRefresh(
  document: CanvasDocument,
  nodeId: string,
  acquisition: NoteAcquisition,
): CanvasDocument | undefined {
  const index = document.nodes.findIndex((node) => node.id === nodeId);
  const model = document.nodes[index];
  if (index < 0 || model.kind !== "note" || !model.source) return undefined;
  const currentDescriptor = sourceDescriptor(model);
  const refreshedDescriptor = {
    kind: "note" as const,
    source: acquisition.source,
  };
  if (
    !currentDescriptor ||
    sourceCacheKey(currentDescriptor) !== sourceCacheKey(refreshedDescriptor)
  ) {
    return undefined;
  }

  const { sourceSnapshot: _previousSourceSnapshot, ...withoutTitle } = model;
  const refreshed = acquisition.sourceSnapshot
    ? {
        ...withoutTitle,
        content: acquisition.content,
        sourceSnapshot: acquisition.sourceSnapshot,
      }
    : { ...withoutTitle, content: acquisition.content };
  const nodes = document.nodes.slice();
  nodes[index] = refreshed;
  return { ...document, nodes };
}
