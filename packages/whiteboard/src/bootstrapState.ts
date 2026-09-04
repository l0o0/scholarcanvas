import type {
  AcademicAcquisition,
  ParentToWhiteboardMessage,
  SourceResolutionResult,
  WhiteboardLabels,
} from "./model/protocol";

interface LabelsTarget {
  setLabels: (labels: WhiteboardLabels) => void;
}

interface AcademicMessageTarget {
  resolveAcademicAcquisition: (
    requestId: string,
    nodeId: string,
    acquisition: AcademicAcquisition,
  ) => void;
  rejectAcademicRequest: (
    requestId: string,
    nodeId: string,
    message: string,
  ) => void;
  applySourceResolutionBatch: (
    generation: number,
    results: SourceResolutionResult[],
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
  if (data.type === "academicRequestFailed") {
    target?.rejectAcademicRequest(
      data.payload.requestId,
      data.payload.nodeId,
      data.payload.message,
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
