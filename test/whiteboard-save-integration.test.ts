import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDroppedItemIDs } from "../src/modules/whiteboard/tab.ts";

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
  assert.match(tab, /parseCanvasDocument/);
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

test("collection Zotero Notes become source-backed Academic Notes without integer ids", () => {
  assert.match(create, /createAcademicNode\(\s*"note"/);
  assert.match(create, /source: acquisition\.source/);
  assert.match(create, /content:/);
  assert.doesNotMatch(create, /noteID/);
});

test("new Zotero acquisition uses the academic gateway without Attachment paths", () => {
  assert.match(tab, /createZoteroSourceGateway\(\)/);
  assert.match(tab, /gateway\.acquireItem\(item\)/);
  assert.match(tab, /onPickAcademicSource/);
  assert.match(tab, /onDropAcademicSources/);
  assert.doesNotMatch(tab, /promptPageNumber/);
  assert.doesNotMatch(tab, /renderPdfPageToDataUrl/);
  assert.doesNotMatch(tab, /editor\.resolvePick/);
  assert.doesNotMatch(tab, /editor\.rejectPick/);
});

test("generic Zotero acquisition accepts Notes and refreshes them through the source gateway", () => {
  assert.match(tab, /candidate\.isRegularItem\(\) \|\| candidate\.isNote\(\)/);
  assert.match(tab, /gateway\.acquireItem\(item\)/);
  assert.match(tab, /gateway\.refreshNote\(source\)/);
  assert.match(tab, /applyNoteRefresh/);
  assert.doesNotMatch(tab, /gateway\.acquireItem\([^)]*isAttachment/);
});

test("generic Zotero drops parse every encoded item id once", () => {
  assert.deepEqual(
    parseDroppedItemIDs({
      json: JSON.stringify([11, { itemID: 12 }, { id: 13 }, "14"]),
      text: "15, 11",
    }),
    [11, 12, 13, 14, 15],
  );
  assert.deepEqual(
    parseDroppedItemIDs({ uri: "file:///tmp/2026/paper.pdf" }),
    [],
  );
});

test("collection generation builds source-key Literature without PDF traversal", () => {
  const collectionStart = create.indexOf(
    "export function buildCollectionCanvas",
  );
  const collectionEnd = create.indexOf(
    "export async function createWhiteboardFromCollection",
  );
  const collectionBody = create.slice(collectionStart, collectionEnd);
  assert.match(collectionBody, /gateway\.acquireItem\(item\)/);
  assert.match(collectionBody, /createAcademicNode\(\s*"literature"/);
  assert.doesNotMatch(collectionBody, /getAttachments\(/);
  assert.doesNotMatch(collectionBody, /createBasicNode\(\s*"pdf"/);
});
