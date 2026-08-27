import assert from "node:assert/strict";
import test from "node:test";
import {
  boardNodeTypes,
  getNodeSpec,
  listNodeSpecs,
} from "../packages/whiteboard/src/nodes/index.ts";

test("registers custom react node kinds for library and draw groups", () => {
  const kinds = listNodeSpecs().map((spec) => spec.kind);
  assert.deepEqual(kinds, [
    "item",
    "note",
    "pdf",
    "attachment",
    "text",
    "rect",
    "ellipse",
    "line",
    "arrow",
  ]);
  assert.equal(getNodeSpec("item").group, "library");
  assert.equal(getNodeSpec("rect").group, "draw");
  assert.equal(typeof boardNodeTypes.item, "function");
  assert.equal(typeof boardNodeTypes.arrow, "function");
});

test("lists only library nodes when filtered", () => {
  const library = listNodeSpecs("library").map((spec) => spec.kind);
  assert.deepEqual(library, ["item", "note", "pdf", "attachment"]);
});
