import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(
  new URL("../packages/whiteboard/src/whiteboard/board.css", import.meta.url),
  "utf8",
);

test("narrow whiteboard tabs wrap the complete top toolbar inside the viewport", () => {
  const compact = css.match(
    /@media \(max-width: 640px\) \{([\s\S]+)\}\s*$/,
  )?.[1];
  assert.ok(compact, "missing narrow-toolbar media query");
  assert.match(
    compact,
    /\.zmd-board-top-island\s*\{[^}]*width:\s*calc\(100% - 16px\)/s,
  );
  assert.match(compact, /\.zmd-board-top-island\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(compact, /\.zmd-board-top-group\s*\{[^}]*flex:\s*0 0 auto/s);
});
