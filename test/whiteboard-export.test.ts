import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasNode } from "../packages/whiteboard/src/model/academic.ts";
import type { CanvasDocument } from "../packages/whiteboard/src/model/document.ts";
import {
  buildCanvasMarkdown,
  buildCanvasSvg,
  canvasNodeText,
  containGeometry,
  svgToPngDataUrl,
} from "../packages/whiteboard/src/whiteboard/export.ts";

function canonicalDocument(): CanvasDocument {
  return {
    version: 2,
    nodes: [
      {
        id: "claim-1",
        kind: "claim",
        position: { x: 720, y: 40 },
        width: 260,
        height: 128,
        content: "The result generalizes",
      },
      {
        id: "line-1",
        kind: "arrow",
        position: { x: 10, y: 20 },
        width: 100,
        height: 80,
        data: {
          title: "",
          from: { x: 5, y: 70 },
          to: { x: 95, y: 10 },
        },
        style: {
          stroke: "#123456",
          strokeWidth: 4,
          strokeStyle: "dotted",
          strokeOpacity: 0.6,
        },
      },
      {
        id: "quote-1",
        kind: "quote",
        position: { x: 400, y: 40 },
        width: 280,
        height: 192,
        source: {
          library: { type: "user" },
          itemKey: "ITEM1234",
          attachmentKey: "PDF12345",
          annotationKey: "ANNO1234",
        },
        snapshot: { text: "Evidence", pageLabel: "12" },
      },
      {
        id: "rect-1",
        kind: "rect",
        position: { x: 200, y: 40 },
        width: 160,
        height: 100,
        data: { title: "Context" },
        style: {
          stroke: "#654321",
          fill: "#abcdef",
          fillStyle: "hatch",
          strokeWidth: 3,
          strokeStyle: "dashed",
          radius: 18,
          fontFamily: `A&B "Serif"`,
          fontSize: 24,
          fontWeight: "bold",
          fontStyle: "italic",
          textDecoration: "underline",
          textAlign: "right",
          verticalAlign: "bottom",
          textColor: "#102030",
          textOpacity: 0.75,
        },
      },
      {
        id: "literature-1",
        kind: "literature",
        position: { x: 40, y: 280 },
        width: 280,
        height: 200,
        source: { library: { type: "user" }, itemKey: "ITEM1234" },
        snapshot: {
          title: `A paper & <archive> "edition"`,
          creators: "Ada & Bob",
          year: "2026",
        },
      },
      {
        id: "note-1",
        kind: "note",
        position: { x: 360, y: 280 },
        width: 260,
        height: 152,
        content: `First line\nSecond & <line> "quoted"`,
      },
      {
        id: "question-1",
        kind: "question",
        position: { x: 660, y: 280 },
        width: 260,
        height: 128,
        content: "Can **Markdown** stay raw?\nSecond line",
      },
      {
        id: "text-1",
        kind: "text",
        position: { x: 40, y: 520 },
        width: 240,
        height: 72,
        data: { title: "Context" },
      },
      {
        id: "ellipse-1",
        kind: "ellipse",
        position: { x: 320, y: 520 },
        width: 140,
        height: 88,
        data: { title: "Oval" },
      },
      {
        id: "frame-1",
        kind: "frame",
        position: { x: 0, y: 0 },
        width: 1040,
        height: 660,
        title: "Review <Frame>",
      },
    ],
    connections: [
      {
        id: "duplicate-1",
        kind: "basic",
        source: "rect-1",
        target: "text-1",
        arrow: false,
      },
      {
        id: "supports-1",
        kind: "academic",
        source: "quote-1",
        target: "claim-1",
        relation: "supports",
        color: "#2563eb",
      },
      {
        id: "styled-basic-1",
        kind: "basic",
        source: "line-1",
        target: "rect-1",
        color: "#fedcba",
        dashed: true,
        arrow: false,
      },
      {
        id: "missing-1",
        kind: "academic",
        source: "question-1",
        target: "missing-node",
        relation: "contradicts",
      },
    ],
  };
}

