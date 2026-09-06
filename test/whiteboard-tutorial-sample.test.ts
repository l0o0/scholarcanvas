import assert from "node:assert/strict";
import test from "node:test";
import type { AcademicAcquisition } from "../packages/whiteboard/src/model/protocol.ts";
import {
  selectTutorialSample,
  TUTORIAL_CANDIDATE_LIMIT,
  type TutorialSampleDependencies,
} from "../src/modules/whiteboard/tutorial.ts";
import type { ZoteroSourceGateway } from "../src/modules/whiteboard/source-gateway.ts";

const USER_LIBRARY_ID = 1;

type FakeKind = "regular" | "note" | "other";

interface FakeItem {
  id: number;
  libraryID: number;
  key: string;
  dateModified: string;
  isRegularItem(): boolean;
  getNotes(): number[];
}

function item(
  kind: FakeKind,
  values: Partial<
    Pick<FakeItem, "id" | "libraryID" | "key" | "dateModified">
  > & {
    notes?: number[];
  } = {},
): FakeItem {
  const { notes = [], ...fields } = values;
  return {
    id: fields.id ?? 1,
    libraryID: fields.libraryID ?? USER_LIBRARY_ID,
    key: fields.key ?? "ITEMKEY",
    dateModified: fields.dateModified ?? "2026-01-01 00:00:00",
    isRegularItem: () => kind === "regular",
    getNotes: () => notes,
  };
}

function literature(
  itemKey: string,
): Extract<AcademicAcquisition, { kind: "literature" }> {
  return {
    kind: "literature",
    source: { library: { type: "user" }, itemKey },
    snapshot: { title: itemKey },
  };
}

function quote(
  itemKey: string,
  index: number,
): Extract<AcademicAcquisition, { kind: "quote" }> {
  return {
    kind: "quote",
    source: {
      library: { type: "user" },
      itemKey,
      attachmentKey: `PDF${index}`,
      annotationKey: `QUOTE${index}`,
    },
    snapshot: { text: `Quote ${index}` },
  };
}

function note(
  itemKey: string,
  noteKey: string,
): Extract<AcademicAcquisition, { kind: "note" }> {
  return {
    kind: "note",
    source: { library: { type: "user" }, itemKey, noteKey },
    content: noteKey,
  };
}

function gateway(
  options: {
    annotations?: Record<
      string,
      Array<Extract<AcademicAcquisition, { kind: "quote" }>>
    >;
    annotationFailures?: Set<string>;
    acquisitionFailures?: Set<string>;
    noteParents?: Record<string, string>;
  } = {},
): ZoteroSourceGateway {
  return {
    acquireItem(value) {
      const fake = value as unknown as FakeItem;
      if (options.acquisitionFailures?.has(fake.key)) {
        throw new Error(`Cannot acquire ${fake.key}`);
      }
      const parentKey = options.noteParents?.[fake.key];
      return parentKey ? note(parentKey, fake.key) : literature(fake.key);
    },
    async listAnnotations(source) {
      if (options.annotationFailures?.has(source.itemKey)) {
        throw new Error(`Cannot list ${source.itemKey}`);
      }
      return {
        candidates: (options.annotations?.[source.itemKey] ?? []).map(
          (acquisition, index) => ({
            acquisition,
            attachmentTitle: `PDF ${index}`,
            sortIndex: String(index),
          }),
        ),
        failures: [],
      };
    },
    async resolve() {
      throw new Error("not used");
    },
    async refreshNote() {
      throw new Error("not used");
    },
    async open() {},
  };
}

function dependencies(
  recentIDs: number[],
  items: FakeItem[],
  sourceGateway: ZoteroSourceGateway,
  recentCalls: Array<[number, number]> = [],
): TutorialSampleDependencies {
  const byID = new Map(items.map((value) => [value.id, value]));
  return {
    userLibraryID: USER_LIBRARY_ID,
    recentItemIDs: async (libraryID, limit) => {
      recentCalls.push([libraryID, limit]);
      return recentIDs;
    },
    getItem: (id) => (byID.get(id) as unknown as Zotero.Item) ?? null,
    gateway: sourceGateway,
  };
}

