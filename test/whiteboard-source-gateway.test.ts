import assert from "node:assert/strict";
import test from "node:test";
import {
  createZoteroSourceGateway,
  noteHtmlToText,
  type SourceGatewayDependencies,
} from "../src/modules/whiteboard/source-gateway.ts";

type Kind = "regular" | "note" | "annotation" | "attachment" | "other";

interface ItemFixture {
  id: number;
  key: string;
  libraryID: number;
  parentItem?: ItemFixture;
  attachmentContentType?: string;
  annotationType?: string;
  annotationText?: string;
  annotationComment?: string;
  annotationPosition?: string;
  annotationColor?: string;
  annotationPageLabel?: string;
  annotationSortIndex?: string;
  getField(field: string): string;
  getNote(): string;
  getNoteTitle(): string;
  getAttachments(): number[];
  getAnnotations(): ItemFixture[];
  isRegularItem(): boolean;
  isNote(): boolean;
  isAnnotation(): boolean;
  isAttachment(): boolean;
}

function item(
  kind: Kind,
  values: Partial<
    Omit<
      ItemFixture,
      | "getField"
      | "getNote"
      | "getNoteTitle"
      | "getAttachments"
      | "getAnnotations"
      | "isRegularItem"
      | "isNote"
      | "isAnnotation"
      | "isAttachment"
    >
  > & {
    fields?: Record<string, string>;
    note?: string;
    title?: string;
    attachments?: number[];
    annotations?: ItemFixture[];
  } = {},
): ItemFixture {
  const {
    fields = {},
    note = "",
    title = "",
    attachments = [],
    annotations = [],
    ...rest
  } = values;
  return {
    id: rest.id ?? 1,
    key: rest.key ?? "ITEMKEY",
    libraryID: rest.libraryID ?? 1,
    ...rest,
    getField: (field) => fields[field] ?? "",
    getNote: () => note,
    getNoteTitle: () => title,
    getAttachments: () => attachments,
    getAnnotations: () => annotations,
    isRegularItem: () => kind === "regular",
    isNote: () => kind === "note",
    isAnnotation: () => kind === "annotation",
    isAttachment: () => kind === "attachment",
  };
}

function dependencies(items: ItemFixture[] = []) {
  const opened: string[] = [];
  const pages: Array<{ key: string; pageIndex?: number }> = [];
  const byLibraryAndKey = new Map(
    items.map((value) => [`${value.libraryID}:${value.key}`, value]),
  );
  const deps: SourceGatewayDependencies = {
    userLibraryID: 1,
    getLibrary: (libraryID) =>
      libraryID === 1
        ? { libraryType: "user" }
        : libraryID === 2
          ? { libraryType: "group", groupID: 42 }
          : libraryID === 3
            ? { libraryType: "feed" }
            : null,
    groupLibraryID: (groupID) => (groupID === 42 ? 2 : null),
    getByLibraryAndKey: (libraryID, key) =>
      (byLibraryAndKey.get(`${libraryID}:${key}`) as Zotero.Item | undefined) ??
      null,
    cleanTags: (html) =>
      html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]*>/g, ""),
    unescapeHTML: (html) => html.replace(/&nbsp;/g, " "),
    openItem: async (value) => void opened.push(`item:${value.key}`),
    openNote: async (value) => void opened.push(`note:${value.key}`),
    openAnnotation: async () => false,
    openAttachmentPage: async (attachment, pageIndex) =>
      void pages.push({ key: attachment.key, pageIndex }),
  };
  return { deps, opened, pages, byLibraryAndKey };
}

test("acquires regular items with native group keys and a normalized snapshot", () => {
  const regular = item("regular", {
    key: "ITEMKEY",
    libraryID: 2,
    fields: {
      title: "Paper title",
      date: "2026-04-23",
      publicationTitle: "Journal",
      creators: "Ada Lovelace",
    },
  });
  const { deps } = dependencies([regular]);
  const gateway = createZoteroSourceGateway(deps);

  const literature = gateway.acquireItem(regular as Zotero.Item);

  assert.deepEqual(literature.source, {
    library: { type: "group", groupID: 42 },
    itemKey: "ITEMKEY",
  });
  assert.equal(literature.kind, "literature");
  assert.equal(literature.snapshot.title, "Paper title");
  assert.equal("annotationCount" in literature.snapshot, false);
  assert.deepEqual(literature.snapshot, {
    title: "Paper title",
    creators: "Ada Lovelace",
    year: "2026",
    publicationTitle: "Journal",
  });
});

