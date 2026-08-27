import assert from "node:assert/strict";
import test from "node:test";
import {
  CLICK_THRESHOLD,
  frameFromDrag,
  isBorderHit,
  isDrawTool,
  isStampTool,
  toolAfterDraw,
} from "../packages/whiteboard/src/chrome/draw.ts";
import { KEYBOARD_SHORTCUTS } from "../packages/whiteboard/src/chrome/shortcuts.ts";
import { isEditableControl } from "../packages/whiteboard/src/chrome/TextStyleBar.tsx";

test("rect drag down-right uses origin as top-left", () => {
  const frame = frameFromDrag(
    { x: 10, y: 20 },
    { x: 110, y: 80 },
    {
      kind: "rect",
    },
  );
  assert.deepEqual(frame.position, { x: 10, y: 20 });
  assert.equal(frame.width, 100);
  assert.equal(frame.height, 60);
});

test("rect drag up-left still yields a positive box", () => {
  const frame = frameFromDrag(
    { x: 110, y: 80 },
    { x: 10, y: 20 },
    {
      kind: "rect",
    },
  );
  assert.deepEqual(frame.position, { x: 10, y: 20 });
  assert.equal(frame.width, 100);
  assert.equal(frame.height, 60);
});

test("shift+rect locks a square from the origin corner", () => {
  const frame = frameFromDrag(
    { x: 0, y: 0 },
    { x: 40, y: 10 },
    {
      kind: "rect",
      shift: true,
    },
  );
  assert.deepEqual(frame.position, { x: 0, y: 0 });
  assert.equal(frame.width, 40);
  assert.equal(frame.height, 40);
});

test("tiny pointer move is a click and uses the default box", () => {
  const frame = frameFromDrag(
    { x: 50, y: 50 },
    { x: 52, y: 51 },
    {
      kind: "ellipse",
    },
  );
  assert.ok(CLICK_THRESHOLD >= 3);
  assert.deepEqual(frame.position, { x: 50, y: 50 });
  assert.equal(frame.width, 120);
  assert.equal(frame.height, 80);
});

test("line drag stores local endpoints inside the bounding box", () => {
  const frame = frameFromDrag(
    { x: 0, y: 0 },
    { x: 80, y: 40 },
    {
      kind: "line",
    },
  );
  assert.deepEqual(frame.position, { x: 0, y: 0 });
  assert.equal(frame.width, 80);
  assert.equal(frame.height, 40);
  assert.deepEqual(frame.start, { x: 0, y: 0 });
  assert.deepEqual(frame.end, { x: 80, y: 40 });
});

test("shift+arrow snaps to 45 degree increments", () => {
  const frame = frameFromDrag(
    { x: 0, y: 0 },
    { x: 100, y: 10 },
    {
      kind: "arrow",
      shift: true,
    },
  );
  assert.deepEqual(frame.start, { x: 0, y: 0 });
  assert.deepEqual(frame.end, { x: 100, y: 0 });
  assert.equal(frame.height, 0);
  assert.equal(frame.width, 100);
});

test("classifies draw tools vs stamp tools", () => {
  assert.equal(isDrawTool("rect"), true);
  assert.equal(isDrawTool("arrow"), true);
  assert.equal(isDrawTool("text"), false);
  assert.equal(isStampTool("item"), true);
  assert.equal(isStampTool("text"), true);
  assert.equal(isStampTool("rect"), false);
});

test("draw tools return to select after a shape is placed", () => {
  assert.equal(toolAfterDraw("rect"), "select");
  assert.equal(toolAfterDraw("ellipse"), "select");
  assert.equal(toolAfterDraw("line"), "select");
  assert.equal(toolAfterDraw("arrow"), "select");
});

test("rect center is interior, near-edge is border", () => {
  const box = { width: 100, height: 80, kind: "rect" as const };
  assert.equal(isBorderHit({ x: 50, y: 40 }, box), false);
  assert.equal(isBorderHit({ x: 2, y: 40 }, box), true);
  assert.equal(isBorderHit({ x: 98, y: 10 }, box), true);
});

test("ellipse rim is border and interior is not", () => {
  const box = { width: 100, height: 80, kind: "ellipse" as const };
  assert.equal(isBorderHit({ x: 50, y: 40 }, box), false);
  assert.equal(isBorderHit({ x: 98, y: 40 }, box), true);
});

test("lines and arrows are always border hits", () => {
  const box = { width: 120, height: 16, kind: "line" as const };
  assert.equal(isBorderHit({ x: 60, y: 8 }, box), true);
});

test("shortcut help lists core drawing keys", () => {
  const keys = KEYBOARD_SHORTCUTS.map((item) => item.keys);
  assert.ok(keys.includes("V"));
  assert.ok(keys.includes("R"));
  assert.ok(keys.includes("Esc"));
});

test("font and size dropdowns are treated as native menu targets", () => {
  const select = {
    closest: (sel: string) => (sel.includes("select") ? {} : null),
  };
  const button = { closest: () => null };
  assert.equal(isEditableControl(select as unknown as EventTarget), true);
  assert.equal(isEditableControl(button as unknown as EventTarget), false);
});
