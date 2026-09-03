import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "@xyflow/react";
import {
  WhiteboardLabelsProvider,
  useWhiteboardLabels,
} from "../packages/whiteboard/src/chrome/labels.tsx";
import {
  createAcademicNode,
  createBasicNode,
  demoCanvasDocument,
  type CanvasNode,
} from "../packages/whiteboard/src/model/index.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";
import {
  boardNodeTypes,
  getNodeSpec,
  listNodeSpecs,
} from "../packages/whiteboard/src/nodes/index.ts";

const labels = new Proxy(
  {
    kindLiterature: "Localized source",
    kindQuote: "Localized excerpt",
    kindNote: "Localized note",
    kindQuestion: "Localized question",
    kindClaim: "Localized claim",
    kindFrame: "Localized frame",
    annotationColor: "Localized annotation color",
    annotations: {
      one: "annotation-one-localized",
      other: "annotations-other-localized",
    },
  } as WhiteboardLabels,
  {
    get: (target, property) =>
      Reflect.get(target, property) ?? `localized-${String(property)}`,
  },
);

const boardCss = readFileSync(
  new URL("../packages/whiteboard/src/whiteboard/board.css", import.meta.url),
  "utf8",
);

function renderNode(model: CanvasNode) {
  const Component = getNodeSpec(model.kind).Component;
  return renderToStaticMarkup(
    createElement(
      WhiteboardLabelsProvider,
      { value: labels },
      createElement(
        ReactFlowProvider,
        null,
        createElement(Component, {
          id: model.id,
          type: model.kind,
          data: { model },
          selected: false,
          width: model.width,
          height: model.height,
        } as never),
      ),
    ),
  );
}

test("registers all academic and retained basic node kinds", () => {
  const kinds = listNodeSpecs().map((spec) => spec.kind);
  for (const kind of [
    "item",
    "pdf",
    "attachment",
    "text",
    "rect",
    "ellipse",
    "line",
    "arrow",
  ] as const) {
    assert.ok(kinds.includes(kind));
    assert.ok(boardNodeTypes[kind]);
  }
  for (const kind of [
    "literature",
    "quote",
    "note",
    "question",
    "claim",
    "frame",
  ] as const) {
    assert.equal(getNodeSpec(kind).group, "academic");
    assert.ok(boardNodeTypes[kind]);
  }
});

test("card shells keep React Flow handles visible beyond their border", () => {
  const cardRule = boardCss.match(/\.zmd-board-card\s*\{([^}]*)\}/)?.[1];
  assert.ok(cardRule, "missing card shell rule");
  assert.match(cardRule, /overflow:\s*visible/);
});

