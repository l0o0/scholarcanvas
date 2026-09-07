import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasDocumentToFile,
  canvasFileToDocument,
} from "../packages/whiteboard/src/model/canvas-file.ts";
import { parseCanvasDocument } from "../packages/whiteboard/src/model/document.ts";
import {
  tutorialCanvasDocument,
  type TutorialCanvasLabels,
  type TutorialCanvasSample,
} from "../packages/whiteboard/src/model/tutorial.ts";

const english: TutorialCanvasLabels = {
  title: "Bamboo academic whiteboard",
  welcome: "Welcome",
  welcomeBody: "Follow this path to turn reading into connected thinking.",
  sourceNotice:
    "Sample cards come from your library; Bamboo does not change the source items.",
  addLiterature: "Add Literature",
  addLiteratureBody: "Drag a Zotero item onto the canvas.",
  browseQuotes: "Browse Quotes",
  browseQuotesBody: "Open the literature card and add useful excerpts.",
  writeNote: "Write a Note",
  writeNoteBody: "Start with a Question or Claim template, then edit it.",
  questionBadge: "Question",
  claimBadge: "Claim",
  organize: "Organize",
  organizeBody: "Group related cards in a Frame.",
  practice: "Practice",
  practiceBody: "Drag in another Zotero item and keep building.",
  supports: "supports",
};

const chinese: TutorialCanvasLabels = {
  title: "Bamboo 学术白板",
  welcome: "欢迎",
  welcomeBody: "沿着这条路径，把阅读变成相互连接的思考。",
  sourceNotice: "示例卡片来自你的文库；Bamboo 不会修改来源条目。",
  addLiterature: "添加文献",
  addLiteratureBody: "把 Zotero 条目拖到画布上。",
  browseQuotes: "浏览引文",
  browseQuotesBody: "打开文献卡片并添加有用的摘录。",
  writeNote: "写笔记",
  writeNoteBody: "从问题或论点模板开始，然后继续编辑。",
  questionBadge: "问题",
  claimBadge: "论点",
  organize: "整理",
  organizeBody: "用框架归拢相关卡片。",
  practice: "练习",
  practiceBody: "再拖入一个 Zotero 条目并继续构建。",
  supports: "支持",
};

const guidedIds = [
  "tutorial-title",
  "tutorial-welcome",
  "tutorial-source-notice",
  "tutorial-add-literature",
  "tutorial-browse-quotes",
  "tutorial-write-note",
  "tutorial-question",
  "tutorial-claim",
  "tutorial-organize",
  "tutorial-organize-body",
  "tutorial-practice",
  "tutorial-practice-body",
];

test("builds valid localized static tutorials along a stable guided path", () => {
  for (const labels of [english, chinese]) {
    const document = tutorialCanvasDocument(labels);
    const parsed = parseCanvasDocument(document);
    const byId = new Map(parsed.document.nodes.map((node) => [node.id, node]));

    assert.equal(parsed.issues.length, 0);
    assert.deepEqual(
      parsed.document.nodes.filter((node) => "source" in node),
      [],
    );
    assert.deepEqual(
      guidedIds.filter((id) => !byId.has(id)),
      [],
    );
    assert.ok(
      parsed.document.nodes.every((node) => node.id.startsWith("tutorial-")),
    );
    assert.ok(
      parsed.document.connections.every((edge) =>
        edge.id.startsWith("tutorial-"),
      ),
    );
    assert.ok(parsed.document.nodes.some((node) => node.kind === "frame"));
    assert.ok(
      parsed.document.connections.some(
        (connection) =>
          connection.kind === "academic" &&
          connection.relation === "supports" &&
          connection.label === labels.supports,
      ),
    );
    assert.deepEqual(parsed.document.viewport, { x: 40, y: 40, zoom: 0.85 });
    const visibleTop = -document.viewport!.y / document.viewport!.zoom;
    assert.ok(byId.get("tutorial-title")!.position.y >= visibleTop);
    assert.ok(byId.get("tutorial-welcome")!.position.y >= visibleTop);
    assert.ok(
      byId.get("tutorial-welcome")!.position.x <
        byId.get("tutorial-add-literature")!.position.x,
    );
    assert.ok(
      byId.get("tutorial-add-literature")!.position.x <
        byId.get("tutorial-browse-quotes")!.position.x,
    );
    assert.ok(
      byId.get("tutorial-browse-quotes")!.position.x <
        byId.get("tutorial-write-note")!.position.x,
    );
    assert.ok(
      byId.get("tutorial-write-note")!.position.x <
        byId.get("tutorial-organize")!.position.x,
    );
    assert.ok(
      byId.get("tutorial-organize")!.position.x <
        byId.get("tutorial-practice")!.position.x,
    );

    const title = byId.get("tutorial-title");
    assert.ok(title?.kind === "text");
    assert.equal(title.data.title, labels.title);
    assert.equal(title.style?.textColor, undefined);

    const welcome = byId.get("tutorial-welcome");
    assert.ok(welcome?.kind === "note");
    assert.equal(welcome.badge, labels.welcome);
    assert.equal(welcome.content, labels.welcomeBody);

    const sourceNotice = byId.get("tutorial-source-notice");
    assert.ok(sourceNotice?.kind === "text");
    assert.equal(sourceNotice.data.title, labels.sourceNotice);
    assert.equal(sourceNotice.style?.fill, "transparent");
    assert.equal(sourceNotice.style.textColor, undefined);

    for (const [id, badge, content] of [
      [
        "tutorial-add-literature",
        labels.addLiterature,
        labels.addLiteratureBody,
      ],
      ["tutorial-browse-quotes", labels.browseQuotes, labels.browseQuotesBody],
      ["tutorial-write-note", labels.writeNote, labels.writeNoteBody],
    ] as const) {
      const guide = byId.get(id);
      assert.ok(guide?.kind === "note");
      assert.equal(guide.badge, badge);
      assert.equal(guide.content, content);
    }

    const question = byId.get("tutorial-question");
    assert.ok(question?.kind === "note");
    assert.equal(question.badge, labels.questionBadge);
    assert.equal(question.content, "");
    const claim = byId.get("tutorial-claim");
    assert.ok(claim?.kind === "note");
    assert.equal(claim.badge, labels.claimBadge);
    assert.equal(claim.content, "");

    for (const id of [
      "tutorial-welcome",
      "tutorial-add-literature",
      "tutorial-browse-quotes",
      "tutorial-write-note",
      "tutorial-question",
      "tutorial-claim",
    ]) {
      const badgeNote = byId.get(id);
      assert.ok(badgeNote?.kind === "note" && badgeNote.badge);
      assert.equal(badgeNote.style?.fill, undefined);
      assert.equal(badgeNote.style?.textColor, undefined);
    }

    const organize = byId.get("tutorial-organize");
    assert.ok(organize?.kind === "frame");
    assert.equal(organize.title, labels.organize);
    assert.equal(organize.style?.textColor, undefined);
    const organizeBody = byId.get("tutorial-organize-body");
    assert.ok(organizeBody?.kind === "note");
    assert.equal(organizeBody.content, labels.organizeBody);

    const practice = byId.get("tutorial-practice");
    assert.ok(practice?.kind === "frame");
    assert.equal(practice.title, labels.practice);
    assert.equal(practice.style?.textColor, undefined);
    const practiceBody = byId.get("tutorial-practice-body");
    assert.ok(practiceBody?.kind === "note");
    assert.equal(practiceBody.content, labels.practiceBody);

    for (const connection of parsed.document.connections) {
      assert.notEqual(byId.get(connection.source)?.kind, "frame");
      assert.notEqual(byId.get(connection.target)?.kind, "frame");
    }
  }
});

