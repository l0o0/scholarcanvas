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
import type { WhiteboardTheme } from "../packages/whiteboard/src/model/protocol.ts";
import {
  StyleBar,
  supportsFillStyle,
  supportsRadiusStyle,
} from "../packages/whiteboard/src/chrome/StyleBar.tsx";
import { TextStyleBar } from "../packages/whiteboard/src/chrome/TextStyleBar.tsx";
import {
  canvasNodeTypes,
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

const canvasCss = readFileSync(
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

function renderStyleBar(model: CanvasNode, theme: WhiteboardTheme = "light") {
  return renderToStaticMarkup(
    createElement(StyleBar, {
      node: {
        id: model.id,
        type: model.kind,
        position: model.position,
        data: { model },
        width: model.width,
        height: model.height,
      },
      left: 0,
      top: 0,
      labels,
      theme,
      onChange: () => {},
    }),
  );
}

function renderTextStyleBar(
  model: CanvasNode,
  theme: WhiteboardTheme = "light",
) {
  return renderToStaticMarkup(
    createElement(TextStyleBar, {
      node: {
        id: model.id,
        type: model.kind,
        position: model.position,
        data: { model },
        width: model.width,
        height: model.height,
      },
      left: 0,
      top: 0,
      labels,
      theme,
      onChange: () => {},
    }),
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
    assert.ok(canvasNodeTypes[kind]);
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
    assert.ok(canvasNodeTypes[kind]);
  }
});

test("card shells keep React Flow handles visible beyond their border", () => {
  const cardRule = canvasCss.match(/\.zmd-board-card\s*\{([^}]*)\}/)?.[1];
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
  const cardRule = canvasCss.match(/\.zmd-board-card\s*\{([^}]*)\}/)?.[1];
  const bodyRule = canvasCss.match(/\.zmd-board-card-body\s*\{([^}]*)\}/)?.[1];
  const footerRule = canvasCss.match(
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
    const rule = canvasCss.match(
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
    canvasCss,
    /\.zmd-board-card\.is-literature \.zmd-board-card-body\s*>\s*\*,\s*\.zmd-board-card\.is-quote \.zmd-board-card-body\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0/s,
  );
  assert.match(
    canvasCss,
    /\.zmd-board-card-footer\s*\{[^}]*overflow-wrap:\s*anywhere/s,
  );
  assert.match(
    canvasCss,
    /\.zmd-board-card\.is-literature \.zmd-board-card-body \.zmd-board-card-meta\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*-webkit-line-clamp:\s*1/s,
  );
  assert.match(
    canvasCss,
    /\.zmd-board-card-comment\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*-webkit-line-clamp:\s*1/s,
  );
  assert.match(
    canvasCss,
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

test("Academic cards render non-default canonical surface and text styles", () => {
  const style = {
    stroke: "#123456",
    fill: "#fef3c7",
    strokeWidth: 4,
    radius: 16,
    dashed: true,
    fontFamily: "Georgia, serif",
    fontSize: 24,
    fontWeight: "bold" as const,
    fontStyle: "italic" as const,
    textDecoration: "underline" as const,
    textAlign: "right" as const,
    verticalAlign: "bottom" as const,
    textColor: "#102030",
    textOpacity: 0.6,
  };
  const note = renderNode({
    ...createAcademicNode("note", { x: 0, y: 0 }, "styled-note"),
    content: "Styled note",
    style,
  });

  assert.match(note, /--zmd-board-node-stroke:#123456/);
  assert.match(note, /--zmd-board-node-fill:#fef3c7/);
  assert.match(note, /--zmd-board-node-stroke-width:4px/);
  assert.match(note, /--zmd-board-node-stroke-style:dashed/);
  assert.match(note, /--zmd-board-node-radius:16px/);
  assert.match(
    note,
    /class="zmd-board-card-body" style="justify-content:flex-end"/,
  );
  assert.match(
    note,
    /class="zmd-board-card-content" style="[^"]*font-family:Georgia, serif[^"]*font-size:24px[^"]*font-weight:bold[^"]*font-style:italic[^"]*text-decoration:underline[^"]*text-align:right[^"]*color:#102030[^"]*opacity:0\.6/,
  );

  const cardRule = canvasCss.match(/\.zmd-board-card\s*\{([^}]*)\}/)?.[1];
  assert.ok(cardRule, "missing styled card rule");
  for (const variable of [
    "--zmd-board-node-stroke",
    "--zmd-board-node-fill",
    "--zmd-board-node-stroke-width",
    "--zmd-board-node-stroke-style",
    "--zmd-board-node-radius",
  ]) {
    assert.match(cardRule, new RegExp(`var\\(${variable}`));
  }
});

test("Frames render the same canonical surface, text, and vertical styles", () => {
  const frame = renderNode({
    ...createAcademicNode("frame", { x: 0, y: 0 }, "styled-frame"),
    title: "Styled boundary",
    style: {
      stroke: "#7c3aed",
      fill: "#ede9fe",
      strokeWidth: 2,
      strokeStyle: "dotted",
      radius: 32,
      fontFamily: "Menlo, monospace",
      fontSize: 18,
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "line-through",
      textAlign: "center",
      verticalAlign: "middle",
      textColor: "#312e81",
      textOpacity: 0.75,
    },
  });

  assert.match(frame, /--zmd-board-node-stroke:#7c3aed/);
  assert.match(frame, /--zmd-board-node-fill:#ede9fe/);
  assert.match(frame, /--zmd-board-node-stroke-style:dotted/);
  assert.match(frame, /--zmd-board-node-radius:32px/);
  assert.match(frame, /justify-content:center/);
  assert.match(
    frame,
    /<h3 style="[^"]*font-family:Menlo, monospace[^"]*font-size:18px[^"]*font-weight:bold[^"]*font-style:italic[^"]*text-decoration:line-through[^"]*text-align:center[^"]*color:#312e81[^"]*opacity:0\.75[^"]*">Styled boundary<\/h3>/,
  );
  const frameRule = canvasCss.match(/\.zmd-board-frame\s*\{([^}]*)\}/)?.[1];
  assert.ok(frameRule, "missing styled frame rule");
  for (const variable of [
    "--zmd-board-node-stroke",
    "--zmd-board-node-fill",
    "--zmd-board-node-stroke-width",
    "--zmd-board-node-stroke-style",
    "--zmd-board-node-radius",
  ]) {
    assert.match(frameRule, new RegExp(`var\\(${variable}`));
  }
});

test("partial Frame styles resolve against the Frame surface defaults", () => {
  const frame = renderNode({
    ...createAcademicNode("frame", { x: 0, y: 0 }, "partial-frame"),
    style: { fillStyle: "hatch", strokeOpacity: 0.5 },
  });

  assert.match(frame, /--zmd-board-node-fill:transparent/);
  assert.match(
    frame,
    /--zmd-board-node-stroke:color-mix\(in srgb, var\(--zmd-board-border, #d1d5db\) 50%, transparent\)/,
  );
  assert.doesNotMatch(frame, /repeating-linear-gradient/);
});

test("selection style controls expose only surface properties the kind renders", () => {
  const note = createAcademicNode("note", { x: 0, y: 0 }, "note-style");
  const line = createBasicNode("line", { x: 0, y: 0 }, "line-style");
  const ellipse = createBasicNode("ellipse", { x: 0, y: 0 }, "ellipse-style");
  assert.equal(supportsFillStyle(note.kind), true);
  assert.equal(supportsRadiusStyle(note.kind), true);
  assert.equal(supportsFillStyle(line.kind), false);
  assert.equal(supportsRadiusStyle(line.kind), false);
  assert.equal(supportsRadiusStyle(ellipse.kind), false);

  const noteControls = renderStyleBar(note);
  const lineControls = renderStyleBar(line);
  assert.match(noteControls, />localized-background</);
  assert.match(noteControls, />localized-corners</);
  assert.doesNotMatch(lineControls, />localized-background</);
  assert.doesNotMatch(lineControls, />localized-corners</);
});

test("Basic shapes prefer canonical strokeStyle over the legacy dashed flag", () => {
  for (const kind of ["rect", "ellipse"] as const) {
    const solid = renderNode({
      ...createBasicNode(kind, { x: 0, y: 0 }, `${kind}-solid`),
      style: { dashed: true, strokeStyle: "solid" },
    });
    const dotted = renderNode({
      ...createBasicNode(kind, { x: 0, y: 0 }, `${kind}-dotted`),
      style: { strokeStyle: "dotted" },
    });

    assert.match(solid, /border-style:solid/);
    assert.doesNotMatch(solid, /border-style:dashed/);
    assert.match(dotted, /border-style:dotted/);
  }

  for (const kind of ["line", "arrow"] as const) {
    const solid = renderNode({
      ...createBasicNode(kind, { x: 0, y: 0 }, `${kind}-solid`),
      style: { dashed: true, strokeStyle: "solid" },
    });
    const dotted = renderNode({
      ...createBasicNode(kind, { x: 0, y: 0 }, `${kind}-dotted`),
      style: { strokeStyle: "dotted" },
    });

    assert.doesNotMatch(solid, /stroke-dasharray=/);
    assert.match(dotted, /stroke-dasharray="2 6"/);
  }
});

test("Basic shapes render canonical fillStyle and strokeOpacity", () => {
  const rect = renderNode({
    ...createBasicNode("rect", { x: 0, y: 0 }, "rect-surface"),
    style: {
      fill: "#abcdef",
      fillStyle: "hatch",
      stroke: "#123456",
      strokeOpacity: 0.5,
    },
  });
  const ellipse = renderNode({
    ...createBasicNode("ellipse", { x: 0, y: 0 }, "ellipse-surface"),
    style: { fill: "#abcdef", fillStyle: "none" },
  });
  const line = renderNode({
    ...createBasicNode("line", { x: 0, y: 0 }, "line-opacity"),
    style: { stroke: "#123456", strokeOpacity: 0.5 },
  });

  assert.match(rect, /background:repeating-linear-gradient\(135deg, #abcdef/);
  assert.match(
    rect,
    /border-color:color-mix\(in srgb, #123456 50%, transparent\)/,
  );
  assert.match(ellipse, /background:transparent/);
  assert.match(line, /color:color-mix\(in srgb, #123456 50%, transparent\)/);
});

test("Frame surface controls reflect its rendered default boundary", () => {
  const frameControls = renderStyleBar(
    createAcademicNode("frame", { x: 0, y: 0 }, "frame-default-style"),
  );
  const noteControls = renderStyleBar(
    createAcademicNode("note", { x: 0, y: 0 }, "note-default-style"),
  );

  assert.match(frameControls, /class="is-active"[^>]*aria-label="transparent"/);
  assert.match(frameControls, /<option value="1" selected="">1px<\/option>/);
  assert.doesNotMatch(
    frameControls,
    /class="is-active" style="background:#1f2937"/,
  );
  assert.match(
    noteControls,
    /class="is-active" style="background:#ffffff" aria-label="#ffffff"/,
  );
  assert.match(noteControls, /<option value="1" selected="">1px<\/option>/);
  assert.doesNotMatch(
    noteControls,
    /class="is-active" style="background:#1f2937"/,
  );
});

test("light surface controls retain canonical Frame and shape defaults", () => {
  const cases = [
    {
      node: createAcademicNode("frame", { x: 0, y: 0 }, "frame-light"),
      stroke: "#d1d5db",
    },
    {
      node: {
        ...createBasicNode("rect", { x: 0, y: 0 }, "rect-light"),
        style: undefined,
      },
      stroke: "#1f2937",
    },
    {
      node: {
        ...createBasicNode("line", { x: 0, y: 0 }, "line-light"),
        style: undefined,
      },
      stroke: "#1f2937",
    },
  ] as const;

  for (const { node, stroke } of cases) {
    const controls = renderStyleBar(node);
    assert.match(
      controls,
      new RegExp(
        `class="is-active" style="background:${stroke}" aria-label="${stroke}"`,
      ),
      node.kind,
    );
  }
});

test("Academic text controls reflect the reading-card defaults", () => {
  const noteControls = renderTextStyleBar(
    createAcademicNode("note", { x: 0, y: 0 }, "note-default-text"),
  );
  const frameControls = renderTextStyleBar(
    createAcademicNode("frame", { x: 0, y: 0 }, "frame-default-text"),
  );

  assert.match(noteControls, /<option value="12" selected="">12<\/option>/);
  assert.match(frameControls, /<option value="13" selected="">13<\/option>/);
});

test("unstyled renderers and controls resolve dark UI defaults without persisting them", () => {
  const text = createBasicNode("text", { x: 0, y: 0 }, "dark-text");
  const note = createAcademicNode("note", { x: 0, y: 0 }, "dark-note");
  const frame = createAcademicNode("frame", { x: 0, y: 0 }, "dark-frame");

  const textMarkup = renderNode(text);
  const noteMarkup = renderNode(note);
  const frameMarkup = renderNode(frame);
  assert.doesNotMatch(textMarkup, /color:#111827/);
  assert.doesNotMatch(noteMarkup, /#111827|#fff(?:fff)?/);
  assert.doesNotMatch(frameMarkup, /#111827|#fff(?:fff)?/);

  const textControls = renderTextStyleBar(text, "dark");
  const noteControls = renderStyleBar(note, "dark");
  const frameControls = renderStyleBar(frame, "dark");
  assert.match(
    textControls,
    /class="zmd-board-color-letter" style="color:#e8eaed"/,
  );
  assert.match(
    noteControls,
    /class="is-active" style="background:#3d4452" aria-label="#3d4452"/,
  );
  assert.match(
    noteControls,
    /class="is-active" style="background:#1a1d24" aria-label="#1a1d24"/,
  );
  assert.match(frameControls, /class="is-active"[^>]*aria-label="transparent"/);
  assert.equal(text.style, undefined);
  assert.equal(note.style, undefined);
  assert.equal(frame.style, undefined);
});

test("renders frame as a localized non-interactive boundary without handles", () => {
  const markup = renderNode({
    ...createAcademicNode("frame", { x: 0, y: 0 }, "frame-1"),
    title: "Study boundary",
  });
  assert.match(markup, />Localized frame</);
  assert.match(markup, /Study boundary/);
  assert.match(markup, /class="zmd-board-frame-title"/);
  assert.equal((markup.match(/zmd-board-frame-hit-edge/g) ?? []).length, 4);
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
