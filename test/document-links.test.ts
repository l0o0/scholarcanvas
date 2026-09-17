import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDocumentLink,
  parseDocumentLink,
  parseWikiLink,
  searchLinkCandidates,
  type DocumentLinkCandidate,
} from "../src/modules/markdown/document-links.ts";
import { parseInlineL2 } from "../src/editor/live-preview/inline.ts";

test("accepts only the stable Zotero select URI shapes", () => {
  assert.deepEqual(
    parseDocumentLink("zotero://select/library/items/AB12CD34"),
    {
      scope: "library",
      key: "AB12CD34",
    },
  );
  assert.deepEqual(
    parseDocumentLink("zotero://select/groups/42/items/AB12CD34"),
    { scope: "group", groupID: 42, key: "AB12CD34" },
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,x",
    "zotero://select/library/items/AB12CD34/extra",
    "zotero://select/groups/0/items/AB12CD34",
    "zotero://select/groups/42/items/../AB12CD34",
    "zotero://select/library/items/short",
  ]) {
    assert.equal(parseDocumentLink(value), null, value);
  }
});

test("parses wiki links without treating image wikilinks as documents", () => {
  assert.deepEqual(parseWikiLink("[[Document]]"), {
    name: "Document",
    label: "Document",
  });
  assert.deepEqual(parseWikiLink("[[Document|Alias]]"), {
    name: "Document",
    label: "Alias",
  });
  assert.equal(parseWikiLink("![[image.png]]"), null);
  assert.equal(parseWikiLink("[[ ]"), null);
});

test("recognizes multiple wiki links on one line and ignores inline code", () => {
  const ranges = parseInlineL2(
    "`[[code]]` [[One]] [[Two|Alias]] ![[image.png]]",
  );
  assert.deepEqual(
    ranges.filter((range) => range.kind === "link").map((range) => range.href),
    ["[[One]]", "[[Two|Alias]]"],
  );
});

test("keeps links clickable when completion escapes a title", () => {
  const ranges = parseInlineL2(
    "[A \\[B\\]](zotero://select/library/items/AB12CD34)",
  );
  assert.deepEqual(
    ranges.filter((range) => range.kind === "link").map((range) => range.href),
    ["zotero://select/library/items/AB12CD34"],
  );
});

test("builds links from the target item's own key", () => {
  assert.equal(
    buildDocumentLink({ key: "ATTACH01", libraryID: 1, isGroup: false }),
    "zotero://select/library/items/ATTACH01",
  );
  assert.equal(
    buildDocumentLink({
      key: "CANVAS01",
      libraryID: 7,
      isGroup: true,
      groupID: 42,
    }),
    "zotero://select/groups/42/items/CANVAS01",
  );
});

test("marks duplicate titles as requiring explicit selection", () => {
  const candidates: DocumentLinkCandidate[] = [
    { key: "A", libraryID: 1, title: "Same", kind: "markdown", href: "a" },
    { key: "B", libraryID: 1, title: "Same", kind: "canvas", href: "b" },
    { key: "C", libraryID: 1, title: "Other", kind: "regular", href: "c" },
  ];
  assert.equal(searchLinkCandidates(candidates, "same").status, "ambiguous");
  assert.equal(
    searchLinkCandidates(candidates, "missing").status,
    "unresolved",
  );
  assert.equal(searchLinkCandidates(candidates, "other").status, "resolved");
  assert.equal(
    searchLinkCandidates(
      [
        {
          key: "D",
          libraryID: 1,
          title: "Other Document",
          kind: "regular",
          href: "d",
        },
      ],
      "other",
      true,
    ).status,
    "unresolved",
  );
});
