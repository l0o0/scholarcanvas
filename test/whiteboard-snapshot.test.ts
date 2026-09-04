import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  CanvasDocumentError,
  createAcademicConnection,
  createAcademicNode,
  createBasicNode,
  emptyCanvasDocument,
  parseCanvasDocument,
} from "../src/modules/whiteboard/snapshot.ts";
import {
  buildCollectionCanvas,
  zoteroNotePlainText,
} from "../src/modules/whiteboard/create.ts";

test("host snapshot exports the canonical schema-v2 document", () => {
  const document = emptyCanvasDocument();
  assert.equal(document.version, 2);
  assert.deepEqual(document.nodes, []);
  assert.deepEqual(document.connections, []);
  assert.deepEqual(document.viewport, { x: 0, y: 0, zoom: 1 });
});

test("host snapshot does not recover a wholly invalid document", () => {
  assert.throws(() => parseCanvasDocument(null), CanvasDocumentError);
  assert.throws(
    () => parseCanvasDocument({ version: 1, nodes: [], connections: [] }),
    /version must be 2/,
  );
});

test("host snapshot exposes canonical basic and academic factories", () => {
  const item = createBasicNode("item", { x: 10, y: 20 }, "item-1");
  const note = createAcademicNode("note", { x: 30, y: 40 }, "note-1");
  const connection = createAcademicConnection(
    "edge-1",
    item.id,
    note.id,
    "related",
  );

  assert.equal(item.kind, "item");
  assert.equal(note.kind, "note");
  assert.equal(note.content, "");
  assert.equal("noteID" in note, false);
  assert.equal(connection.kind, "academic");
});

test("collection note conversion copies plain text rather than Zotero identity", () => {
  const content = zoteroNotePlainText({
    getNote: () => "<p>Evidence&nbsp;&amp; context</p><p>Second line</p>",
  });
  assert.equal(content, "Evidence & context\nSecond line");
});

test("note conversion preserves escaped angle brackets as user text", () => {
  const content = zoteroNotePlainText({
    getNote: () =>
      "<p>Math: 1 &lt; 2 &gt; 0</p><p>A&amp;B<br>next&nbsp;line</p>",
  });
  assert.equal(content, "Math: 1 < 2 > 0\nA&B\nnext line");
});

test("invalid numeric entities cannot clear the surrounding note", () => {
  const content = zoteroNotePlainText({
    getNote: () => "<p>Before &#x110000; middle &#xD800; after &#x1F600;</p>",
  });
  assert.equal(content, "Before &#x110000; middle &#xD800; after 😀");
});

test("collection canvas stores Zotero Notes by native key with copied content", (t) => {
  const previous = (globalThis as { Zotero?: unknown }).Zotero;
  let attachmentReads = 0;
  const note = {
    id: 77,
    key: "NOTE2345",
    libraryID: 1,
    parentItem: null as Zotero.Item | null,
    isRegularItem: () => false,
    isNote: () => true,
    isAnnotation: () => false,
    isAttachment: () => false,
    getNote: () => "<p>Copied <strong>research note</strong></p>",
    getNoteTitle: () => "Research note",
  };
  const regular = {
    id: 11,
    key: "ABCD2345",
    libraryID: 1,
    firstCreator: "Ada Lovelace",
    parentItem: null,
    isRegularItem: () => true,
    isNote: () => false,
    isAnnotation: () => false,
    isAttachment: () => false,
    getField: (field: string) =>
      field === "title" ? "Paper" : field === "date" ? "2026" : "",
    getDisplayTitle: () => "Paper",
    getCreators: () => [],
    getTags: () => [],
    getAttachments: () => {
      attachmentReads += 1;
      return [88];
    },
    getNotes: () => [77],
  };
  const pdf = {
    id: 88,
    key: "PDF23456",
    libraryID: 1,
    parentItem: regular,
    attachmentContentType: "application/pdf",
    attachmentFilename: "paper.pdf",
    isRegularItem: () => false,
    isNote: () => false,
    isAnnotation: () => false,
    isAttachment: () => true,
  };
  note.parentItem = regular as unknown as Zotero.Item;
  (globalThis as { Zotero?: unknown }).Zotero = {
    Items: {
      get: (id: number) => (id === 77 ? note : id === 88 ? pdf : undefined),
    },
    Libraries: {
      userLibraryID: 1,
      get: () => ({ libraryType: "user" }),
    },
    Groups: { get: () => undefined },
    Utilities: {
      cleanTags: (html: string) => html.replace(/<[^>]*>/g, ""),
      unescapeHTML: (html: string) => html,
    },
  };
  t.after(() => {
    (globalThis as { Zotero?: unknown }).Zotero = previous;
  });

  const document = buildCollectionCanvas({
    getChildItems: () => [regular],
  } as Zotero.Collection);

  assert.equal(document.version, 2);
  assert.equal(document.nodes[0].kind, "literature");
  assert.deepEqual(
    document.nodes[0].kind === "literature" && document.nodes[0].source,
    {
      library: { type: "user" },
      itemKey: "ABCD2345",
    },
  );
  assert.equal(JSON.stringify(document).includes("itemID"), false);
  assert.equal(attachmentReads, 0);
  assert.equal(
    document.nodes.some((node) => node.kind === "pdf"),
    false,
  );
  const academicNote = document.nodes.find((node) => node.kind === "note");
  assert.ok(academicNote && academicNote.kind === "note");
  assert.equal(academicNote.content, "Copied research note");
  assert.equal("noteID" in academicNote, false);
  assert.deepEqual(academicNote.source, {
    library: { type: "user" },
    noteKey: "NOTE2345",
    itemKey: "ABCD2345",
  });
  assert.ok(
    academicNote.position.y >=
      document.nodes[0].position.y + document.nodes[0].height,
  );
  assert.deepEqual(document.connections[0], {
    id: "col-item-0-e-note",
    kind: "basic",
    source: "col-item-0",
    target: "col-item-0-note",
  });

  note.getNote = () => "";
  note.getNoteTitle = () => "";
  const emptyNoteDocument = buildCollectionCanvas({
    getChildItems: () => [regular],
  } as Zotero.Collection);
  const emptyNote = emptyNoteDocument.nodes.find(
    (node) => node.kind === "note",
  );
  assert.ok(emptyNote && emptyNote.kind === "note");
  assert.equal(emptyNote.content, "");
  assert.equal(JSON.stringify(emptyNoteDocument).includes("Empty note"), false);
});

test("host snapshot is a compatibility re-export rather than a schema", () => {
  const source = readFileSync(
    new URL("../src/modules/whiteboard/snapshot.ts", import.meta.url),
    "utf8",
  );
  for (const module of ["document", "basic", "academic", "connection"]) {
    assert.match(source, new RegExp(`/model/${module}"`));
  }
  assert.equal(source.match(/^export \* from/gm)?.length, 4);
});

test("the retired package schema authority is absent", () => {
  const retiredSchema = new URL(
    "../packages/whiteboard/src/model/snapshot.ts",
    import.meta.url,
  );
  assert.equal(existsSync(retiredSchema), false);
});
