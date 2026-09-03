import assert from "node:assert/strict";
import test from "node:test";
import {
  CanvasDocumentError,
  demoCanvasDocument,
  emptyCanvasDocument,
  parseCanvasDocument,
} from "../packages/whiteboard/src/model/document.ts";

test("rejects a wholly invalid Bamboo document", () => {
  assert.throws(
    () => parseCanvasDocument({ version: 2, nodes: "bad", connections: [] }),
    CanvasDocumentError,
  );
});

test("repairs dangling connections and invalid frame membership", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      {
        id: "frame-1",
        kind: "frame",
        position: { x: 0, y: 0 },
        width: 400,
        height: 300,
        title: "Topic",
      },
      {
        id: "claim-1",
        kind: "claim",
        position: { x: 20, y: 30 },
        width: 240,
        height: 120,
        frameId: "missing-frame",
        content: "Claim",
      },
    ],
    connections: [
      {
        id: "bad-edge",
        kind: "academic",
        source: "claim-1",
        target: "missing",
        relation: "supports",
      },
    ],
  });

  assert.equal(result.document.nodes[1].frameId, undefined);
  assert.deepEqual(result.document.connections, []);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["invalid-frame", "dangling-connection"],
  );
});

test("allows semantic relationships between arbitrary existing nodes", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      {
        id: "rect-1",
        kind: "rect",
        position: { x: 0, y: 0 },
        width: 100,
        height: 80,
        data: { title: "Context" },
      },
      {
        id: "question-1",
        kind: "question",
        position: { x: 200, y: 0 },
        width: 240,
        height: 120,
        content: "Why?",
      },
    ],
    connections: [
      {
        id: "edge-1",
        kind: "academic",
        source: "rect-1",
        target: "question-1",
        relation: "supports",
      },
    ],
  });
  assert.equal(result.document.connections[0].kind, "academic");
});

test("drops duplicate node and connection identifiers in source order", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      claim("claim-1"),
      { ...claim("claim-1"), content: "duplicate" },
      claim("claim-2"),
    ],
    connections: [
      academicConnection("edge-1", "claim-1", "claim-2"),
      academicConnection("edge-1", "claim-2", "claim-1"),
    ],
  });

  assert.deepEqual(
    result.document.nodes.map((node) => node.id),
    ["claim-1", "claim-2"],
  );
  assert.deepEqual(
    result.document.connections.map((connection) => connection.id),
    ["edge-1"],
  );
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["duplicate-node-id", "duplicate-connection-id"],
  );
});

test("clears nesting from Frames", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [{ ...frame("frame-1"), frameId: "frame-2" }, frame("frame-2")],
    connections: [],
  });

  assert.equal(result.document.nodes[0].frameId, undefined);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["nested-frame"],
  );
});

test("clears an empty frame membership", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [{ ...claim("claim-1"), frameId: "" }],
    connections: [],
  });

  assert.equal(result.document.nodes[0].frameId, undefined);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["invalid-frame"],
  );
});

test("drops nodes with non-finite coordinates or non-positive dimensions", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      { ...claim("bad-coordinate"), position: { x: Infinity, y: 0 } },
      { ...claim("bad-width"), width: 0 },
      { ...claim("bad-height"), height: -1 },
      claim("valid-claim"),
    ],
    connections: [],
  });

  assert.deepEqual(
    result.document.nodes.map((node) => node.id),
    ["valid-claim"],
  );
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["malformed-node", "malformed-node", "malformed-node"],
  );
});

test("drops malformed individual nodes while retaining valid records", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      { id: "unknown", kind: "unknown" },
      { ...claim("no-content"), content: 42 },
      claim("valid-claim"),
    ],
    connections: [],
  });

  assert.deepEqual(
    result.document.nodes.map((node) => node.id),
    ["valid-claim"],
  );
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["malformed-node", "malformed-node"],
  );
});

test("requires non-empty Zotero keys", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      literature("empty-item", ""),
      quote("empty-attachment", "ITEM1234", "", "ANNO1234"),
      note("empty-note", ""),
      literature("valid-literature", "ITEM1234"),
    ],
    connections: [],
  });

  assert.deepEqual(
    result.document.nodes.map((node) => node.id),
    ["valid-literature"],
  );
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["malformed-node", "malformed-node", "malformed-node"],
  );
});

