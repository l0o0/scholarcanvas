import type {
  AcademicAcquisition,
  AcademicAcquisitionFailure,
  AcademicSourceActionFailure,
  AnnotationCandidate,
  AnnotationListFailure,
  ParentToWhiteboardMessage,
  IndexedAcademicAcquisition,
  SourceResolutionResult,
  WhiteboardLabels,
} from "./model/protocol";
import type { LiteratureSource } from "./model/academic";

interface LabelsTarget {
  setLabels: (labels: WhiteboardLabels) => void;
}

interface AcademicMessageTarget {
  resolveAcademicAcquisition: (
    requestId: string,
    nodeId: string,
    acquisition: AcademicAcquisition,
  ) => void;
  resolveAcademicAcquisitionBatch: (
    requestId: string,
    nodeId: string,
    successes: IndexedAcademicAcquisition[],
    failures: AcademicAcquisitionFailure[],
    summary: string,
  ) => void;
  rejectAcademicRequest: (
    requestId: string,
    nodeId: string,
    message: string,
  ) => void;
  rejectSourceAction: (
    requestId: string,
    nodeId: string,
    failure: AcademicSourceActionFailure,
  ) => void;
  applySourceResolutionBatch: (
    generation: number,
    results: SourceResolutionResult[],
  ) => void;
  applyNoteRefresh: (
    requestId: string,
    nodeId: string,
    acquisition: Extract<AcademicAcquisition, { kind: "note" }>,
  ) => void;
  applyAnnotationCandidates: (
    requestId: string,
    source: LiteratureSource,
    candidates: AnnotationCandidate[],
    failures: AnnotationListFailure[],
  ) => void;
  rejectAnnotationList: (
    requestId: string,
    source: LiteratureSource,
    failure: AnnotationListFailure,
  ) => void;
}

export function forwardAcademicParentMessage(
  target: AcademicMessageTarget | null,
  data: ParentToWhiteboardMessage,
): boolean {
  if (data.type === "academicSourceAcquired") {
    target?.resolveAcademicAcquisition(
      data.payload.requestId,
      data.payload.nodeId,
      data.payload.acquisition,
    );
    return true;
  }
  if (data.type === "academicSourcesAcquired") {
    target?.resolveAcademicAcquisitionBatch(
      data.payload.requestId,
      data.payload.nodeId,
      data.payload.successes,
      data.payload.failures,
      data.payload.summary,
    );
    return true;
  }
  if (data.type === "academicRequestFailed") {
    target?.rejectAcademicRequest(
      data.payload.requestId,
      data.payload.nodeId,
      data.payload.message,
    );
    return true;
  }
  if (data.type === "sourceActionFailed") {
    target?.rejectSourceAction(
      data.payload.requestId,
      data.payload.nodeId,
      data.payload.failure,
    );
    return true;
  }
  if (data.type === "sourceResolutionBatch") {
    target?.applySourceResolutionBatch(
      data.payload.generation,
      data.payload.results,
    );
    return true;
  }
  if (data.type === "noteRefreshed") {
    target?.applyNoteRefresh(
      data.payload.requestId,
      data.payload.nodeId,
      data.payload.acquisition,
    );
    return true;
  }
  if (data.type === "annotationsListed") {
    target?.applyAnnotationCandidates(
      data.payload.requestId,
      data.payload.source,
      data.payload.candidates,
      data.payload.failures,
    );
    return true;
  }
  if (data.type === "annotationListFailed") {
    target?.rejectAnnotationList(
      data.payload.requestId,
      data.payload.source,
      data.payload.failure,
    );
    return true;
  }
  return false;
}

export function createDeferredLabels() {
  let current: WhiteboardLabels | undefined;
  let target: LabelsTarget | null = null;
  return {
    get current() {
      return current;
    },
    receive(next: WhiteboardLabels | undefined) {
      current = next;
      if (next) target?.setLabels(next);
    },
    attach(next: LabelsTarget) {
      target = next;
      if (current) next.setLabels(current);
    },
    detach() {
      target = null;
    },
  };
}
