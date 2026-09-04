import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EDITOR_MESSAGE_SOURCE,
  isEditorProtocolMessageForChannel,
} from "../src/modules/markdown/editor-protocol.ts";
import {
  WHITEBOARD_MESSAGE_SOURCE,
  isWhiteboardProtocolMessage,
  isWhiteboardProtocolMessageForChannel,
  whiteboardChannel,
  type ParentToWhiteboardMessage,
  type WhiteboardToParentMessage,
} from "../src/modules/whiteboard/protocol.ts";

type Assert<T extends true> = T;
type PickKind = Extract<
  WhiteboardToParentMessage,
  { type: "pickItem" }
>["payload"]["kind"];
type SnapshotDocument = Extract<
  WhiteboardToParentMessage,
  { type: "snapshot" }
>["payload"]["snapshot"];
type InitDocument = NonNullable<
  Extract<ParentToWhiteboardMessage, { type: "init" }>["payload"]["snapshot"]
>;
type _PickItemHasNoNote = Assert<"note" extends PickKind ? false : true>;
type _SnapshotUsesSchemaV2 = Assert<
  SnapshotDocument extends { version: 2; nodes: unknown[] } ? true : false
>;
type _InitUsesSchemaV2 = Assert<
  InitDocument extends { version: 2; connections: unknown[] } ? true : false
>;

test("whiteboard channel is tab plus canvas id", () => {
  assert.equal(whiteboardChannel("tab-9", "canvas-a"), "tab-9:canvas-a");
});

test("accepts whiteboard messages only from the matching session channel", () => {
  const message = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    type: "change",
    payload: { rev: 3 },
  };
  assert.equal(
    isWhiteboardProtocolMessageForChannel(message, "tab-9:canvas-a"),
    true,
  );
  assert.equal(
    isWhiteboardProtocolMessageForChannel(message, "tab-1:canvas-b"),
    false,
  );
});

test("rejects markdown editor messages as whiteboard traffic", () => {
  const editorMessage = {
    source: EDITOR_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    type: "ready",
  };
  assert.equal(isWhiteboardProtocolMessage(editorMessage), false);
  assert.equal(
    isEditorProtocolMessageForChannel(editorMessage, "tab-9:canvas-a"),
    true,
  );
});

test("protocol source uses CanvasDocument and typed Basic picker payloads", () => {
  const source = readFileSync(
    new URL("../packages/whiteboard/src/model/protocol.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /import type \{ CanvasDocument \} from "\.\/document"/);
  assert.match(source, /type BasicPickerPayload/);
  assert.match(source, /snapshot\?: CanvasDocument \| null/);
  assert.doesNotMatch(source, /noteID/);
});