test("selects a bounded rich user-library sample and skips invalid IDs", async () => {
  const rich = item("regular", {
    id: 10,
    key: "RICH1234",
    dateModified: "2026-01-01 00:00:00",
    notes: [90, 91, 92, 93],
  });
  const wrongLibrary = item("regular", {
    id: 11,
    libraryID: 2,
    key: "GROUP123",
  });
  const attachment = item("other", { id: 12, key: "ATTACHMENT" });
  const annotation = item("other", { id: 13, key: "ANNOTATION" });
  const topLevelNote = item("note", { id: 14, key: "TOPNOTE" });
  const brokenRegular = item("regular", { id: 15, key: "BROKENITEM" });
  const failingNote = item("note", { id: 91, key: "FAILNOTE" });
  const validNote = item("note", { id: 92, key: "NOTE1234" });
  const ignoredNote = item("note", { id: 93, key: "IGNORED" });
  const quotes = [quote(rich.key, 1), quote(rich.key, 2), quote(rich.key, 3)];
  const recentCalls: Array<[number, number]> = [];
  const deps = dependencies(
    [
      99,
      98,
      wrongLibrary.id,
      attachment.id,
      annotation.id,
      topLevelNote.id,
      brokenRegular.id,
      rich.id,
    ],
    [
      wrongLibrary,
      attachment,
      annotation,
      topLevelNote,
      brokenRegular,
      rich,
      failingNote,
      validNote,
      ignoredNote,
    ],
    gateway({
      annotations: { [rich.key]: quotes },
      acquisitionFailures: new Set([brokenRegular.key, failingNote.key]),
      noteParents: {
        [validNote.key]: rich.key,
        [ignoredNote.key]: rich.key,
      },
    }),
    recentCalls,
  );
  const originalGetItem = deps.getItem;
  deps.getItem = (id) => {
    if (id === 98) throw new Error("Deleted while resolving");
    return originalGetItem(id);
  };

  const result = await selectTutorialSample(deps);

  assert.deepEqual(recentCalls, [[USER_LIBRARY_ID, 50]]);
  assert.equal(TUTORIAL_CANDIDATE_LIMIT, 50);
  assert.equal(result?.literature.source.itemKey, "RICH1234");
  assert.equal(result?.quotes.length, 2);
  assert.deepEqual(
    result?.quotes.map((value) => value.source.annotationKey),
    ["QUOTE1", "QUOTE2"],
  );
  assert.equal(result?.note?.source.noteKey, "NOTE1234");
  for (const value of [
    rich,
    wrongLibrary,
    attachment,
    annotation,
    topLevelNote,
    brokenRegular,
    failingNote,
    validNote,
    ignoredNote,
  ]) {
    assert.equal("save" in value, false);
    assert.equal("saveTx" in value, false);
  }
});

test("ranks content tiers ahead of recency", async () => {
  const both = item("regular", {
    id: 20,
    key: "BOTH",
    dateModified: "2026-01-01 00:00:00",
    notes: [120],
  });
  const annotationsOnly = item("regular", {
    id: 21,
    key: "QUOTES",
    dateModified: "2026-04-01 00:00:00",
  });
  const noteOnly = item("regular", {
    id: 22,
    key: "NOTEONLY",
    dateModified: "2026-05-01 00:00:00",
    notes: [122],
  });
  const plain = item("regular", {
    id: 23,
    key: "PLAIN",
    dateModified: "2026-06-01 00:00:00",
  });
  const bothNote = item("note", { id: 120, key: "BOTHNOTE" });
  const onlyNote = item("note", { id: 122, key: "ONLYNOTE" });

  const result = await selectTutorialSample(
    dependencies(
      [plain.id, noteOnly.id, annotationsOnly.id, both.id],
      [both, annotationsOnly, noteOnly, plain, bothNote, onlyNote],
      gateway({
        annotations: {
          [both.key]: [quote(both.key, 1)],
          [annotationsOnly.key]: [quote(annotationsOnly.key, 2)],
        },
        noteParents: {
          [bothNote.key]: both.key,
          [onlyNote.key]: noteOnly.key,
        },
      }),
    ),
  );

  assert.equal(result?.literature.source.itemKey, "BOTH");
  assert.equal(result?.quotes.length, 1);
  assert.equal(result?.note?.source.noteKey, "BOTHNOTE");
});

