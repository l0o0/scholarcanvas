import assert from "node:assert/strict";
import test from "node:test";
import {
  colorPalette,
  normalizeHex,
} from "../packages/whiteboard/src/chrome/color.ts";

test("normalizes 3 and 6 digit hex colors", () => {
  assert.equal(normalizeHex("#fff"), "#ffffff");
  assert.equal(normalizeHex("1f2937"), "#1f2937");
  assert.equal(normalizeHex("not-a-color"), null);
});

test("fill and stroke palettes share matching color families in reversed shade order", () => {
  const light = colorPalette(true);
  const dark = colorPalette(false);
  assert.equal(new Set(light).size, 18);
  assert.deepEqual(light.slice(0, 6), dark.slice(12));
  assert.deepEqual(light.slice(6, 12), dark.slice(6, 12));
  assert.deepEqual(light.slice(12), dark.slice(0, 6));
});
