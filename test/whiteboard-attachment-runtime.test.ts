import assert from "node:assert/strict";
import test from "node:test";
import { createBasicNode } from "../packages/whiteboard/src/model/basic.ts";
import { canvasDocumentToFlow } from "../packages/whiteboard/src/whiteboard/document.ts";
import { resolveAcademicPlaceholder } from "../packages/whiteboard/src/whiteboard/runtime.ts";
import { applyResolvedAcquisition } from "../packages/whiteboard/src/whiteboard/sourceState.ts";

function placeholder() {
  return canvasDocumentToFlow({
    version: 2,
    nodes: [createBasicNode("item", { x: 12, y: 24 }, "pending")],
    connections: [],
  }).nodes;
}

test("attachment acquisitions become PDF cards with stable source data", () => {
  const [node] = resolveAcademicPlaceholder(placeholder(), "pending", {
    kind: "attachment",
    source: { library: { type: "group", groupID: 42 }, attachmentKey: "PDF" },
    snapshot: {
      filename: "paper.pdf",
      contentType: "application/pdf",
      availability: "available",
    },
  }) ?? [];
  assert.equal(node?.data.model.kind, "pdf");
  if (node?.data.model.kind !== "pdf") return;
  assert.equal(node.data.model.data.title, "paper.pdf");
  assert.equal(node.data.model.data.contentType, "application/pdf");
  assert.deepEqual(node.data.model.data.source, {
    library: { type: "group", groupID: 42 },
    attachmentKey: "PDF",
  });
  assert.equal("itemID" in node.data.model.data, false);
});

test("non-PDF attachment acquisitions retain a not-downloaded status", () => {
  const [node] = resolveAcademicPlaceholder(placeholder(), "pending", {
    kind: "attachment",
    source: { library: { type: "user" }, attachmentKey: "ZIP" },
    snapshot: {
      filename: "dataset.zip",
      contentType: "application/zip",
      availability: "not-downloaded",
    },
  }) ?? [];
  assert.equal(node?.data.model.kind, "attachment");
  if (node?.data.model.kind !== "attachment") return;
  assert.equal(node.data.model.data.title, "dataset.zip");
  assert.equal(node.data.model.data.availability, "not-downloaded");
});

test("source refresh keeps the React Flow renderer kind in sync with MIME changes", () => {
  const [initial] = resolveAcademicPlaceholder(placeholder(), "pending", {
    kind: "attachment",
    source: { library: { type: "user" }, attachmentKey: "FILE" },
    snapshot: {
      filename: "file.bin",
      contentType: "application/octet-stream",
      availability: "available",
    },
  }) ?? [];
  if (!initial) return;
  const updated = applyResolvedAcquisition(initial, {
    kind: "attachment",
    source: { library: { type: "user" }, attachmentKey: "FILE" },
    snapshot: {
      filename: "file.pdf",
      contentType: "application/pdf",
      availability: "available",
    },
  });
  assert.equal(updated.type, "pdf");
  assert.equal(updated.data.model.kind, "pdf");
  const withoutMime = applyResolvedAcquisition(updated, {
    kind: "attachment",
    source: { library: { type: "user" }, attachmentKey: "FILE" },
    snapshot: {
      filename: "file",
      availability: "available",
    },
  });
  assert.equal(withoutMime.type, "attachment");
  assert.equal(withoutMime.data.model.kind, "attachment");
  if (withoutMime.data.model.kind === "attachment") {
    assert.equal(withoutMime.data.model.data.contentType, undefined);
    assert.equal(withoutMime.data.model.data.subtitle, undefined);
  }
});
