import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import {
  handleGlobalCanvasKeyDown,
  type GlobalCanvasKeyboardActions,
} from "../packages/whiteboard/src/whiteboard/keyboard.ts";

test("canvas keyboard owns undo and preserves native editing shortcuts", () => {
  const window = new Window();
  const calls: string[] = [];
  const actions: GlobalCanvasKeyboardActions = {
    endFrameDrag() {},
    cancelDraw() {},
    dismissTransientUi() {},
    setActiveTool() {},
    deleteSelection: () => calls.push("delete"),
    nudgeSelected: () => {
      calls.push("nudge");
      return true;
    },
    undo: () => calls.push("undo"),
    redo: () => calls.push("redo"),
    fitView: () => calls.push("all"),
    fitSelection: () => calls.push("selection"),
  };
  const state = {
    annotationBrowserOpen: false,
    editing: false,
    drawing: false,
    selectedNodeIds: ["note"],
    selectedEdgeIds: [],
  };
  window.addEventListener("keydown", (event) =>
    handleGlobalCanvasKeyDown(event, state, actions),
  );
  const dispatch = (
    target: typeof window.document.body,
    init: Record<string, unknown>,
  ) => {
    const event = new window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    assert.equal(
      dispatch(window.document.body, { key: "z", ctrlKey: true }),
      true,
    );
    assert.deepEqual(calls, ["undo"]);
    dispatch(window.document.body, { key: "z", metaKey: true, shiftKey: true });
    assert.deepEqual(calls, ["undo", "redo"]);

    for (const tag of ["textarea", "input", "select", "div"]) {
      const input = window.document.createElement(tag);
      if (tag === "div") input.contentEditable = "true";
      window.document.body.append(input);
      assert.equal(dispatch(input, { key: "z", ctrlKey: true }), false, tag);
      assert.equal(dispatch(input, { key: "y", ctrlKey: true }), false, tag);
      assert.equal(
        dispatch(input, { key: "@", code: "Digit2", shiftKey: true }),
        false,
        tag,
      );
    }
    for (const role of ["menu", "dialog"]) {
      const surface = window.document.createElement("div");
      surface.setAttribute("role", role);
      const button = window.document.createElement("button");
      surface.append(button);
      window.document.body.append(surface);
      assert.equal(dispatch(button, { key: "ArrowDown" }), false);
      assert.equal(dispatch(button, { key: "z", ctrlKey: true }), false);
    }
    for (const className of [
      "zmd-board-properties",
      "zmd-board-style-bar is-edge",
    ]) {
      const properties = window.document.createElement("aside");
      properties.className = className;
      const action = window.document.createElement("button");
      properties.append(action);
      window.document.body.append(properties);
      for (const key of ["Delete", "Backspace", "ArrowRight"]) {
        assert.equal(dispatch(action, { key }), false);
      }
    }
    assert.deepEqual(calls, ["undo", "redo"]);
    assert.equal(
      dispatch(window.document.body, {
        key: "z",
        ctrlKey: true,
        isComposing: true,
      }),
      false,
    );
    assert.equal(
      dispatch(window.document.body, { key: "z", ctrlKey: true, altKey: true }),
      false,
    );
    assert.equal(
      dispatch(window.document.body, {
        key: "!",
        code: "Digit1",
        shiftKey: true,
      }),
      true,
    );
    assert.equal(
      dispatch(window.document.body, {
        key: "@",
        code: "Digit2",
        shiftKey: true,
      }),
      true,
    );
    assert.deepEqual(calls, ["undo", "redo", "all", "selection"]);
  } finally {
    window.close();
  }
});

test("navigation leaves modal, editing, and already handled keyboard actions intact", () => {
  const calls: string[] = [];
  const actions: GlobalCanvasKeyboardActions = {
    endFrameDrag() {},
    cancelDraw() {},
    dismissTransientUi() {},
    setActiveTool() {},
    deleteSelection() {},
    nudgeSelected: () => false,
    fitSelection: () => calls.push("selection"),
    undo: () => calls.push("undo"),
  };
  const event = {
    key: "@",
    code: "Digit2",
    shiftKey: true,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    preventDefault() {},
    stopPropagation() {},
  };
  const state = {
    annotationBrowserOpen: false,
    editing: false,
    drawing: false,
    selectedNodeIds: ["note"],
    selectedEdgeIds: [],
  };
  assert.equal(
    handleGlobalCanvasKeyDown(
      event,
      { ...state, annotationBrowserOpen: true },
      actions,
    ),
    false,
  );
  assert.equal(
    handleGlobalCanvasKeyDown(event, { ...state, editing: true }, actions),
    false,
  );
  assert.equal(
    handleGlobalCanvasKeyDown(
      { ...event, defaultPrevented: true },
      state,
      actions,
    ),
    false,
  );
  assert.equal(
    handleGlobalCanvasKeyDown(event, { ...state, drawing: true }, actions),
    false,
  );
  const undoEvent = { ...event, key: "z", shiftKey: false, ctrlKey: true };
  assert.equal(
    handleGlobalCanvasKeyDown(undoEvent, { ...state, drawing: true }, actions),
    false,
  );
  assert.equal(
    handleGlobalCanvasKeyDown(
      undoEvent,
      { ...state, annotationBrowserOpen: true },
      actions,
    ),
    false,
  );
  assert.deepEqual(calls, []);
});
