import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReactFlowProvider } from "@xyflow/react";
import {
  drawNodeKind,
  drawNodeStyle,
  frameFromDrag,
  isBorderHit,
} from "../packages/whiteboard/src/chrome/draw.ts";
import { RectNode } from "../packages/whiteboard/src/nodes/shapes.tsx";
import {
  canvasDocumentToFile,
  canvasFileToDocument,
} from "../packages/whiteboard/src/model/canvas-file.ts";
import { parseCanvasDocument } from "../packages/whiteboard/src/model/document.ts";
import type { CanvasDocument } from "../packages/whiteboard/src/model/document.ts";
import { buildCanvasSvg } from "../packages/whiteboard/src/whiteboard/export.ts";

test("shape variants preserve a rect node and provide their style", () => {
  assert.equal(drawNodeKind("roundedRect"), "rect");
  assert.equal(drawNodeKind("diamond"), "rect");
  assert.equal(drawNodeKind("ellipse"), "ellipse");
  assert.deepEqual(drawNodeStyle("rect"), { radius: 0 });
  assert.deepEqual(drawNodeStyle("roundedRect"), { radius: 16 });
  assert.deepEqual(drawNodeStyle("diamond"), {
    shape: "diamond",
    radius: 0,
  });
});

test("shift drawing constrains every area shape to a square", () => {
  const frame = frameFromDrag(
    { x: 80, y: 90 },
    { x: 30, y: 120 },
    { kind: "diamond", shift: true },
  );
  assert.deepEqual(frame.position, { x: 30, y: 90 });
  assert.equal(frame.width, 50);
  assert.equal(frame.height, 50);
});

test("diamond border hit testing leaves the text center editable", () => {
  const box = {
    width: 120,
    height: 80,
    kind: "rect" as const,
    shape: "diamond" as const,
  };
  assert.equal(isBorderHit({ x: 60, y: 40 }, box), false);
  assert.equal(isBorderHit({ x: 60, y: 4 }, box), true);
  assert.equal(isBorderHit({ x: 4, y: 4 }, box), true);
});

test("diamond nodes render an SVG border and an inner label region", () => {
  const model = {
    id: "diamond-1",
    kind: "rect" as const,
    position: { x: 0, y: 0 },
    width: 120,
    height: 80,
    data: { title: "Go" },
    style: { shape: "diamond" as const, stroke: "#111827" },
  };
  const markup = renderToStaticMarkup(
    createElement(
      ReactFlowProvider,
      null,
      createElement(RectNode, {
        data: { model },
        selected: false,
      } as never),
    ),
  );
  assert.match(markup, /class="zmd-board-shape is-diamond"/);
  assert.match(markup, /<polygon points="50,1 99,50 50,99 1,50"/);
  assert.match(markup, /class="zmd-board-shape-label"/);
});

test("diamond SVG export uses polygon geometry and a diamond text clip", () => {
  const document: CanvasDocument = {
    version: 2,
    nodes: [
      {
        id: "diamond-1",
        kind: "rect",
        position: { x: 10, y: 20 },
        width: 120,
        height: 80,
        data: { title: "Go" },
        style: { shape: "diamond", stroke: "#111827", fill: "#fff" },
      },
    ],
    connections: [],
  };
  const svg = buildCanvasSvg(document);
  assert.match(svg, /<polygon points="70,20 130,60 70,100 10,60"/);
  assert.match(
    svg,
    /<clipPath id="canvas-node-clip-0"><polygon points="70,20 130,60 70,100 10,60"\/>/,
  );
  assert.match(svg, />Go<\/tspan>/);
});

test("diamond style survives document parsing and canvas-file round trips", () => {
  const raw = {
    version: 2,
    nodes: [
      {
        id: "diamond-1",
        kind: "rect",
        position: { x: 10, y: 20 },
        width: 120,
        height: 80,
        data: { title: "Go" },
        style: { shape: "diamond", radius: 0 },
      },
    ],
    connections: [],
  };
  const parsed = parseCanvasDocument(raw).document;
  assert.equal(parsed.nodes[0]?.style?.shape, "diamond");
  const reloaded = canvasFileToDocument(
    canvasDocumentToFile(parsed, { now: "2026-09-24T00:00:00.000Z" }),
  ).document;
  assert.equal(reloaded.nodes[0]?.style?.shape, "diamond");
});

test("stroke labels anchor to the actual segment midpoint", async () => {
  const { ArrowNode } =
    await import("../packages/whiteboard/src/nodes/shapes.tsx");
  const markup = renderToStaticMarkup(
    createElement(
      ReactFlowProvider,
      null,
      createElement(ArrowNode, {
        id: "offset-arrow",
        width: 200,
        height: 300,
        data: {
          model: {
            id: "offset-arrow",
            kind: "arrow",
            position: { x: 0, y: 0 },
            width: 200,
            height: 300,
            data: {
              title: "Evidence",
              from: { x: 20, y: 40 },
              to: { x: 180, y: 240 },
            },
          },
        },
      } as never),
    ),
  );
  assert.match(
    markup,
    /class="zmd-board-stroke-label" style="left:100px;top:140px"/,
  );
  assert.match(markup, /zmd-board-stroke-label-text/);
});
