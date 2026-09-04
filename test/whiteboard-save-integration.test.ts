import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  acquireAcademicItems,
  parseDroppedItemIDs,
  resolveNativeAcademicDrop,
} from "../src/modules/whiteboard/tab.ts";

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
  assert.match(tab, /item\.isRegularItem\(\) \|\| item\.isNote\(\)/);
  assert.match(tab, /gateway\.acquireItem\(item\)/);
  assert.match(tab, /gateway\.refreshNote\(source\)/);
  assert.match(tab, /applyNoteRefresh/);
  assert.doesNotMatch(tab, /gateway\.acquireItem\([^)]*isAttachment/);
});

test("production Zotero item drops use one canonical payload and preserve its order", () => {
  const transfer = (data: Record<string, string>) => {
    const value = { ...data } as Record<string, string> & {
      types: string[];
      getData(type: string): string;
    };
    Object.defineProperties(value, {
      types: { value: Object.keys(data), enumerable: false },
      getData: {
        value: (type: string) => data[type] ?? "",
        enumerable: false,
      },
    });
    return value;
  };
  assert.deepEqual(
    parseDroppedItemIDs(
      transfer({
        "text/plain": "12,13",
        "zotero/item": "11,11,12",
        "application/json": "[14]",
      }),
    ),
    [11, 11, 12],
    "mirrored MIME flavors cannot multiply or reorder canonical entries",
  );
  assert.deepEqual(
    parseDroppedItemIDs(
      transfer({ "zotero/collection": "7", "zotero/item": "11,12" }),
    ),
    [],
    "Zotero's collection > item > search precedence rejects a mixed collection drag",
  );
  assert.deepEqual(
    parseDroppedItemIDs(
      transfer({ "application/json": "[11,12]", "text/plain": "11,12" }),
    ),
    [],
    "arbitrary MIME payloads are not interpreted as Zotero item IDs",
  );
});

test("host resolves ordered Zotero ids to native user/group keys before protocol crossing", () => {
  const payloads = new Map([
    ["zotero/item", "11,12,11"],
    ["text/plain", "12,11"],
  ]);
  const result = resolveNativeAcademicDrop(
    {
      types: [...payloads.keys()],
      getData: (type) => payloads.get(type) ?? "",
    },
    {
      userLibraryID: 1,
      getItem(itemID) {
        if (itemID === 11)
          return { key: "PAPER123", libraryID: 1 } as Zotero.Item;
        if (itemID === 12)
          return { key: "PDF12345", libraryID: 5 } as Zotero.Item;
        return null;
      },
      getLibrary(libraryID) {
        return libraryID === 5 ? { libraryType: "group", groupID: 88 } : null;
      },
    },
  );

  assert.deepEqual(result, {
    status: "accepted",
    sources: [
      { library: { type: "user" }, itemKey: "PAPER123" },
      { library: { type: "group", groupID: 88 }, itemKey: "PDF12345" },
      { library: { type: "user" }, itemKey: "PAPER123" },
    ],
  });
  assert.equal(JSON.stringify(result).includes("itemID"), false);
  assert.deepEqual(
    resolveNativeAcademicDrop(
      { types: ["zotero/item"], getData: () => "11,broken" },
      { userLibraryID: 1, getItem: () => null, getLibrary: () => null },
    ),
    { status: "rejected", code: "drop-malformed" },
  );
});

test("generic Zotero batches acquire supported inputs independently and retain source indexes", async () => {
  const item = (
    kind: "regular" | "note" | "attachment" | "other",
    key: string,
  ) =>
    ({
      key,
      isRegularItem: () => kind === "regular",
      isNote: () => kind === "note",
      isAttachment: () => kind === "attachment",
      isAnnotation: () => false,
    }) as unknown as Zotero.Item;
  const calls: string[] = [];
  const result = await acquireAcademicItems(
    [
      item("regular", "FIRST123"),
      item("attachment", "PDF12345"),
      item("regular", "FIRST123"),
      item("note", "NOTE1234"),
    ],
    {
      async acquireItem(input) {
        calls.push(input.key);
        await Promise.resolve();
        return input.isNote()
          ? {
              kind: "note" as const,
              source: {
                library: { type: "user" as const },
                noteKey: input.key,
              },
              content: "Imported note",
            }
          : {
              kind: "literature" as const,
              source: {
                library: { type: "user" as const },
                itemKey: input.key,
              },
              snapshot: { title: input.key },
            };
      },
    },
  );

  assert.deepEqual(calls, ["FIRST123", "FIRST123", "NOTE1234"]);
  assert.deepEqual(
    result.successes.map(({ index, acquisition }) => [index, acquisition.kind]),
    [
      [0, "literature"],
      [2, "literature"],
      [3, "note"],
    ],
  );
  assert.deepEqual(result.failures, [
    {
      index: 1,
      code: "unsupported-attachment",
      message: "Zotero attachments cannot be added to the canvas.",
    },
  ]);
  assert.deepEqual(
    result.failures.map((failure) => failure.index),
    [1],
  );
  assert.equal(
    result.successes.filter(
      ({ acquisition }) => acquisition.kind === "literature",
    ).length,
    2,
  );
  assert.equal(
    result.successes.some(({ acquisition }) => acquisition.kind === "quote"),
    false,
  );
  assert.equal(
    result.successes.filter(({ acquisition }) => acquisition.kind === "note")
      .length,
    1,
  );
});

test("a supported item acquisition failure is indexed without cancelling its peers", async () => {
  const regular = (key: string) =>
    ({
      key,
      isRegularItem: () => true,
      isNote: () => false,
      isAttachment: () => false,
    }) as unknown as Zotero.Item;
  const result = await acquireAcademicItems(
    [regular("GOOD1234"), regular("BROKEN12"), regular("NEXT1234")],
    {
      acquireItem(input) {
        if (input.key === "BROKEN12") throw new Error("Cannot snapshot");
        return {
          kind: "literature",
          source: { library: { type: "user" }, itemKey: input.key },
          snapshot: { title: input.key },
        };
      },
    },
  );

  assert.deepEqual(
    result.successes.map((success) => success.index),
    [0, 2],
  );
  assert.deepEqual(result.failures, [
    { index: 1, code: "acquisition-failed", message: "Cannot snapshot" },
  ]);
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
