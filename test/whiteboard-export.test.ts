import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBoardSvg,
  containGeometry,
} from "../packages/whiteboard/src/whiteboard/export.ts";
import type { BoardDocument } from "../packages/whiteboard/src/model/snapshot.ts";

test("SVG export keeps endpoints and document-defined shape, text, and edge styles", () => {
  const doc: BoardDocument = {
    v: 1,
    engine: "xyflow",
    nodes: [
      {
        id: "line-1",
        type: "arrow",
        position: { x: 10, y: 20 },
        width: 100,
        height: 80,
        data: {
          kind: "arrow",
          title: "",
          from: { x: 5, y: 70 },
          to: { x: 95, y: 10 },
          stroke: "#123456",
          strokeWidth: 4,
          strokeStyle: "dotted",
          strokeOpacity: 0.6,
        },
      },
      {
        id: "rect-1",
        type: "rect",
        position: { x: 200, y: 40 },
        width: 160,
        height: 100,
        data: {
          kind: "rect",
          title: `A&B <study> "quoted"`,
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
    ],
    edges: [
      {
        id: "edge-1",
        source: "line-1",
        target: "rect-1",
        color: "#fedcba",
        dashed: true,
        arrow: false,
      },
    ],
  };
  const svg = buildBoardSvg(doc);
  assert.match(
    svg,
    /<line x1="15" y1="90" x2="105" y2="30" stroke="#123456" stroke-width="4" stroke-opacity="0.6" stroke-dasharray="2 6" marker-end="url\(#arrow-123456\)"\/>/,
  );
  assert.match(
    svg,
    /<rect x="200" y="40" width="160" height="100" rx="18" fill="url\(#hatch-abcdef\)" stroke="#654321" stroke-width="3" stroke-dasharray="12 9"\/>/,
  );
  assert.match(
    svg,
    /<text x="348" y="128" font-family="A&amp;B &quot;Serif&quot;" font-size="24" font-weight="bold" font-style="italic" text-decoration="underline" text-anchor="end" fill="#102030" opacity="0.75">A&amp;B &lt;study&gt; &quot;quoted&quot;<\/text>/,
  );
  assert.match(
    svg,
    /stroke="#fedcba" stroke-width="1.5" stroke-dasharray="6 4"\/>/,
  );
  assert.doesNotMatch(svg, /stroke="#fedcba"[^>]*marker-end=/);
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
