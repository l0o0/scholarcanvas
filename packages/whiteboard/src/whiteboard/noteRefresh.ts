import type { CanvasDocument } from "../model/document";
import type { AcademicAcquisition, WhiteboardLabels } from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";
import { sourceCacheKey, sourceDescriptor } from "./sourceState";

type NoteAcquisition = Extract<AcademicAcquisition, { kind: "note" }>;
type NoteRefreshLabels = Pick<
  WhiteboardLabels,
  "noteOverwriteTitle" | "noteOverwriteBody"
>;
type NoteRefreshRuntimeLabels = NoteRefreshLabels &
  Pick<WhiteboardLabels, "sourceMissing">;

export interface NoteRefreshRuntimeBindings {
  getWorkingDocument: () => CanvasDocument;
  getHistoryDocument: () => CanvasDocument;
  applyDocument: (document: CanvasDocument) => void;
  commitHistory: (document: CanvasDocument) => void;
  confirm: (warning: string) => boolean;
  request: (
    requestId: string,
    nodeId: string,
    source: NoteAcquisition["source"],
  ) => void;
  onError: (message: string, nodeId: string) => void;
  createRequestId: () => string;
}

export interface NoteRefreshRuntime {
  request(
    node: CanvasFlowNode,
    labels: NoteRefreshRuntimeLabels,
  ): string | undefined;
  resolve(
    requestId: string,
    nodeId: string,
    acquisition: NoteAcquisition,
  ): boolean;
  reject(requestId: string, nodeId: string, message: string): boolean;
  clear(): void;
}

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

export function createNoteRefreshRuntime(
  bindings: NoteRefreshRuntimeBindings,
): NoteRefreshRuntime {
  const pending = new Map<
    string,
    { nodeId: string; sourceKey: string; invalidSourceMessage: string }
  >();
  const latestByNode = new Map<string, string>();

  const invalidate = (requestId: string, nodeId: string): void => {
    pending.delete(requestId);
    if (latestByNode.get(nodeId) === requestId) latestByNode.delete(nodeId);
  };

  return {
    request(node, labels) {
      return requestConfirmedNoteRefresh(
        node,
        labels,
        bindings.confirm,
        (requestId, nodeId, source) => {
          const superseded = latestByNode.get(nodeId);
          if (superseded) pending.delete(superseded);
          latestByNode.set(nodeId, requestId);
          pending.set(requestId, {
            nodeId,
            sourceKey: sourceCacheKey({ kind: "note", source }),
            invalidSourceMessage: labels.sourceMissing,
          });
          bindings.request(requestId, nodeId, source);
        },
        bindings.createRequestId,
      );
    },
    resolve(requestId, nodeId, acquisition) {
      const expected = pending.get(requestId);
      if (
        !expected ||
        expected.nodeId !== nodeId ||
        latestByNode.get(nodeId) !== requestId
      ) {
        return false;
      }
      invalidate(requestId, nodeId);
      const acquisitionKey = sourceCacheKey({
        kind: "note",
        source: acquisition.source,
      });
      if (expected.sourceKey !== acquisitionKey) {
        bindings.onError(expected.invalidSourceMessage, expected.nodeId);
        return false;
      }
      const working = bindings.getWorkingDocument();
      const refreshed = applyConfirmedNoteRefresh(working, nodeId, acquisition);
      if (!refreshed) {
        bindings.onError(expected.invalidSourceMessage, expected.nodeId);
        return false;
      }
      bindings.commitHistory(bindings.getHistoryDocument());
      bindings.applyDocument(refreshed);
      return true;
    },
    reject(requestId, nodeId, message) {
      const expected = pending.get(requestId);
      if (
        !expected ||
        expected.nodeId !== nodeId ||
        latestByNode.get(nodeId) !== requestId
      ) {
        return false;
      }
      invalidate(requestId, nodeId);
      bindings.onError(message, expected.nodeId);
      return true;
    },
    clear() {
      pending.clear();
      latestByNode.clear();
    },
  };
}
