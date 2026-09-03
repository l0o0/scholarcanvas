import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tab = readFileSync(
  new URL("../src/modules/whiteboard/tab.ts", import.meta.url),
  "utf8",
);
const session = readFileSync(
  new URL("../src/modules/whiteboard/session-registry.ts", import.meta.url),
  "utf8",
);
const hooks = readFileSync(new URL("../src/hooks.ts", import.meta.url), "utf8");
const tabHooks = readFileSync(
  new URL("../src/modules/whiteboard/tabHooks.ts", import.meta.url),
  "utf8",
);
const create = readFileSync(
  new URL("../src/modules/whiteboard/create.ts", import.meta.url),
  "utf8",
);

test("whiteboard sessions own a save coordinator", () => {
  assert.match(session, /saveCoordinator\?: WhiteboardSaveCoordinator/);
  assert.match(tab, /new WhiteboardSaveCoordinator\(/);
  assert.ok(
    tab.indexOf("session.saveCoordinator = new WhiteboardSaveCoordinator") <
      tab.indexOf("session.editor = createWhiteboardEditor"),
  );
});

test("all save entry points call the coordinator", () => {
  assert.match(tab, /saveCoordinator\?\.markChanged\(rev\)/);
  assert.match(tab, /saveCoordinator\.request\(/);
  assert.match(tab, /saveCoordinator\?\.flush\(\)/);
  assert.doesNotMatch(tab, /session\.savedRev\s*=/);
});

test("host persistence uses only schema-v2 canvas APIs", () => {
  assert.match(tab, /readCanvasFile/);
  assert.match(tab, /writeCanvasFile/);
  assert.doesNotMatch(tab, /readBoardFile|writeBoardFile|parseBoardDocument/);
  assert.match(tab, /for \(const issue of parsed\.issues\)/);
  assert.match(tab, /issue\.code/);
  assert.match(tab, /issue\.id/);
  assert.match(tab, /mountWhiteboardUI\([^)]*parsed\.document/s);
});

test("autosave and close-before-flush ordering remain unchanged", () => {
  assert.match(tab, /const AUTOSAVE_MS = 800/);
  const closeStart = tab.indexOf(
    "export async function closeWhiteboardSession",
  );
  const closeBody = tab.slice(closeStart);
  assert.ok(closeBody.indexOf("clearTimeout") < closeBody.indexOf("flush()"));
  assert.ok(
    closeBody.indexOf("flush()") < closeBody.indexOf("editor?.destroy()"),
  );
});

test("plugin shutdown flushes canvases before closing them", () => {
  assert.match(hooks, /await flushAllWhiteboards\(\)/);
  assert.ok(
    hooks.indexOf("await flushAllWhiteboards()") <
      hooks.indexOf("await closeAllWhiteboards()"),
  );
});

test("tab title hooks derive dirty state from the coordinator", () => {
  assert.match(tabHooks, /session\.saveCoordinator\?\.dirty/);
  assert.doesNotMatch(tabHooks, /session\.(currentRev|savedRev)/);
});

test("collection Zotero Notes become local Academic Notes without integer ids", () => {
  assert.match(create, /createAcademicNode\(\s*"note"/);
  assert.match(create, /content:/);
  assert.doesNotMatch(create, /noteID/);
});
