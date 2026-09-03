import assert from "node:assert/strict";
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
    annotations: "annotations-localized",
  } as WhiteboardLabels,
  {
    get: (target, property) =>
      Reflect.get(target, property) ?? `localized-${String(property)}`,
  },
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
  assert.match(literature, /7 annotations-localized/);

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
