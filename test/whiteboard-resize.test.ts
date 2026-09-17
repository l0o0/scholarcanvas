import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCanvasNodeChanges,
  canvasDocumentToFlow,
  flowToCanvasDocument,
} from "../packages/whiteboard/src/whiteboard/document.ts";
import {
  canvasDocumentToFile,
  canvasFileToDocument,
} from "../packages/whiteboard/src/model/canvas-file.ts";
import type { CanvasDocument } from "../packages/whiteboard/src/model/document.ts";

const original: CanvasDocument = {
  version: 2,
  nodes: [
    {
      id: "frame",
      kind: "frame",
      title: "Group",
      position: { x: 100, y: 80 },
      width: 500,
      height: 400,
    },
    {
      id: "note",
      kind: "note",
      content: "Evidence",
      frameId: "frame",
      position: { x: 150, y: 160 },
      width: 240,
      height: 100,
    },
  ],
  connections: [],
};

test("resizing a frame updates its CSS and saved bounds without moving or scaling its members", () => {
  const flow = canvasDocumentToFlow(original);
  const nodes = applyCanvasNodeChanges(
    [
      { id: "frame", type: "position", position: { x: 60, y: 50 } },
      {
        id: "frame",
        type: "dimensions",
        dimensions: { width: 540, height: 430 },
        resizing: true,
        setAttributes: true,
      },
    ],
    flow.nodes,
  );
  assert.deepEqual(nodes[0].style, { width: 540, height: 430 });
  const resized = flowToCanvasDocument(
    nodes,
    flow.edges,
    { x: 0, y: 0, zoom: 1 },
    flow.shell,
  );
  assert.deepEqual(resized.nodes[0], {
    ...original.nodes[0],
    position: { x: 60, y: 50 },
    width: 540,
    height: 430,
  });
  assert.deepEqual(resized.nodes[1], original.nodes[1]);
  const reopened = canvasFileToDocument(canvasDocumentToFile(resized));
  assert.deepEqual(reopened.issues, []);
  assert.deepEqual(reopened.document.nodes, resized.nodes);
  assert.deepEqual(original.nodes[0].position, { x: 100, y: 80 });
});

test("ordinary measurement and selection changes do not overwrite explicit CSS sizes", () => {
  const { nodes } = canvasDocumentToFlow(original);
  const next = applyCanvasNodeChanges(
    [
      { id: "note", type: "select", selected: true },
      {
        id: "note",
        type: "dimensions",
        dimensions: { width: 241, height: 101 },
      },
    ],
    nodes,
  );
  assert.deepEqual(next[1].style, nodes[1].style);
  assert.equal(next[1].selected, true);
});
