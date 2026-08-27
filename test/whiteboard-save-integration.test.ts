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
