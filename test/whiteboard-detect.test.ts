import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultBoardFilename,
  getExtension,
  isWhiteboardAttachment,
} from "../src/modules/whiteboard/detect.ts";

function attachment(filename: string) {
  return {
    isAttachment: () => true,
    attachmentLinkMode: 0,
    attachmentFilename: filename,
  } as Zotero.Item;
}

test("recognizes only the canonical canvas extension", () => {
  (globalThis as typeof globalThis & { Zotero: unknown }).Zotero = {
    Attachments: { LINK_MODE_LINKED_URL: 3 },
  };
  assert.equal(getExtension("review.canvas"), "canvas");
  assert.equal(getExtension("Board-2026.board"), "board");
  assert.equal(getExtension("Board-2026.zmdboard"), "zmdboard");
  assert.equal(isWhiteboardAttachment(attachment("review.canvas")), true);
  assert.equal(isWhiteboardAttachment(attachment("review.CANVAS")), true);
  assert.equal(isWhiteboardAttachment(attachment("review.board")), false);
  assert.equal(isWhiteboardAttachment(attachment("review.zmdboard")), false);
});

test("new research canvases use the canvas suffix", () => {
  (globalThis as any).Zotero = {
    File: { getValidFileName: (value: string) => value },
  };
  const name = defaultBoardFilename("Review", new Date(2026, 7, 28, 9, 5));
  assert.equal(name, "Review-2026-08-28-09-05.canvas");
});
