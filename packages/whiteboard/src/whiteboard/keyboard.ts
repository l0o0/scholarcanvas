import { toolShortcut } from "../chrome/draw";
import type { CanvasTool } from "../chrome/tools";

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

export function isEditableTarget(target: EventTarget | null): boolean {
  const candidate = target as EditableEventTarget | null;
  if (!candidate) return false;
  if (candidate.isContentEditable === true) return true;
  if (typeof candidate.tagName !== "string") return false;
  return ["INPUT", "SELECT", "TEXTAREA"].includes(
    candidate.tagName.toUpperCase(),
  );
}

export interface GlobalCanvasKeyboardEvent extends CanvasArrowKeyEvent {
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}

export interface GlobalCanvasKeyboardState {
  annotationBrowserOpen: boolean;
  editing: boolean;
  drawing: boolean;
  selectedNodeIds: readonly string[];
  selectedEdgeIds: readonly string[];
}

export interface GlobalCanvasKeyboardActions {
  endFrameDrag(): void;
  cancelDraw(): void;
  dismissTransientUi(): void;
  setActiveTool(tool: CanvasTool): void;
  deleteSelection(nodeIds: string[], edgeIds: string[]): void;
  nudgeSelected(key: string, shift: boolean): boolean;
}

export function handleGlobalCanvasKeyDown(
  event: GlobalCanvasKeyboardEvent,
  state: GlobalCanvasKeyboardState,
  actions: GlobalCanvasKeyboardActions,
): boolean {
  if (
    state.annotationBrowserOpen ||
    state.editing ||
    isEditableTarget(event.target)
  ) {
    return false;
  }

  if (event.key === "Escape") {
    actions.endFrameDrag();
    if (state.drawing) {
      event.preventDefault();
      actions.cancelDraw();
      return true;
    }
    actions.dismissTransientUi();
    actions.setActiveTool("select");
    return true;
  }

  if (!event.metaKey && !event.ctrlKey && !event.altKey) {
    const next = toolShortcut(event.key);
    if (next) {
      event.preventDefault();
      actions.setActiveTool(next);
      return true;
    }
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    if (!state.selectedNodeIds.length && !state.selectedEdgeIds.length) {
      return false;
    }
    event.preventDefault();
    actions.deleteSelection(
      [...state.selectedNodeIds],
      [...state.selectedEdgeIds],
    );
    return true;
  }

  return captureCanvasArrowKey(event, false, actions.nudgeSelected);
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