test("renders concise literature and quote snapshots with localized kinds", () => {
  const literature = renderNode(
    createAcademicNode("literature", { x: 0, y: 0 }, "literature-1", {
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      snapshot: {
        title: "A careful paper",
        creators: "Chen, Rivera",
        year: "2026",
        publicationTitle: "Journal of Careful Work",
        tags: ["methods", "fieldwork", "review", "hidden-fourth"],
        annotationCount: 7,
      },
    }),
  );
  assert.match(literature, />Localized source</);
  assert.match(literature, /A careful paper/);
  assert.match(literature, /Chen, Rivera/);
  assert.match(literature, /2026/);
  assert.match(literature, /Journal of Careful Work/);
  assert.match(literature, /methods/);
  assert.match(literature, /fieldwork/);
  assert.match(literature, /review/);
  assert.doesNotMatch(literature, /hidden-fourth/);
  assert.match(literature, /7 annotations-other-localized/);
  assert.match(
    literature,
    /class="zmd-board-card-footer"[^>]*>[\s\S]*7 annotations-other-localized/,
  );

  const quote = renderNode(
    createAcademicNode("quote", { x: 0, y: 0 }, "quote-1", {
      source: {
        library: { type: "user" },
        itemKey: "ITEM1234",
        attachmentKey: "PDF12345",
        annotationKey: "ANNO123",
      },
      snapshot: {
        text: "Evidence stays readable.",
        comment: "Follow this thread.",
        citation: "Chen 2026",
        pageLabel: "42",
        color: "#ffd400",
      },
    }),
  );
  assert.match(quote, />Localized excerpt</);
  assert.match(quote, /Evidence stays readable/);
  assert.match(quote, /Follow this thread/);
  assert.match(quote, /Chen 2026/);
  assert.match(quote, /42/);
  assert.match(quote, /background-color:#ffd400/);
  assert.match(quote, /aria-label="Localized annotation color: #ffd400"/);
  assert.doesNotMatch(quote, /zmd-board-quote-color[^>]*aria-hidden/);
  assert.match(
    quote,
    /class="zmd-board-card-footer"[^>]*>[\s\S]*Chen 2026 · 42/,
  );
});

test("literature annotation count selects the localized singular form", () => {
  const literature = renderNode(
    createAcademicNode("literature", { x: 0, y: 0 }, "literature-one", {
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      snapshot: { title: "One note", annotationCount: 1 },
    }),
  );
  assert.match(literature, /1 annotation-one-localized/);
  assert.doesNotMatch(literature, /1 annotations-other-localized/);
});

test("quote omits the color indicator when its snapshot has no color", () => {
  const quote = renderNode(
    createAcademicNode("quote", { x: 0, y: 0 }, "quote-no-color", {
      source: {
        library: { type: "user" },
        itemKey: "ITEM1234",
        attachmentKey: "PDF12345",
        annotationKey: "ANNO124",
      },
      snapshot: { text: "No source color." },
    }),
  );
  assert.doesNotMatch(quote, /zmd-board-quote-color/);
});

test("academic card bodies clip long copy without clipping provenance", () => {
  const cardRule = boardCss.match(/\.zmd-board-card\s*\{([^}]*)\}/)?.[1];
  const bodyRule = boardCss.match(/\.zmd-board-card-body\s*\{([^}]*)\}/)?.[1];
  const footerRule = boardCss.match(
    /\.zmd-board-card-footer\s*\{([^}]*)\}/,
  )?.[1];
  assert.ok(cardRule && bodyRule && footerRule);
  assert.match(cardRule, /display:\s*flex/);
  assert.match(cardRule, /flex-direction:\s*column/);
  assert.match(bodyRule, /display:\s*flex/);
  assert.match(bodyRule, /flex-direction:\s*column/);
  assert.match(bodyRule, /min-height:\s*0/);
  assert.match(bodyRule, /overflow:\s*hidden/);
  assert.match(footerRule, /flex:\s*0 0 auto/);
  for (const selector of [
    ".zmd-board-card-title",
    ".zmd-board-card-content",
    ".zmd-board-card-tags span",
  ]) {
    const rule = boardCss.match(
      new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{([^}]*)\\}`),
    )?.[1];
    assert.ok(rule, `missing ${selector} overflow rule`);
    assert.match(rule, /overflow(?:-wrap)?:\s*(?:hidden|anywhere)/);
  }
});

test("academic source defaults reserve complete priority lines without bulk", () => {
  const literature = createAcademicNode(
    "literature",
    { x: 0, y: 0 },
    "literature-sized",
    {
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      snapshot: { title: "Sized source" },
    },
  );
  const quote = createAcademicNode("quote", { x: 0, y: 0 }, "quote-sized", {
    source: {
      library: { type: "user" },
      itemKey: "ITEM1234",
      attachmentKey: "PDF12345",
      annotationKey: "ANNO123",
    },
    snapshot: { text: "Sized excerpt" },
  });

  // Border + vertical padding + the 12px kind line and its 8px gap.
  const cardChrome = 2 + 26 + 12 + 8;
  const bodyLine = 12 * 1.45;
  const literatureMinimum = Math.ceil(
    cardChrome +
      2 * 13 * 1.35 + // title: two complete lines
      2 * (6 + bodyLine) + // creators/year + publication
      (7 + 2 * 10 * 1.4 + 4) + // two tag rows and their row gap
      (6 + bodyLine), // annotation footer
  );
  const quoteMinimum = Math.ceil(
    cardChrome +
      (6 + 4 * bodyLine) + // primary excerpt
      (6 + bodyLine) + // secondary comment
      (6 + 2 * bodyLine), // provenance footer
  );

  assert.equal(literature.height, getNodeSpec("literature").defaultHeight);
  assert.equal(quote.height, getNodeSpec("quote").defaultHeight);
  assert.ok(literature.height >= literatureMinimum);
  assert.ok(literature.height <= 200);
  assert.ok(quote.height >= quoteMinimum);
  assert.ok(quote.height <= 192);
  const demoLiterature = demoCanvasDocument().nodes.find(
    (node) => node.kind === "literature",
  );
  const demoQuote = demoCanvasDocument().nodes.find(
    (node) => node.kind === "quote",
  );
  assert.equal(demoLiterature?.height, getNodeSpec("literature").defaultHeight);
  assert.equal(demoQuote?.height, getNodeSpec("quote").defaultHeight);
});

test("academic card layout prevents fractional lines and wraps provenance", () => {
  const longToken = `doi:${"10.1234/long-provenance-token".repeat(10)}`;
  const markup = renderNode(
    createAcademicNode("quote", { x: 0, y: 0 }, "quote-long", {
      source: {
        library: { type: "user" },
        itemKey: "ITEM1234",
        attachmentKey: "PDF12345",
        annotationKey: "ANNO123",
      },
      snapshot: {
        text: "Primary excerpt ".repeat(30),
        comment: longToken,
        citation: longToken,
        pageLabel: "42",
      },
    }),
  );
  assert.match(
    markup,
    new RegExp(
      `class="zmd-board-card-comment">${longToken.replaceAll("/", "\\/")}`,
    ),
  );
  assert.match(
    markup,
    /class="zmd-board-card-footer"[^>]*>[\s\S]*class="zmd-board-card-meta"/,
  );
  assert.match(
    boardCss,
    /\.zmd-board-card\.is-literature \.zmd-board-card-body\s*>\s*\*,\s*\.zmd-board-card\.is-quote \.zmd-board-card-body\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0/s,
  );
  assert.match(
    boardCss,
    /\.zmd-board-card-footer\s*\{[^}]*overflow-wrap:\s*anywhere/s,
  );
  assert.match(
    boardCss,
    /\.zmd-board-card\.is-literature \.zmd-board-card-body \.zmd-board-card-meta\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*-webkit-line-clamp:\s*1/s,
  );
  assert.match(
    boardCss,
    /\.zmd-board-card-comment\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*-webkit-line-clamp:\s*1/s,
  );
  assert.match(
    boardCss,
    /\.zmd-board-card-footer \.zmd-board-card-meta\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*-webkit-line-clamp:\s*2/s,
  );
});

test("renders local academic text as plain pre-wrapped content", () => {
  for (const kind of ["note", "question", "claim"] as const) {
    const model = {
      ...createAcademicNode(kind, { x: 0, y: 0 }, `${kind}-1`),
      content: "**plain research**\nsecond line",
    };
    const markup = renderNode(model);
    const labelKey = `kind${kind[0].toUpperCase()}${kind.slice(1)}`;
    assert.match(
      markup,
      new RegExp(`>${labels[labelKey as keyof WhiteboardLabels]}`),
    );
    assert.match(markup, /\*\*plain research\*\*/);
    assert.match(markup, /second line/);
    assert.match(markup, /white-space:pre-wrap/);
    assert.doesNotMatch(markup, /<strong>/);
  }
});

test("renders frame as a localized non-interactive boundary without handles", () => {
  const markup = renderNode({
    ...createAcademicNode("frame", { x: 0, y: 0 }, "frame-1"),
    title: "Study boundary",
  });
  assert.match(markup, />Localized frame</);
  assert.match(markup, /Study boundary/);
  assert.doesNotMatch(markup, /react-flow__handle/);
});

test("label hook rejects missing provider", () => {
  function Consumer() {
    useWhiteboardLabels();
    return null;
  }
  assert.throws(
    () => renderToStaticMarkup(createElement(Consumer)),
    /WhiteboardLabelsProvider/,
  );
});

test("every text-bearing draw node renders its requested vertical alignment", async (t) => {
  for (const kind of ["text", "rect", "ellipse", "line", "arrow"] as const) {
    await t.test(kind, () => {
      const model = {
        ...createBasicNode(kind, { x: 0, y: 0 }, `${kind}-1`),
        style: { verticalAlign: "top" as const },
        data: { title: "Aligned" },
      };
      const markup = renderNode(model);
      assert.match(markup, /align-items:flex-start/);
    });
  }
});

test("lists only Zotero picker nodes when filtered as library", () => {
  const library = listNodeSpecs("library").map((spec) => spec.kind);
  assert.deepEqual(library, ["item", "pdf", "attachment"]);
});
