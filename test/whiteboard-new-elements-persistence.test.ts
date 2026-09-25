import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasDocumentToFile,
  canvasFileToDocument,
} from "../packages/whiteboard/src/model/canvas-file.ts";
import { parseCanvasDocument } from "../packages/whiteboard/src/model/document.ts";

test("new shape and attachment fields roundtrip without stale extension copies", () => {
  const nodes = [
    {
      id: "diamond",
      kind: "rect",
      style: { shape: "diamond", radius: 0 },
      data: { title: "Decision" },
    },
    ...["pdf", "attachment"].map((kind) => ({
      id: kind,
      kind,
      data: {
        title: kind === "pdf" ? "paper.pdf" : "data.zip",
        source: {
          library: { type: "group", groupID: 42 },
          attachmentKey: "FILE1234",
        },
        contentType: kind === "pdf" ? "application/pdf" : "application/zip",
        availability: "not-downloaded",
      },
    })),
  ].map((node, i) => ({
    ...node,
    position: { x: i * 300, y: 0 },
    width: 240,
    height: 180,
  }));
  let document = parseCanvasDocument({
    version: 2,
    nodes,
    connections: [],
  }).document;
  assert.equal(document.nodes.length, 3);
  const original = structuredClone(document.nodes);
  for (let i = 0; i < 2; i++) {
    document = canvasFileToDocument(canvasDocumentToFile(document)).document;
    assert.deepEqual(document.nodes, original);
  }
});
