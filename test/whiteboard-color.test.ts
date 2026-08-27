import assert from "node:assert/strict";
import test from "node:test";
import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
} from "../packages/whiteboard/src/chrome/color.ts";

test("normalizes 3 and 6 digit hex colors", () => {
  assert.equal(normalizeHex("#fff"), "#ffffff");
  assert.equal(normalizeHex("1f2937"), "#1f2937");
  assert.equal(normalizeHex("not-a-color"), null);
});

test("round-trips black, white, and red through hsv", () => {
  assert.equal(hsvToHex(hexToHsv("#000000")), "#000000");
  assert.equal(hsvToHex(hexToHsv("#ffffff")), "#ffffff");
  assert.equal(hsvToHex(hexToHsv("#ff0000")), "#ff0000");
});