test("copies and bounds real academic samples through a canvas-file round trip", () => {
  const sample: TutorialCanvasSample = {
    literature: {
      kind: "literature",
      source: { library: { type: "group", groupID: 42 }, itemKey: "ITEM1234" },
      snapshot: {
        title: "A real paper",
        creators: "Ada Lovelace",
        year: "1843",
        tags: ["history", "computing"],
        annotationCount: 3,
      },
    },
    quotes: [1, 2, 3].map((index) => ({
      kind: "quote" as const,
      source: {
        library: { type: "group" as const, groupID: 42 },
        itemKey: "ITEM1234",
        attachmentKey: "PDF12345",
        annotationKey: `ANNO000${index}`,
      },
      snapshot: {
        text: `Evidence ${index}`,
        comment: `Comment ${index}`,
        pageLabel: String(index),
        color: "#ffd400",
      },
    })),
    note: {
      kind: "note",
      source: {
        library: { type: "group", groupID: 42 },
        itemKey: "ITEM1234",
        noteKey: "NOTE1234",
      },
      sourceSnapshot: { title: "Child note" },
      content: "A supplied child note",
    },
  };

  const document = tutorialCanvasDocument(english, sample);
  const parsed = parseCanvasDocument(document);
  const literature = parsed.document.nodes.filter(
    (node) => node.kind === "literature",
  );
  const quotes = parsed.document.nodes.filter((node) => node.kind === "quote");
  const notes = parsed.document.nodes.filter(
    (node) => node.kind === "note" && "source" in node,
  );

  assert.deepEqual(parsed.issues, []);
  assert.equal(literature.length, 1);
  assert.equal(quotes.length, 2);
  assert.equal(notes.length, 1);
  assert.equal(literature[0].source.itemKey, "ITEM1234");
  assert.deepEqual(
    quotes.map((node) => node.source.annotationKey),
    ["ANNO0001", "ANNO0002"],
  );
  assert.equal(notes[0].source?.noteKey, "NOTE1234");
  assert.equal(notes[0].content, "A supplied child note");
  for (const node of [...literature, ...quotes, ...notes]) {
    assert.equal(node.style?.fill, undefined);
    assert.equal(node.style?.textColor, undefined);
    assert.equal(node.style?.stroke, "#60a5fa");
    assert.equal(node.style?.strokeWidth, 2);
  }
  assert.notEqual(literature[0].source, sample.literature.source);
  assert.notEqual(
    literature[0].source.library,
    sample.literature.source.library,
  );
  assert.notEqual(literature[0].snapshot, sample.literature.snapshot);
  assert.notEqual(literature[0].snapshot.tags, sample.literature.snapshot.tags);
  assert.notEqual(quotes[0].source, sample.quotes[0].source);
  assert.notEqual(quotes[0].snapshot, sample.quotes[0].snapshot);
  assert.notEqual(notes[0].source, sample.note!.source);
  assert.notEqual(notes[0].sourceSnapshot, sample.note!.sourceSnapshot);

  const styledNodes = document.nodes.filter((node) => node.style);
  assert.equal(
    new Set(styledNodes.map((node) => node.style)).size,
    styledNodes.length,
  );

  const reopened = canvasFileToDocument(
    canvasDocumentToFile(document, {
      title: english.title,
      now: "2026-09-07T00:00:00.000Z",
    }),
  );
  assert.deepEqual(reopened.issues, []);
  assert.deepEqual(reopened.document.nodes, document.nodes);
  assert.deepEqual(reopened.document.connections, document.connections);
  assert.deepEqual(reopened.document.viewport, document.viewport);
});