test("breaks same-tier ties by descending modification date then Item ID", async () => {
  const older = item("regular", {
    id: 999,
    key: "OLDER",
    dateModified: "2026-01-01 00:00:00",
  });
  const lowerID = item("regular", {
    id: 30,
    key: "LOWER",
    dateModified: "2026-02-01 00:00:00",
  });
  const higherID = item("regular", {
    id: 31,
    key: "HIGHER",
    dateModified: "2026-02-01 00:00:00",
  });

  const result = await selectTutorialSample(
    dependencies(
      [older.id, lowerID.id, higherID.id],
      [older, lowerID, higherID],
      gateway(),
    ),
  );

  assert.equal(result?.literature.source.itemKey, "HIGHER");
});

test("never resolves more than the fixed candidate limit", async () => {
  let resolutions = 0;
  const deps = dependencies(
    Array.from(
      { length: TUTORIAL_CANDIDATE_LIMIT + 1 },
      (_, index) => index + 1,
    ),
    [],
    gateway(),
  );
  deps.getItem = () => {
    resolutions += 1;
    return null;
  };

  await selectTutorialSample(deps);

  assert.equal(resolutions, TUTORIAL_CANDIDATE_LIMIT);
});

test("keeps valid Literature when annotation or child Note discovery fails", async () => {
  const partial = item("regular", {
    id: 40,
    key: "PARTIAL",
    notes: [140],
  });
  const brokenNote = item("note", { id: 140, key: "BROKENNOTE" });

  const result = await selectTutorialSample(
    dependencies(
      [partial.id],
      [partial, brokenNote],
      gateway({
        annotationFailures: new Set([partial.key]),
        acquisitionFailures: new Set([brokenNote.key]),
      }),
    ),
  );

  assert.equal(result?.literature.source.itemKey, "PARTIAL");
  assert.deepEqual(result?.quotes, []);
  assert.equal(result?.note, undefined);
});

test("returns undefined for no candidates or a discovery exception", async () => {
  assert.equal(
    await selectTutorialSample(dependencies([], [], gateway())),
    undefined,
  );

  const deps = dependencies([], [], gateway());
  deps.recentItemIDs = async () => {
    throw new Error("database unavailable");
  };
  assert.equal(await selectTutorialSample(deps), undefined);
});

test("production discovery issues one parameterized bounded ID query", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Zotero");
  Object.defineProperty(globalThis, "Zotero", {
    configurable: true,
    value: {
      Libraries: { userLibraryID: USER_LIBRARY_ID },
      DB: {
        columnQueryAsync: async (sql: string, params: unknown[]) => {
          calls.push({ sql, params });
          return [];
        },
      },
      Items: { get: () => null },
    },
  });
  try {
    assert.equal(await selectTutorialSample(), undefined);
  } finally {
    if (previous) Object.defineProperty(globalThis, "Zotero", previous);
    else Reflect.deleteProperty(globalThis, "Zotero");
  }

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].sql.replace(/\s+/g, " ").trim(),
    "SELECT itemID FROM items WHERE libraryID = ? AND itemID NOT IN (SELECT itemID FROM deletedItems) ORDER BY dateModified DESC, itemID DESC LIMIT ?",
  );
  assert.deepEqual(calls[0].params, [USER_LIBRARY_ID, 50]);
});