test("canonical node text covers every Basic and Academic kind", () => {
  const document = canonicalDocument();
  const expected = new Map<string, string>([
    ["claim-1", "The result generalizes"],
    ["line-1", ""],
    ["quote-1", "Evidence"],
    ["rect-1", "Context"],
    ["literature-1", `A paper & <archive> "edition"`],
    ["note-1", `First line\nSecond & <line> "quoted"`],
    ["question-1", "Can **Markdown** stay raw?\nSecond line"],
    ["text-1", "Context"],
    ["ellipse-1", "Oval"],
    ["frame-1", "Review <Frame>"],
  ]);

  for (const node of document.nodes) {
    assert.equal(canvasNodeText(node), expected.get(node.id));
  }

  const remainingBasicKinds = ["item", "pdf", "attachment", "line"] as const;
  for (const kind of remainingBasicKinds) {
    const node: CanvasNode = {
      id: `${kind}-1`,
      kind,
      position: { x: 0, y: 0 },
      width: 100,
      height: 80,
      data: { title: `${kind} title` },
    };
    assert.equal(canvasNodeText(node), `${kind} title`);
  }
});

test("Markdown groups Academic kinds, retains Basic objects, and describes relationships", () => {
  const document = canonicalDocument();
  const markdown = buildCanvasMarkdown(document);

  assert.match(markdown, /## Literature: A paper/);
  assert.match(markdown, /> Evidence/);
  assert.match(markdown, /Claim: The result generalizes/);
  assert.match(markdown, /supports: Evidence → The result generalizes/);
  assert.match(markdown, /## Other objects/);
  assert.match(markdown, /Arrow: arrow \[line-1\]/);
  assert.match(markdown, /connects: Context \[rect-1\] → Context \[text-1\]/);
  assert.match(
    markdown,
    /contradicts: Can \*\*Markdown\*\* stay raw\? Second line → \[missing: missing-node\]/,
  );
  assert.match(markdown, /First line\nSecond & <line> "quoted"/);
  assert.match(markdown, /Can \*\*Markdown\*\* stay raw\?/);
  assert.doesNotMatch(markdown, /<strong>|<p>|<blockquote>/);

  const orderedSections = [
    "## Literature:",
    "## Quote:",
    "## Note:",
    "## Question:",
    "## Claim:",
    "## Frame:",
    "## Other objects",
    "## Relationships",
  ];
  let previous = -1;
  for (const section of orderedSections) {
    const current = markdown.indexOf(section);
    assert.ok(current > previous, `${section} must be in canonical order`);
    previous = current;
  }

  assert.equal(
    buildCanvasMarkdown({
      ...document,
      nodes: [...document.nodes].reverse(),
      connections: [...document.connections].reverse(),
    }),
    markdown,
  );
});

test("SVG export keeps canonical geometry, XML escaping, styles, and semantic edges", () => {
  const svg = buildCanvasSvg(canonicalDocument());

  assert.match(svg, /A paper &amp; &lt;archive&gt; &quot;edition&quot;/);
  assert.match(svg, /Evidence/);
  assert.match(
    svg,
    /<tspan[^>]*>First line<\/tspan><tspan[^>]*>Second &amp; &lt;line&gt; &quot;quoted&quot;<\/tspan>/,
  );
  assert.match(svg, /data-relation="supports"/);
  assert.equal(svg.match(/data-relation=/g)?.length, 1);
  assert.ok(
    svg.indexOf("Review &lt;Frame&gt;") < svg.indexOf("A paper &amp;"),
    "Frame must render before ordinary nodes",
  );
  assert.ok(
    svg.indexOf('<rect x="0" y="0" width="1040" height="660"') <
      svg.indexOf('data-relation="supports"') &&
      svg.indexOf('data-relation="supports"') < svg.indexOf("A paper &amp;"),
    "Frame must stay behind both connections and ordinary nodes",
  );
  assert.match(
    svg,
    /<line x1="15" y1="90" x2="105" y2="30" stroke="#123456" stroke-width="4" stroke-opacity="0.6" stroke-dasharray="2 6" marker-end="url\(#canvas-arrow-\d+\)"\/>/,
  );
  assert.match(
    svg,
    /<ellipse cx="390" cy="564" rx="70" ry="44" fill="#ffffff" stroke="#1f2937" stroke-width="2"\/>/,
  );
  assert.match(
    svg,
    /<rect x="200" y="40" width="160" height="100" rx="18" fill="url\(#canvas-hatch-\d+\)" stroke="#654321" stroke-width="3" stroke-dasharray="12 9"\/>/,
  );
  assert.match(
    svg,
    /<text x="348" y="123\.2" font-family="A&amp;B &quot;Serif&quot;" font-size="24" font-weight="bold" font-style="italic" text-decoration="underline" text-anchor="end" fill="#102030" opacity="0\.75" clip-path="url\(#canvas-node-clip-4\)"><tspan x="348" y="123\.2">Context<\/tspan><\/text>/,
  );
  assert.match(
    svg,
    /stroke="#fedcba" stroke-width="1.5" stroke-dasharray="6 4"\/>/,
  );
  assert.doesNotMatch(svg, /stroke="#fedcba"[^>]*marker-end=/);
});

test("SVG export matches canonical stroke precedence and Frame defaults", () => {
  const svg = buildCanvasSvg({
    version: 2,
    nodes: [
      {
        id: "frame-defaults",
        kind: "frame",
        position: { x: 0, y: 0 },
        width: 320,
        height: 200,
        title: "Boundary",
      },
      {
        id: "solid-claim",
        kind: "claim",
        position: { x: 40, y: 40 },
        width: 200,
        height: 96,
        content: "Explicitly solid",
        style: { dashed: true, strokeStyle: "solid" },
      },
    ],
    connections: [],
  });

  assert.match(
    svg,
    /<rect x="0" y="0" width="320" height="200" rx="8" fill="none"[^>]*stroke-dasharray="12 9"/,
  );
  const claim = svg.match(
    /<rect x="40" y="40" width="200" height="96"[^>]*\/>/,
  )?.[0];
  assert.ok(claim, "missing explicitly solid Academic node");
  assert.doesNotMatch(claim, /stroke-dasharray=/);
});

test("SVG export keeps the reading-card default text layout", () => {
  const svg = buildCanvasSvg({
    version: 2,
    nodes: [
      {
        id: "default-note",
        kind: "note",
        position: { x: 20, y: 30 },
        width: 200,
        height: 100,
        content: "Default note",
      },
    ],
    connections: [],
  });

  assert.match(
    svg,
    /<text x="32" y="51\.6"[^>]*font-size="12"[^>]*font-weight="normal"[^>]*text-anchor="start"/,
  );
});

test("SVG export replaces forbidden XML characters in text and attributes", () => {
  const invalid = `before\u0001middle\ud800after`;
  const svg = buildCanvasSvg({
    version: 2,
    nodes: [
      {
        id: "invalid-xml",
        kind: "note",
        position: { x: 0, y: 0 },
        width: 240,
        height: 96,
        content: invalid,
        style: { fontFamily: `Safe\u0001Font`, fontSize: -10 },
      },
    ],
    connections: [],
  });

  assert.equal(svg.includes("\u0001"), false);
  assert.equal(svg.includes("\ud800"), false);
  assert.match(svg, /font-family="Safe�Font"/);
  assert.match(svg, /font-size="12"/);
  assert.match(svg, />before�middle�after<\/tspan>/);
});

test("SVG paint IDs stay unique when different colors sanitize alike", () => {
  const colors = ["hsl(1 23% 45%)", "hsl(12 3% 45%)"] as const;
  const nodes: CanvasNode[] = colors.flatMap((color, index) => [
    {
      id: `arrow-${index}`,
      kind: "arrow",
      position: { x: index * 160, y: 0 },
      width: 120,
      height: 48,
      data: { title: "" },
      style: { stroke: color },
    },
    {
      id: `hatch-${index}`,
      kind: "rect",
      position: { x: index * 160, y: 80 },
      width: 120,
      height: 64,
      data: { title: "" },
      style: { fill: color, fillStyle: "hatch" },
    },
  ]);
  const document: CanvasDocument = { version: 2, nodes, connections: [] };
  const svg = buildCanvasSvg(document);
  const markerIds = [...svg.matchAll(/<marker id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const patternIds = [...svg.matchAll(/<pattern id="([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.equal(markerIds.length, 2);
  assert.equal(patternIds.length, 2);
  assert.equal(new Set(markerIds).size, 2);
  assert.equal(new Set(patternIds).size, 2);
  for (const id of [...markerIds, ...patternIds]) {
    assert.match(id!, /^canvas-(?:arrow|hatch)-\d+$/);
  }
  assert.equal(buildCanvasSvg(document), svg);
});

test("SVG export wraps explicit lines and long tokens into positioned tspans", () => {
  const document: CanvasDocument = {
    version: 2,
    nodes: [
      {
        id: `unsafe-"><script>alert(1)</script>`,
        kind: "note",
        position: { x: 10, y: 20 },
        width: 104,
        height: 128,
        content:
          "Alpha beta gamma\nSUPERCALIFRAGILISTICEXPIALIDOCIOUS & <safe>",
        style: {
          fontSize: 12,
          textAlign: "left",
          verticalAlign: "top",
        },
      },
    ],
    connections: [],
  };

  const svg = buildCanvasSvg(document);
  const spans = [
    ...svg.matchAll(/<tspan x="22" y="([^"]+)">([^<]*)<\/tspan>/g),
  ];
  assert.ok(spans.length >= 4, "width wrapping must add visual lines");
  assert.equal(spans[0]?.[1], "41.6");
  assert.equal(Number(spans[1]?.[1]) - Number(spans[0]?.[1]), 15);
  assert.match(svg, /SUPERCAL/);
  assert.match(svg, /&amp; &lt;safe&gt;/);
  assert.match(
    svg,
    /<clipPath id="canvas-node-clip-0"><rect x="22" y="32" width="80" height="104"\/><\/clipPath>/,
  );
  assert.match(
    svg,
    /<text[^>]*clip-path="url\(#canvas-node-clip-0\)"[^>]*><tspan/,
  );
  assert.doesNotMatch(svg, /<script>|id="[^"]*script/i);
  assert.equal(buildCanvasSvg(document), svg, "wrapping must be deterministic");
});

test("SVG export limits lines by node height and positions vertical alignment", () => {
  const renderAt = (verticalAlign: "top" | "middle" | "bottom") =>
    buildCanvasSvg({
      version: 2,
      nodes: [
        {
          id: verticalAlign,
          kind: "claim",
          position: { x: 0, y: 100 },
          width: 180,
          height: 100,
          content: "First\nSecond",
          style: { fontSize: 20, textAlign: "center", verticalAlign },
        },
      ],
      connections: [],
    });
  const firstBaseline = (svg: string) => {
    const match = svg.match(/<tspan x="90" y="([^"]+)">First<\/tspan>/);
    assert.ok(match, "first line must be a positioned tspan");
    return Number(match[1]);
  };

  const top = firstBaseline(renderAt("top"));
  const middle = firstBaseline(renderAt("middle"));
  const bottom = firstBaseline(renderAt("bottom"));
  assert.ok(top < middle && middle < bottom);

  const clipped = buildCanvasSvg({
    version: 2,
    nodes: [
      {
        id: "short",
        kind: "question",
        position: { x: 0, y: 0 },
        width: 180,
        height: 49,
        content: "one\ntwo\nthree\nfour",
        style: { fontSize: 10, verticalAlign: "top" },
      },
    ],
    connections: [],
  });
  assert.equal(clipped.match(/<tspan\b/g)?.length, 2);
  assert.match(clipped, /height="25"/);
  assert.doesNotMatch(clipped, />three<\/tspan>|>four<\/tspan>/);
});

test("contain geometry preserves landscape and portrait aspect ratios", () => {
  assert.deepEqual(containGeometry(800, 400, 1600, 1200), {
    x: 0,
    y: 200,
    width: 1600,
    height: 800,
  });
  assert.deepEqual(containGeometry(400, 1200, 1600, 1200), {
    x: 600,
    y: 0,
    width: 400,
    height: 1200,
  });
});

test("PNG conversion keeps contain placement and URI encoding", async () => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const drawCalls: unknown[][] = [];
  let imageSource = "";

  class TestImage {
    naturalWidth = 800;
    naturalHeight = 400;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(value: string) {
      imageSource = value;
      queueMicrotask(() => this.onload?.());
    }
  }

  const context = {
    fillStyle: "",
    fillRect: (...args: unknown[]) => drawCalls.push(["fillRect", ...args]),
    drawImage: (...args: unknown[]) => drawCalls.push(["drawImage", ...args]),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: () => "data:image/png;base64,exported",
  };

  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: TestImage,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => canvas },
  });

  try {
    assert.equal(
      await svgToPngDataUrl("<svg>&</svg>"),
      "data:image/png;base64,exported",
    );
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 1200);
    assert.equal(context.fillStyle, "#fbfbfc");
    assert.deepEqual(drawCalls[0], ["fillRect", 0, 0, 1600, 1200]);
    assert.deepEqual(drawCalls[1]?.slice(2), [0, 200, 1600, 800]);
    assert.match(imageSource, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.match(imageSource, /%26/);
  } finally {
    if (originalImage) {
      Object.defineProperty(globalThis, "Image", originalImage);
    } else {
      Reflect.deleteProperty(globalThis, "Image");
    }
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  }
});
