import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "@xyflow/react";
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

test("every text-bearing draw node renders its requested vertical alignment", async (t) => {
  for (const kind of ["text", "rect", "ellipse", "line", "arrow"] as const) {
    await t.test(kind, () => {
      const Component = getNodeSpec(kind).Component;
      const markup = renderToStaticMarkup(
        createElement(
          ReactFlowProvider,
          null,
          createElement(Component, {
            id: `${kind}-1`,
            type: kind,
            data: { kind, title: "Aligned", verticalAlign: "top" },
            selected: false,
            width: 160,
            height: 80,
          } as never),
        ),
      );

      assert.match(markup, /align-items:flex-start/);
    });
  }
});

test("lists only library nodes when filtered", () => {
  const library = listNodeSpecs("library").map((spec) => spec.kind);
  assert.deepEqual(library, ["item", "note", "pdf", "attachment"]);
});