test("parses all six academic node payloads", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      literature("literature-1", "ITEM1234"),
      quote("quote-1", "ITEM1234", "ATTACH12", "ANNO1234"),
      note("note-1", "NOTE1234"),
      { ...claim("question-1"), kind: "question", content: "Why?" },
      claim("claim-1"),
      frame("frame-1"),
    ],
    connections: [],
  });

  assert.deepEqual(
    result.document.nodes.map((node) => node.kind),
    ["literature", "quote", "note", "question", "claim", "frame"],
  );
  assert.deepEqual(result.issues, []);
});

test("preserves only explicit extension records", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      {
        ...claim("claim-1"),
        unknownNodeValue: "discarded",
        extensions: { plugin: { enabled: true } },
      },
    ],
    connections: [
      {
        ...academicConnection("edge-1", "claim-1", "claim-1"),
        unknownConnectionValue: "discarded",
        extensions: { externalId: "edge-x" },
      },
    ],
    viewport: { x: 10, y: 20, zoom: 1.5, ignored: true },
    metadata: { title: "Canvas", ignored: true },
    extensions: { documentPlugin: ["one"] },
    ignoredRootValue: true,
  });

  const node = result.document.nodes[0] as Record<string, unknown>;
  const connection = result.document.connections[0] as Record<string, unknown>;
  assert.deepEqual(node.extensions, { plugin: { enabled: true } });
  assert.equal(node.unknownNodeValue, undefined);
  assert.deepEqual(connection.extensions, { externalId: "edge-x" });
  assert.equal(connection.unknownConnectionValue, undefined);
  assert.deepEqual(result.document.extensions, { documentPlugin: ["one"] });
  assert.deepEqual(result.document.viewport, { x: 10, y: 20, zoom: 1.5 });
  assert.deepEqual(result.document.metadata, { title: "Canvas" });
});

test("creates an empty version-two document", () => {
  assert.deepEqual(emptyCanvasDocument(), {
    version: 2,
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
});

test("creates a valid academic demo without Zotero integer IDs", () => {
  const result = parseCanvasDocument(demoCanvasDocument());

  assert.deepEqual(
    result.document.nodes.map((node) => node.kind),
    ["literature", "quote", "claim"],
  );
  assert.equal(result.document.connections[0].relation, "supports");
  assert.deepEqual(result.issues, []);
});

function claim(id: string) {
  return {
    id,
    kind: "claim",
    position: { x: 0, y: 0 },
    width: 240,
    height: 120,
    content: "Claim",
  };
}

function frame(id: string) {
  return {
    id,
    kind: "frame",
    position: { x: 0, y: 0 },
    width: 400,
    height: 300,
    title: "Topic",
  };
}

function literature(id: string, itemKey: string) {
  return {
    id,
    kind: "literature",
    position: { x: 0, y: 0 },
    width: 280,
    height: 136,
    source: { library: { type: "user" }, itemKey },
    snapshot: { title: "A paper", tags: ["research"], annotationCount: 2 },
  };
}

function quote(
  id: string,
  itemKey: string,
  attachmentKey: string,
  annotationKey: string,
) {
  return {
    id,
    kind: "quote",
    position: { x: 0, y: 0 },
    width: 280,
    height: 168,
    source: {
      library: { type: "user" },
      itemKey,
      attachmentKey,
      annotationKey,
    },
    snapshot: { text: "Evidence", pageLabel: "12", color: "#ffd400" },
  };
}

function note(id: string, noteKey: string) {
  return {
    id,
    kind: "note",
    position: { x: 0, y: 0 },
    width: 260,
    height: 152,
    content: "A note",
    source: { library: { type: "user" }, noteKey, itemKey: "ITEM1234" },
    sourceSnapshot: { title: "Note" },
  };
}

function academicConnection(id: string, source: string, target: string) {
  return { id, kind: "academic", source, target, relation: "supports" };
}