test("classifies notes and annotations but rejects attachments and other kinds", () => {
  const parent = item("regular", { key: "PARENT" });
  const note = item("note", {
    key: "NOTE",
    parentItem: parent,
    note: "<p>Body</p>",
    title: "A note",
  });
  const attachment = item("attachment", {
    key: "PDF",
    parentItem: parent,
    attachmentContentType: "application/pdf",
  });
  const annotation = item("annotation", {
    key: "ANNOTATION",
    parentItem: attachment,
    annotationType: "highlight",
    annotationText: "Evidence",
  });
  const other = item("other");
  const feedRegular = item("regular", { key: "FEED", libraryID: 3 });
  const { deps } = dependencies([parent, note, attachment, annotation, other]);
  const gateway = createZoteroSourceGateway(deps);

  assert.deepEqual(gateway.acquireItem(note as Zotero.Item), {
    kind: "note",
    source: { library: { type: "user" }, noteKey: "NOTE", itemKey: "PARENT" },
    sourceSnapshot: { title: "A note" },
    content: "Body",
  });
  assert.deepEqual(gateway.acquireItem(annotation as Zotero.Item), {
    kind: "quote",
    source: {
      library: { type: "user" },
      itemKey: "PARENT",
      attachmentKey: "PDF",
      annotationKey: "ANNOTATION",
    },
    snapshot: { text: "Evidence" },
  });
  assert.throws(
    () => gateway.acquireItem(attachment as Zotero.Item),
    /unsupported/i,
  );
  assert.throws(
    () => gateway.acquireItem(other as Zotero.Item),
    /unsupported/i,
  );
  assert.throws(
    () => gateway.acquireItem(feedRegular as Zotero.Item),
    /unsupported/i,
  );
});

test("resolves only exact keys and reports a wrong resolved kind", async () => {
  const wrong = item("note", { key: "ITEMKEY" });
  const { deps, byLibraryAndKey } = dependencies([wrong]);
  const gateway = createZoteroSourceGateway(deps);

  const result = await gateway.resolve("node-1", 3, {
    kind: "literature",
    source: { library: { type: "user" }, itemKey: "ITEMKEY" },
  });

  assert.deepEqual(result, {
    nodeId: "node-1",
    generation: 3,
    status: "unavailable",
    code: "wrong-kind",
    message: "The Zotero item has a different kind.",
  });
  assert.equal(byLibraryAndKey.has("1:ITEMKEY"), true);
});

test("reports unavailable libraries and validates note parent keys", async () => {
  const wrongParent = item("regular", { key: "OTHER" });
  const note = item("note", { key: "NOTE", parentItem: wrongParent });
  const { deps } = dependencies([note, wrongParent]);
  const gateway = createZoteroSourceGateway(deps);

  assert.deepEqual(
    await gateway.resolve("node-1", 0, {
      kind: "literature",
      source: { library: { type: "group", groupID: 99 }, itemKey: "ITEM" },
    }),
    {
      nodeId: "node-1",
      generation: 0,
      status: "unavailable",
      code: "library-missing",
      message: "The Zotero library is unavailable.",
    },
  );
  assert.deepEqual(
    await gateway.resolve("node-2", 1, {
      kind: "note",
      source: { library: { type: "user" }, noteKey: "NOTE", itemKey: "PARENT" },
    }),
    {
      nodeId: "node-2",
      generation: 1,
      status: "unavailable",
      code: "parent-mismatch",
      message: "The Zotero item's parent has changed.",
    },
  );
});

test("validates the complete quote parent chain before resolving current fields", async () => {
  const regular = item("regular", { key: "ITEM" });
  const attachment = item("attachment", {
    key: "ATTACHMENT",
    parentItem: regular,
    attachmentContentType: "application/pdf",
  });
  const annotation = item("annotation", {
    key: "ANNOTATION",
    parentItem: attachment,
    annotationType: "underline",
    annotationText: "Current evidence",
    annotationComment: "Comment",
    annotationPageLabel: "12",
    annotationColor: "#ffd400",
  });
  const { deps } = dependencies([regular, attachment, annotation]);
  const gateway = createZoteroSourceGateway(deps);

  const result = await gateway.resolve("quote-1", 4, {
    kind: "quote",
    source: {
      library: { type: "user" },
      itemKey: "ITEM",
      attachmentKey: "ATTACHMENT",
      annotationKey: "ANNOTATION",
    },
  });

  assert.deepEqual(result, {
    nodeId: "quote-1",
    generation: 4,
    status: "resolved",
    acquisition: {
      kind: "quote",
      source: {
        library: { type: "user" },
        itemKey: "ITEM",
        attachmentKey: "ATTACHMENT",
        annotationKey: "ANNOTATION",
      },
      snapshot: {
        text: "Current evidence",
        comment: "Comment",
        pageLabel: "12",
        color: "#ffd400",
      },
    },
  });
});

