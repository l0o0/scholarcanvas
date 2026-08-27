import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultBoardFilename,
  getExtension,
} from "../src/modules/whiteboard/detect.ts";

test("recognizes canvas and legacy board extensions", () => {
  assert.equal(getExtension("review.canvas"), "canvas");
  assert.equal(getExtension("Board-2026.board"), "board");
  assert.equal(getExtension("/tmp/notes/map.BOARD"), "board");
  assert.equal(getExtension("Board-2026.zmdboard"), "zmdboard");
  assert.equal(getExtension("/tmp/notes/map.ZMDBOARD"), "zmdboard");
  assert.equal(getExtension("plain.json"), "json");
});

test("new research canvases use the canvas suffix", () => {
  (globalThis as any).Zotero = {
    File: { getValidFileName: (value: string) => value },
  };
  const name = defaultBoardFilename("Review", new Date(2026, 7, 28, 9, 5));
  assert.equal(name, "Review-2026-08-28-09-05.canvas");
});
