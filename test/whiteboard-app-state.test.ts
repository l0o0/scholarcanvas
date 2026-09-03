import assert from "node:assert/strict";
import test from "node:test";
import { MarkerType } from "@xyflow/react";
import {
  parseCanvasDocument,
  type CanvasDocument,
} from "../packages/whiteboard/src/model/document.ts";
import {
  CanvasDocumentHistory,
  canvasDocumentToFlow,
  flowNodeText,
  flowToCanvasDocument,
  labelTextStyle,
  mergeEditingStyle,
  mergePickerData,
  parsePickerNodeData,
  updateFlowNodeModel,
  verticalAlignmentStyle,
  withEdgeColor,
} from "../packages/whiteboard/src/whiteboard/document.ts";
import {
  armEditFocusHold,
  consumeEditFocusHold,
  handleEditBlur,
} from "../packages/whiteboard/src/whiteboard/editFocus.ts";

const EMPTY: CanvasDocument = {
  version: 2,
  nodes: [],
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

function academicDocument(): CanvasDocument {
  return {
    version: 2,
    nodes: [
      {
        id: "literature-1",
        kind: "literature",
        position: { x: 24, y: 36 },
        width: 280,
        height: 136,
        source: { library: { type: "user" }, itemKey: "ITEM1234" },
        snapshot: { title: "A paper", creators: "Smith", year: "2026" },
      },
      {
        id: "claim-1",
        kind: "claim",
        position: { x: 360, y: 52 },
        width: 260,
        height: 128,
        content: "The result generalizes",
      },
    ],
    connections: [
      {
        id: "supports-1",
        kind: "academic",
        source: "literature-1",
        target: "claim-1",
        relation: "supports",
        color: "#2563eb",
      },
    ],
  };
}

test("canonical documents adapt to React Flow and back", () => {
  const document = academicDocument();
  const flow = canvasDocumentToFlow(document);

  assert.equal(flow.nodes[0].data.model.kind, "literature");
  assert.equal(flow.nodes[0].position.x, document.nodes[0].position.x);
  assert.equal(flow.edges[0].data?.connection.kind, "academic");

  const resized = flow.nodes.map((node, index) =>
    index === 0
      ? {
          ...node,
          position: { x: 40, y: 60 },
          measured: { width: 300, height: 150 },
        }
      : node,
  );
  const restored = flowToCanvasDocument(resized, flow.edges, {
    x: 12,
    y: -8,
    zoom: 1.25,
  });

  assert.equal(restored.version, 2);
  assert.equal(restored.nodes[0].kind, "literature");
  assert.deepEqual(restored.nodes[0].position, { x: 40, y: 60 });
  assert.equal(restored.nodes[0].width, 300);
  assert.equal(restored.nodes[0].height, 150);
  assert.equal(restored.connections[0].kind, "academic");
  assert.equal(
    restored.connections[0].kind === "academic" &&
      restored.connections[0].relation,
    "supports",
  );
  assert.equal(restored.viewport?.zoom, 1.25);
});

test("document shell survives editing, history, and host replacement", () => {
  const loaded: CanvasDocument = {
    ...academicDocument(),
    metadata: {
      title: "Review",
      createdAt: "2026-09-03T00:00:00.000Z",
    },
    extensions: {
      plugin: { mode: "evidence", flags: ["a", "b"] },
    },
  };
  const flow = canvasDocumentToFlow(loaded);
  const editedNodes = flow.nodes.map((node) =>
    node.id === "claim-1"
      ? mergeEditingStyle(node, "Revised claim", { fontWeight: "bold" })
      : node,
  );
  const edited = flowToCanvasDocument(
    editedNodes,
    flow.edges,
    { x: 8, y: 12, zoom: 1.1 },
    flow.shell,
  );

  assert.deepEqual(edited.metadata, loaded.metadata);
  assert.deepEqual(edited.extensions, loaded.extensions);

  const replacement: CanvasDocument = {
    ...EMPTY,
    metadata: { title: "Replacement" },
    extensions: { host: { sequence: 2 } },
  };
  const replacementFlow = canvasDocumentToFlow(replacement);
  const replacementSnapshot = flowToCanvasDocument(
    replacementFlow.nodes,
    replacementFlow.edges,
    replacement.viewport!,
    replacementFlow.shell,
  );
  assert.deepEqual(replacementSnapshot.metadata, replacement.metadata);
  assert.deepEqual(replacementSnapshot.extensions, replacement.extensions);

  const history = new CanvasDocumentHistory(() => {});
  history.push(edited);
  const previous = history.undo(replacementSnapshot);
  assert.deepEqual(previous?.metadata, loaded.metadata);
  assert.deepEqual(previous?.extensions, loaded.extensions);
  const next = history.redo(edited);
  assert.deepEqual(next?.metadata, replacement.metadata);
  assert.deepEqual(next?.extensions, replacement.extensions);

  history.replace();
  assert.equal(history.undo(replacementSnapshot), undefined);
  assert.equal(history.redo(replacementSnapshot), undefined);
});

test("edge arrow state survives flow, snapshot, and history round trips", () => {
  const document: CanvasDocument = {
    version: 2,
    nodes: [
      {
        id: "a",
        kind: "rect",
        position: { x: 0, y: 0 },
        width: 100,
        height: 80,
        data: { title: "A" },
      },
      {
        id: "b",
        kind: "rect",
        position: { x: 200, y: 0 },
        width: 100,
        height: 80,
        data: { title: "B" },
      },
    ],
    connections: [
      {
        id: "legacy",
        kind: "basic",
        source: "a",
        target: "b",
        color: "#2563eb",
      },
      {
        id: "plain",
        kind: "basic",
        source: "a",
        target: "b",
        color: "#dc2626",
        arrow: false,
      },
    ],
  };
  const flow = canvasDocumentToFlow(document);
  assert.deepEqual(flow.edges[0].markerEnd, {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: "#2563eb",
  });
  assert.equal(flow.edges[1].markerEnd, undefined);

  const snapshot = flowToCanvasDocument(flow.nodes, flow.edges, {
    x: 4,
    y: 5,
    zoom: 1.25,
  });
  assert.equal(snapshot.connections[0].arrow, true);
  assert.equal(snapshot.connections[1].arrow, false);

  const changes: number[] = [];
  const history = new CanvasDocumentHistory((rev) => changes.push(rev));
  history.push(EMPTY);
  history.changed();
  const previous = history.undo(snapshot);
  assert.deepEqual(previous, EMPTY);
  const redone = history.redo(EMPTY);
  assert.equal(redone?.connections[1].arrow, false);
  assert.deepEqual(changes, [1, 2, 3]);
});

test("style transition commits Academic content and style in one node update", () => {
  const [node] = canvasDocumentToFlow({
    version: 2,
    nodes: [
      {
        id: "claim-1",
        kind: "claim",
        position: { x: 10, y: 20 },
        width: 260,
        height: 128,
        content: "Old",
        style: { fontSize: 16 },
      },
    ],
    connections: [],
  }).nodes;

  const next = mergeEditingStyle(node, "Typed claim", { fontSize: 24 });
  assert.equal(next.data.model.kind, "claim");
  assert.equal(
    next.data.model.kind === "claim" && next.data.model.content,
    "Typed claim",
  );
  assert.equal(next.data.model.style?.fontSize, 24);
  assert.equal(flowNodeText(next), "Typed claim");
  assert.equal(flowNodeText(node), "Old");
});

test("flow model updates are immutable and keep the renderer kind synchronized", () => {
  const [node] = canvasDocumentToFlow(academicDocument()).nodes;
  const next = updateFlowNodeModel(node, (model) => ({
    id: model.id,
    kind: "frame",
    position: model.position,
    width: 480,
    height: 320,
    title: "Review",
  }));

  assert.equal(next.type, "frame");
  assert.equal(next.data.model.kind, "frame");
  assert.equal(node.data.model.kind, "literature");
});

test("picker payloads select and populate each typed canonical node kind", () => {
  const cases = [
    {
      payload: {
        kind: "item",
        title: "Paper",
        subtitle: "Author · 2026",
        preview: "Abstract",
        itemID: 41,
        unexpected: "drop me",
      },
      assertModel(model: ReturnType<typeof mergePickerData>) {
        assert.equal(model.kind, "item");
        assert.equal(model.kind === "item" && model.data.itemID, 41);
        assert.equal(model.kind === "item" && model.data.preview, "Abstract");
      },
    },
    {
      payload: {
        kind: "pdf",
        title: "Paper.pdf",
        subtitle: "p. 8",
        attachmentID: 42,
        pdfPage: 8,
        image: "data:image/png;base64,abc",
        asset: "assets/page.png",
        unexpected: "drop me",
      },
      assertModel(model: ReturnType<typeof mergePickerData>) {
        assert.equal(model.kind, "pdf");
        assert.equal(model.kind === "pdf" && model.data.attachmentID, 42);
        assert.equal(model.kind === "pdf" && model.data.pdfPage, 8);
        assert.equal(
          model.kind === "pdf" && model.data.asset,
          "assets/page.png",
        );
      },
    },
    {
      payload: {
        kind: "attachment",
        title: "Dataset.csv",
        subtitle: "12 KB",
        attachmentID: 43,
        unexpected: "drop me",
      },
      assertModel(model: ReturnType<typeof mergePickerData>) {
        assert.equal(model.kind, "attachment");
        assert.equal(
          model.kind === "attachment" && model.data.attachmentID,
          43,
        );
      },
    },
    {
      payload: {
        kind: "note",
        title: "Reading note",
        preview: "Evidence summary",
        noteID: 44,
        unexpected: "drop me",
      },
      assertModel(model: ReturnType<typeof mergePickerData>) {
        assert.equal(model.kind, "note");
        assert.equal(
          model.kind === "note" && model.content,
          "Evidence summary",
        );
        assert.equal("data" in model, false);
      },
    },
  ] as const;

  for (const entry of cases) {
    const parsed = parsePickerNodeData(entry.payload);
    assert.ok(parsed);
    assert.equal("unexpected" in parsed, false);
    if (parsed.kind === "note") assert.equal(parsed.noteID, 44);

    const placeholder = canvasDocumentToFlow({
      version: 2,
      nodes: [
        {
          id: "drop-1",
          kind: "item",
          position: { x: 10, y: 20 },
          width: 240,
          height: 96,
          style: { fill: "#ffffff" },
          extensions: { retained: true },
          data: { title: "Pending" },
        },
      ],
      connections: [],
    }).nodes[0];
    const next = updateFlowNodeModel(placeholder, (model) =>
      mergePickerData(model, parsed),
    );

    assert.equal(next.type, entry.payload.kind);
    assert.equal(next.data.model.kind, entry.payload.kind);
    assert.deepEqual(next.data.model.position, { x: 10, y: 20 });
    assert.deepEqual(next.data.model.style, { fill: "#ffffff" });
    assert.deepEqual(next.data.model.extensions, { retained: true });
    entry.assertModel(next.data.model);

    const restored = flowToCanvasDocument([next], [], {
      x: 0,
      y: 0,
      zoom: 1,
    });
    assert.equal(restored.nodes[0].kind, entry.payload.kind);
    entry.assertModel(parseCanvasDocument(restored).document.nodes[0]);
  }
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

test("edge color changes update the typed connection and existing arrow", () => {
  const disabled = withEdgeColor(
    {
      id: "plain",
      source: "a",
      target: "b",
      markerEnd: undefined,
      data: {
        connection: {
          id: "plain",
          kind: "basic",
          source: "a",
          target: "b",
          arrow: false,
        },
      },
    },
    "#059669",
  );
  assert.equal(disabled.markerEnd, undefined);
  assert.equal(disabled.style?.stroke, "#059669");
  assert.equal(disabled.data?.connection.color, "#059669");

  const arrowed = withEdgeColor(
    {
      id: "arrowed",
      source: "a",
      target: "b",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#111111" },
      data: {
        connection: {
          id: "arrowed",
          kind: "academic",
          source: "a",
          target: "b",
          relation: "supports",
        },
      },
    },
    "#059669",
  );
  assert.deepEqual(arrowed.markerEnd, {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: "#059669",
  });
  assert.equal(arrowed.data?.connection.color, "#059669");
});

test("host replacement is silent and clears both history directions", () => {
  const changes: number[] = [];
  const history = new CanvasDocumentHistory((rev) => changes.push(rev));
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
  assert.deepEqual(verticalAlignmentStyle({}), {
    alignItems: "center",
  });
  assert.equal(labelTextStyle({}).lineHeight, 1.25);
});
