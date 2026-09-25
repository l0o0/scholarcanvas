import assert from "node:assert/strict";
import test from "node:test";
import { connectionDisplayLabel } from "../packages/whiteboard/src/chrome/ConnectionEditor.tsx";
import {
  canvasDocumentToFlow,
  flowToCanvasDocument,
} from "../packages/whiteboard/src/whiteboard/document.ts";
import type { CanvasDocument } from "../packages/whiteboard/src/model/document.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";

const labels = {
  relationRelated: "Related",
  relationSupports: "Supports",
  relationContradicts: "Contradicts",
} as WhiteboardLabels;

const documentWithRelation: CanvasDocument = {
  version: 2,
  nodes: [
    {
      id: "source",
      kind: "note",
      position: { x: 0, y: 0 },
      width: 260,
      height: 152,
      content: "Source",
    },
    {
      id: "target",
      kind: "note",
      position: { x: 320, y: 0 },
      width: 260,
      height: 152,
      content: "Target",
    },
  ],
  connections: [
    {
      id: "edge",
      kind: "academic",
      source: "source",
      target: "target",
      relation: "supports",
    },
  ],
};

test("academic relation labels are visible without becoming user labels on save", () => {
  const flow = canvasDocumentToFlow(documentWithRelation);
  assert.equal(flow.edges[0]?.label, undefined);
  assert.equal(
    connectionDisplayLabel(flow.edges[0]!.data!.connection, labels),
    labels.relationSupports,
  );

  const saved = flowToCanvasDocument(flow.nodes, flow.edges, {
    x: 0,
    y: 0,
    zoom: 1,
  });
  assert.equal(saved.connections[0]?.kind, "academic");
  assert.equal(saved.connections[0]?.relation, "supports");
  assert.equal(saved.connections[0]?.label, undefined);
});

test("custom connection labels remain separate from the relation", () => {
  const flow = canvasDocumentToFlow({
    ...documentWithRelation,
    connections: [
      { ...documentWithRelation.connections[0]!, label: "because" },
    ],
  });
  assert.equal(flow.edges[0]?.label, "because");
  const saved = flowToCanvasDocument(flow.nodes, flow.edges, {
    x: 0,
    y: 0,
    zoom: 1,
  });
  assert.equal(saved.connections[0]?.label, "because");
  assert.equal(saved.connections[0]?.relation, "supports");
});

test("raw edge labels remain authoritative when converting flow state", () => {
  const flow = canvasDocumentToFlow(documentWithRelation);
  flow.edges[0] = { ...flow.edges[0]!, label: "edited in flow" };
  const saved = flowToCanvasDocument(flow.nodes, flow.edges, {
    x: 0,
    y: 0,
    zoom: 1,
  });
  assert.equal(saved.connections[0]?.label, "edited in flow");
  assert.equal(saved.connections[0]?.relation, "supports");
});