test("rejects unsupported quote annotations during acquire, resolve, and open", async () => {
  const regular = item("regular", { key: "ITEM" });
  const pdf = item("attachment", {
    key: "PDF",
    parentItem: regular,
    attachmentContentType: "application/pdf",
  });
  const epub = item("attachment", {
    key: "EPUB",
    parentItem: regular,
    attachmentContentType: "application/epub+zip",
  });
  const webpage = item("attachment", {
    key: "WEB",
    parentItem: regular,
    attachmentContentType: "text/html",
  });
  const image = item("annotation", {
    key: "IMAGE",
    parentItem: pdf,
    annotationType: "image",
    annotationText: "Image annotation",
  });
  const ink = item("annotation", {
    key: "INK",
    parentItem: pdf,
    annotationType: "ink",
    annotationText: "Ink annotation",
  });
  const empty = item("annotation", {
    key: "EMPTY",
    parentItem: pdf,
    annotationType: "highlight",
    annotationText: "  ",
  });
  const epubHighlight = item("annotation", {
    key: "EPUB-HIGHLIGHT",
    parentItem: epub,
    annotationType: "highlight",
    annotationText: "EPUB text",
  });
  const webpageUnderline = item("annotation", {
    key: "WEB-UNDERLINE",
    parentItem: webpage,
    annotationType: "underline",
    annotationText: "Web text",
  });
  const { deps } = dependencies([
    regular,
    pdf,
    epub,
    webpage,
    image,
    ink,
    empty,
    epubHighlight,
    webpageUnderline,
  ]);
  const gateway = createZoteroSourceGateway(deps);

  for (const unsupported of [
    image,
    ink,
    empty,
    epubHighlight,
    webpageUnderline,
  ]) {
    assert.throws(
      () => gateway.acquireItem(unsupported as Zotero.Item),
      /unsupported|wrong-kind/i,
    );
  }
  assert.deepEqual(
    await gateway.resolve("quote-1", 0, {
      kind: "quote",
      source: {
        library: { type: "user" },
        itemKey: "ITEM",
        attachmentKey: "PDF",
        annotationKey: "IMAGE",
      },
    }),
    {
      nodeId: "quote-1",
      generation: 0,
      status: "unavailable",
      code: "wrong-kind",
      message: "The Zotero item has a different kind.",
    },
  );
  await assert.rejects(
    gateway.open({
      kind: "quote",
      source: {
        library: { type: "user" },
        itemKey: "ITEM",
        attachmentKey: "PDF",
        annotationKey: "EMPTY",
      },
    }),
    /wrong-kind/i,
  );
});

