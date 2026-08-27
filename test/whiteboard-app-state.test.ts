import assert from "node:assert/strict";
import test from "node:test";
import {
  BoardDocumentHistory,
  boardDocumentToFlow,
  flowToBoardDocument,
  labelTextStyle,
  mergeEditingStyle,
  verticalAlignmentStyle,
  withEdgeColor,
} from "../packages/whiteboard/src/whiteboard/document.ts";
import {
  armEditFocusHold,
  consumeEditFocusHold,
  handleEditBlur,
} from "../packages/whiteboard/src/whiteboard/editFocus.ts";
import { parseBoardDocument } from "../packages/whiteboard/src/model/snapshot.ts";

const EMPTY = {
  v: 1 as const,
  engine: "xyflow" as const,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

test("edge arrow state survives parse, flow, snapshot, and history round trips", () => {
  const parsed = parseBoardDocument({
    ...EMPTY,
    edges: [
      { id: "legacy", source: "a", target: "b", color: "#2563eb" },
      {
        id: "plain",
        source: "a",
        target: "b",
        color: "#dc2626",
        arrow: false,
      },
    ],
  });
  const flow = boardDocumentToFlow(parsed);
  assert.deepEqual(flow.edges[0].markerEnd, {
    type: "arrowclosed",
    width: 16,
    height: 16,
    color: "#2563eb",
  });
  assert.equal(flow.edges[1].markerEnd, undefined);

  const snapshot = flowToBoardDocument(flow.nodes, flow.edges, {
    x: 4,
    y: 5,
    zoom: 1.25,
  });
  assert.equal(snapshot.edges[0].arrow, true);
  assert.equal(snapshot.edges[1].arrow, false);

  const changes: number[] = [];
  const history = new BoardDocumentHistory((rev) => changes.push(rev));
  history.push(EMPTY);
  history.changed();
  const previous = history.undo(snapshot);
  assert.deepEqual(previous, EMPTY);
  const redone = history.redo(EMPTY);
  assert.equal(redone?.edges[1].arrow, false);
  assert.deepEqual(changes, [1, 2, 3]);
});

test("style transition commits the current edit value in one node update", () => {
  const node = {
    id: "rect-1",
    type: "rect" as const,
    position: { x: 10, y: 20 },
    data: { kind: "rect" as const, title: "Old", fontSize: 16 },
  };
  const next = mergeEditingStyle(node, "Typed title", {
    fontSize: 24,
  });
  assert.equal(next.data.title, "Typed title");
  assert.equal(next.data.fontSize, 24);
  assert.equal(node.data.title, "Old");
});

test("a prevented style-bar blur cannot suppress the next real edit commit", () => {
  const focusHold = { current: false };
  let release = () => {};
  let editingValue = "First edit";
  let savedValue = "";

  armEditFocusHold(focusHold, (callback) => {
    release = callback;
  });
  assert.equal(focusHold.current, true);

  editingValue = "Second edit";
  release();
  handleEditBlur(focusHold, () => {
    savedValue = editingValue;
  });

  assert.equal(savedValue, "Second edit");
});

test("an immediate style-control blur consumes the focus hold once", () => {
  const focusHold = { current: false };
  armEditFocusHold(focusHold, () => {});

  assert.equal(consumeEditFocusHold(focusHold), true);
  assert.equal(consumeEditFocusHold(focusHold), false);
});

test("an older release cannot clear a newer focus hold", () => {
  const focusHold = { current: false };
  const releases: Array<() => void> = [];
  const schedule = (callback: () => void) => {
    releases.push(callback);
  };

  armEditFocusHold(focusHold, schedule);
  armEditFocusHold(focusHold, schedule);
  releases[0]();

  assert.equal(consumeEditFocusHold(focusHold), true);
});

test("edge color changes recolor existing arrows without recreating disabled ones", () => {
  const disabled = withEdgeColor(
    { id: "plain", source: "a", target: "b", markerEnd: undefined },
    "#059669",
  );
  assert.equal(disabled.markerEnd, undefined);
  assert.equal(disabled.style?.stroke, "#059669");

  const arrowed = withEdgeColor(
    {
      id: "arrowed",
      source: "a",
      target: "b",
      markerEnd: { type: "arrowclosed", color: "#111111" },
    },
    "#059669",
  );
  assert.deepEqual(arrowed.markerEnd, {
    type: "arrowclosed",
    width: 16,
    height: 16,
    color: "#059669",
  });
});

test("host replacement is silent and clears both history directions", () => {
  const changes: number[] = [];
  const history = new BoardDocumentHistory((rev) => changes.push(rev));
  history.push(EMPTY);
  history.changed();
  history.undo({ ...EMPTY, viewport: { x: 10, y: 20, zoom: 2 } });
  assert.equal(history.revision, 2);

  history.replace();
  assert.equal(history.revision, 2);
  assert.deepEqual(changes, [1, 2]);
  assert.equal(history.undo(EMPTY), undefined);
  assert.equal(history.redo(EMPTY), undefined);

  history.push(EMPTY);
  history.changed();
  assert.deepEqual(changes, [1, 2, 3]);
});

test("shape and editor layout map every vertical alignment with middle default", () => {
  assert.deepEqual(verticalAlignmentStyle({ verticalAlign: "top" }), {
    alignItems: "flex-start",
  });
  assert.deepEqual(verticalAlignmentStyle({ verticalAlign: "middle" }), {
    alignItems: "center",
  });
  assert.deepEqual(verticalAlignmentStyle({ verticalAlign: "bottom" }), {
    alignItems: "flex-end",
  });
  assert.deepEqual(verticalAlignmentStyle({ kind: "rect", title: "" }), {
    alignItems: "center",
  });
  assert.equal(labelTextStyle({ kind: "rect", title: "" }).lineHeight, 1.25);
});
