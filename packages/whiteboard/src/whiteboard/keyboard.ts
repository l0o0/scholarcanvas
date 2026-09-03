export interface CanvasArrowKeyEvent {
  readonly key: string;
  readonly shiftKey: boolean;
  readonly target: EventTarget | null;
  preventDefault(): void;
  stopPropagation(): void;
}

type EditableEventTarget = EventTarget & {
  readonly tagName?: unknown;
  readonly isContentEditable?: unknown;
};

function isEditableTarget(target: EventTarget | null): boolean {
  const candidate = target as EditableEventTarget | null;
  if (!candidate) return false;
  if (candidate.isContentEditable === true) return true;
  if (typeof candidate.tagName !== "string") return false;
  return ["INPUT", "SELECT", "TEXTAREA"].includes(
    candidate.tagName.toUpperCase(),
  );
}

export function captureCanvasArrowKey(
  event: CanvasArrowKeyEvent,
  editing: boolean,
  nudge: (key: string, shift: boolean) => boolean,
): boolean {
  if (
    editing ||
    isEditableTarget(event.target) ||
    !event.key.startsWith("Arrow") ||
    !nudge(event.key, event.shiftKey)
  ) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  return true;
}