test("lists only non-empty PDF highlight and underline annotations in deterministic order", async () => {
  const regular = item("regular", { key: "ITEM" });
  const second = item("attachment", {
    key: "B",
    parentItem: regular,
    attachmentContentType: "application/pdf",
    fields: { title: "Second PDF" },
  });
  const first = item("attachment", {
    key: "A",
    parentItem: regular,
    attachmentContentType: "application/pdf",
    fields: { title: "First PDF" },
  });
  const later = item("annotation", {
    key: "LATER",
    parentItem: first,
    annotationType: "highlight",
    annotationText: "Later",
    annotationSortIndex: "00002",
  });
  const earlier = item("annotation", {
    key: "EARLIER",
    parentItem: first,
    annotationType: "underline",
    annotationText: "Earlier",
    annotationSortIndex: "00001",
  });
  const excluded = item("annotation", {
    key: "EMPTY",
    parentItem: second,
    annotationType: "highlight",
    annotationText: "  ",
    annotationSortIndex: "00000",
  });
  const supportedSecond = item("annotation", {
    key: "SECOND",
    parentItem: second,
    annotationType: "highlight",
    annotationText: "Second",
    annotationSortIndex: "00001",
  });
  const unrelatedLiterature = item("regular", { key: "UNRELATED" });
  const unrelatedAttachment = item("attachment", {
    key: "UNRELATED-PDF",
    parentItem: unrelatedLiterature,
    attachmentContentType: "application/pdf",
  });
  const unrelatedAnnotation = item("annotation", {
    key: "UNRELATED-ANNOTATION",
    parentItem: unrelatedAttachment,
    annotationType: "highlight",
    annotationText: "Unrelated",
    annotationSortIndex: "00000",
  });
  first.getAnnotations = () => [later, earlier];
  second.getAnnotations = () => [excluded, supportedSecond];
  unrelatedAttachment.getAnnotations = () => [unrelatedAnnotation];
  regular.getAttachments = () =>
    [second, first, unrelatedAttachment] as unknown as number[];
  const { deps } = dependencies([
    regular,
    first,
    second,
    later,
    earlier,
    excluded,
    supportedSecond,
    unrelatedLiterature,
    unrelatedAttachment,
    unrelatedAnnotation,
  ]);
  const gateway = createZoteroSourceGateway(deps);

  const candidates = await gateway.listAnnotations({
    library: { type: "user" },
    itemKey: "ITEM",
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.acquisition.source.annotationKey),
    ["EARLIER", "LATER", "SECOND"],
  );
  assert.deepEqual(
    candidates.map((candidate) => candidate.attachmentTitle),
    ["First PDF", "First PDF", "Second PDF"],
  );
  assert.equal(JSON.stringify(candidates).includes('"id"'), false);
});

test("lists numeric child attachment IDs through injected lookup", async () => {
  const regular = item("regular", { key: "ITEM" });
  const attachment = item("attachment", {
    id: 20,
    key: "PDF",
    parentItem: regular,
    attachmentContentType: "application/pdf",
    fields: { title: "PDF" },
  });
  const annotation = item("annotation", {
    key: "ANNOTATION",
    parentItem: attachment,
    annotationType: "highlight",
    annotationText: "Evidence",
    annotationSortIndex: "00001",
  });
  attachment.getAnnotations = () => [annotation];
  regular.getAttachments = () => [attachment.id];
  const { deps } = dependencies([regular, attachment, annotation]);
  const gateway = createZoteroSourceGateway(
    Object.assign(deps, {
      getByID: (id: number) => (id === attachment.id ? attachment : null),
    }),
  );

  const candidates = await gateway.listAnnotations({
    library: { type: "user" },
    itemKey: "ITEM",
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.acquisition.source.annotationKey),
    ["ANNOTATION"],
  );
});

test("converts Zotero note HTML and falls back to DOM text content only after utility failure", () => {
  const utilities = {
    cleanTags: (html: string) =>
      html
        .replace(/<br>/g, "\n")
        .replace(/<\/p>/g, "\n\n")
        .replace(/<[^>]+>/g, ""),
    unescapeHTML: (html: string) => html.replace(/&nbsp;/g, " "),
  };
  assert.equal(
    noteHtmlToText("<p>First&nbsp;line</p><p>Second<br>line</p>", utilities),
    "First line\n\nSecond\nline",
  );
  assert.equal(
    noteHtmlToText("<p>Fallback&nbsp;text</p>", {
      cleanTags: () => {
        throw new Error("unavailable");
      },
      unescapeHTML: utilities.unescapeHTML,
    }),
    "Fallback text",
  );
});

test("opens quotes through exact annotation navigation or the position page fallback", async () => {
  const regular = item("regular", { key: "ITEM" });
  const attachment = item("attachment", {
    key: "PDF",
    parentItem: regular,
    attachmentContentType: "application/pdf",
  });
  const annotation = item("annotation", {
    key: "ANNOTATION",
    parentItem: attachment,
    annotationPosition: '{"pageIndex":7}',
    annotationType: "highlight",
    annotationText: "Text",
  });
  const { deps, pages } = dependencies([regular, attachment, annotation]);
  const gateway = createZoteroSourceGateway(deps);

  await gateway.open({
    kind: "quote",
    source: {
      library: { type: "user" },
      itemKey: "ITEM",
      attachmentKey: "PDF",
      annotationKey: "ANNOTATION",
    },
  });

  assert.deepEqual(pages, [{ key: "PDF", pageIndex: 7 }]);
});
