import assert from "node:assert/strict";
import test from "node:test";
import {
  createBoardNode,
  parseBoardDocument,
} from "../src/modules/whiteboard/snapshot.ts";
import {
  ensureBoardExtension,
  serializeBoardDocument,
} from "../src/modules/whiteboard/file-io.ts";

test("recovers an empty board from junk input", () => {
  const empty = parseBoardDocument(null);
  assert.equal(empty.engine, "xyflow");
  assert.deepEqual(empty.nodes, []);
  assert.deepEqual(empty.edges, []);
});

test("keeps academic node kinds and drops unknown records", () => {
  const doc = parseBoardDocument({
    nodes: [
      {
        id: "n1",
        type: "item",
        position: { x: 10, y: 20 },
        data: { title: "Paper", itemID: 44 },
      },
      { id: "bad", type: "sticky", position: { x: 0, y: 0 } },
    ],
    edges: [{ id: "e1", source: "n1", target: "missing" }, { id: 3 }],
  });
  assert.equal(doc.nodes.length, 1);
  assert.equal(doc.nodes[0].data.kind, "item");
  assert.equal(doc.nodes[0].data.itemID, 44);
  assert.equal(doc.edges.length, 1);
  assert.equal(doc.edges[0].target, "missing");
});

test("keeps line endpoints drawn on the canvas", () => {
  const doc = parseBoardDocument({
    nodes: [
      {
        id: "line-1",
        type: "line",
        position: { x: 8, y: 16 },
        width: 80,
        height: 40,
        data: {
          kind: "line",
          title: "",
          from: { x: 0, y: 0 },
          to: { x: 80, y: 40 },
        },
      },
    ],
  });
  assert.equal(doc.nodes.length, 1);
  assert.deepEqual(doc.nodes[0].data.from, { x: 0, y: 0 });
  assert.deepEqual(doc.nodes[0].data.to, { x: 80, y: 40 });
});

test("keeps stroke and fill style on a rect", () => {
  const doc = parseBoardDocument({
    nodes: [
      {
        id: "r1",
        type: "rect",
        position: { x: 0, y: 0 },
        data: {
          kind: "rect",
          title: "",
          stroke: "#111827",
          fill: "#ffffff",
          strokeWidth: 2,
          radius: 12,
          dashed: true,
        },
      },
    ],
  });
  assert.equal(doc.nodes[0].data.stroke, "#111827");
  assert.equal(doc.nodes[0].data.fill, "#ffffff");
  assert.equal(doc.nodes[0].data.strokeWidth, 2);
  assert.equal(doc.nodes[0].data.radius, 12);
  assert.equal(doc.nodes[0].data.dashed, true);
});

test("preserves an explicit edge arrow opt-out while legacy edges stay implicit", () => {
  const doc = parseBoardDocument({
    edges: [
      { id: "legacy", source: "a", target: "b" },
      { id: "plain", source: "a", target: "b", arrow: false },
    ],
  });
  assert.equal(doc.v, 1);
  assert.equal(doc.edges[0].arrow, undefined);
  assert.equal(doc.edges[1].arrow, false);
});

test("keeps text style on a shape label", () => {
  const doc = parseBoardDocument({
    nodes: [
      {
        id: "t1",
        type: "rect",
        position: { x: 0, y: 0 },
        data: {
          kind: "rect",
          title: "Hello",
          fontFamily: "Georgia",
          fontSize: 24,
          fontWeight: "bold",
          textAlign: "center",
          textColor: "#2563eb",
        },
      },
    ],
  });
  assert.equal(doc.nodes[0].data.fontFamily, "Georgia");
  assert.equal(doc.nodes[0].data.fontSize, 24);
  assert.equal(doc.nodes[0].data.fontWeight, "bold");
  assert.equal(doc.nodes[0].data.textAlign, "center");
  assert.equal(doc.nodes[0].data.textColor, "#2563eb");
});

test("serializes a board as pretty JSON with a board suffix", () => {
  const json = serializeBoardDocument(
    parseBoardDocument({
      nodes: [
        {
          id: "n1",
          type: "note",
          position: { x: 0, y: 0 },
          data: { title: "Hello" },
        },
      ],
    }),
  );
  assert.match(json, /"engine": "xyflow"/);
  assert.match(json, /"title": "Hello"/);
  assert.equal(ensureBoardExtension("/tmp/board"), "/tmp/board.board");
  assert.equal(ensureBoardExtension("/tmp/board.json"), "/tmp/board.json");
  assert.equal(
    ensureBoardExtension("/tmp/board.zmdboard"),
    "/tmp/board.zmdboard",
  );
});

test("createBoardNode stamps a kind-specific placeholder", () => {
  const pdf = createBoardNode("pdf", { x: 1, y: 2 }, "pdf-1");
  assert.equal(pdf.type, "pdf");
  assert.equal(pdf.data.pdfPage, 1);

  const arrow = createBoardNode("arrow", { x: 0, y: 0 }, "arrow-1");
  assert.equal(arrow.type, "arrow");
  assert.equal(arrow.data.kind, "arrow");

  const line = createBoardNode("line", { x: 0, y: 0 }, "line-1");
  assert.equal(line.type, "line");
  assert.equal(line.data.kind, "line");
});
