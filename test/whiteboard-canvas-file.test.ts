import assert from "node:assert/strict";
import test from "node:test";
import {
  boardDocumentToCanvasFile,
  canvasFileToBoardDocument,
  parseStoredCanvas,
  serializeStoredCanvas,
} from "../packages/whiteboard/src/model/canvas-file.ts";
import { parseBoardDocument } from "../packages/whiteboard/src/model/snapshot.ts";

const board = parseBoardDocument({
  v: 1,
  engine: "xyflow",
  viewport: { x: 12, y: -8, zoom: 1.25 },
  vendorRoot: { keep: true },
  nodes: [
    {
      id: "paper-1",
      type: "item",
      position: { x: 30, y: 40 },
      width: 260,
      height: 120,
      vendorNode: "keep-node",
      data: {
        kind: "item",
        title: "Paper",
        subtitle: "Smith · 2026",
        vendorData: "keep-data",
      },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "paper-1",
      target: "claim-1",
      label: "related",
      vendorEdge: "keep-edge",
    },
  ],
});

test("encodes runtime geometry as JSON Canvas fields", () => {
  const file = boardDocumentToCanvasFile(board, {
    title: "Review",
    now: "2026-08-28T00:00:00.000Z",
  });
  assert.equal(file.version, 1);
  assert.deepEqual(file.nodes[0], {
    id: "paper-1",
    type: "text",
    x: 30,
    y: 40,
    width: 260,
    height: 120,
    text: "Paper\n\nSmith · 2026",
    vendorNode: "keep-node",
    bamboo: {
      kind: "item",
      data: {
        kind: "item",
        title: "Paper",
        subtitle: "Smith · 2026",
        vendorData: "keep-data",
      },
    },
  });
  assert.equal(file.edges[0].fromNode, "paper-1");
  assert.equal(file.edges[0].toNode, "claim-1");
  assert.equal(file.bamboo.viewport.zoom, 1.25);
  assert.deepEqual(file.vendorRoot, { keep: true });
});

test("decodes a canonical canvas without losing unknown fields", () => {
  const file = boardDocumentToCanvasFile(board, {
    title: "Review",
    now: "2026-08-28T00:00:00.000Z",
  });
  const decoded = canvasFileToBoardDocument(file);
  assert.equal(decoded.nodes[0].data.vendorData, "keep-data");
  assert.equal(decoded.nodes[0].extra?.vendorNode, "keep-node");
  assert.equal(decoded.edges[0].extra?.vendorEdge, "keep-edge");
  assert.deepEqual(decoded.extra?.vendorRoot, { keep: true });
});

test("detects canonical and legacy stored documents", () => {
  const canonical = parseStoredCanvas(
    boardDocumentToCanvasFile(board, {
      title: "Review",
      now: "2026-08-28T00:00:00.000Z",
    }),
  );
  assert.equal(canonical.format, "canvas");
  assert.equal(canonical.document.nodes[0].id, "paper-1");

  const legacy = parseStoredCanvas(board);
  assert.equal(legacy.format, "legacy");
  assert.equal(legacy.document.nodes[0].id, "paper-1");
});

test("serializes canonical and legacy formats explicitly", () => {
  const canonical = JSON.parse(
    serializeStoredCanvas(board, "canvas", {
      title: "Review",
      now: "2026-08-28T00:00:00.000Z",
    }),
  );
  assert.equal(canonical.version, 1);
  assert.equal(canonical.bamboo.schemaVersion, 1);
  assert.equal(canonical.nodes[0].x, 30);
  assert.equal(canonical.nodes[0].position, undefined);

  const legacy = JSON.parse(serializeStoredCanvas(board, "legacy"));
  assert.equal(legacy.engine, "xyflow");
  assert.deepEqual(legacy.nodes[0].position, { x: 30, y: 40 });
});
