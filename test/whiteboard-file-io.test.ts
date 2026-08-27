import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasFormatForPath,
  ensureCanvasExtension,
  writeBoardFile,
} from "../src/modules/whiteboard/file-io.ts";
import { emptyBoard } from "../src/modules/whiteboard/snapshot.ts";

test("selects canonical and legacy codecs from the target suffix", () => {
  assert.equal(canvasFormatForPath("review.canvas"), "canvas");
  assert.equal(canvasFormatForPath("review.board"), "legacy");
  assert.equal(canvasFormatForPath("review.zmdboard"), "legacy");
  assert.equal(ensureCanvasExtension("review"), "review.canvas");
});

test("writes through a same-directory atomic temporary file", async () => {
  const calls: unknown[][] = [];
  const target = await writeBoardFile("/tmp/review.canvas", emptyBoard(), {
    nonce: "fixed",
    writeUTF8: async (...args) => {
      calls.push(args);
      return 1;
    },
  });
  assert.equal(target, "/tmp/review.canvas");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/tmp/review.canvas");
  assert.match(String(calls[0][1]), /"schemaVersion": 1/);
  assert.deepEqual(calls[0][2], {
    tmpPath: "/tmp/.review.canvas.fixed.tmp",
    flush: true,
  });
});
