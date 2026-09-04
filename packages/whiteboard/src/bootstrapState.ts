import type {
  AcademicAcquisition,
  ParentToWhiteboardMessage,
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
