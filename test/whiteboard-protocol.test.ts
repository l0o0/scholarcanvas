import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EDITOR_MESSAGE_SOURCE,
  isEditorProtocolMessageForChannel,
} from "../src/modules/markdown/editor-protocol.ts";
import {
  WHITEBOARD_MESSAGE_SOURCE,
  WHITEBOARD_PROTOCOL_VERSION,
  isWhiteboardProtocolMessage,
  isWhiteboardProtocolMessageForChannel,
  whiteboardChannel,
  type ParentToWhiteboardMessage,
  type SourceResolutionPriority,
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
type ResolvePriority = Extract<
  WhiteboardToParentMessage,
  { type: "resolveAcademicSources" }
>["payload"]["priority"];
type _PickItemHasNoNote = Assert<"note" extends PickKind ? false : true>;
type _SnapshotUsesSchemaV2 = Assert<
  SnapshotDocument extends { version: 2; nodes: unknown[] } ? true : false
>;
type _InitUsesSchemaV2 = Assert<
  InitDocument extends { version: 2; connections: unknown[] } ? true : false
>;
type _ResolvePriorityIsTyped = Assert<
  ResolvePriority extends SourceResolutionPriority
    ? SourceResolutionPriority extends ResolvePriority
      ? true
      : false
    : false
>;

const literatureSource = {
  library: { type: "user" },
  itemKey: "ITEM1234",
} as const;
const noteSource = { library: { type: "user" }, noteKey: "NOTE1234" } as const;
const quoteSource = {
  ...literatureSource,
  attachmentKey: "ATTACH123",
  annotationKey: "ANNOT1234",
} as const;

const v2ParentMessages = [
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "academicSourceAcquired",
    payload: {
      requestId: "request-1",
      nodeId: "node-1",
      acquisition: {
        kind: "literature",
        source: literatureSource,
        snapshot: { title: "Paper" },
      },
    },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "sourceResolutionBatch",
    payload: {
      requestId: "request-2",
      generation: 4,
      results: [
        {
          nodeId: "node-2",
          generation: 4,
          status: "resolved",
          acquisition: {
            kind: "quote",
            source: quoteSource,
            snapshot: { text: "Quoted text" },
          },
        },
      ],
    },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "academicSourcesAcquired",
    payload: {
      requestId: "request-batch",
      nodeId: "node-batch",
      successes: [
        {
          index: 0,
          acquisition: {
            kind: "literature",
            source: literatureSource,
            snapshot: { title: "Paper" },
          },
        },
      ],
      failures: [
        {
          index: 1,
          code: "unsupported-attachment",
          message: "Unsupported attachment",
        },
      ],
    },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "annotationsListed",
    payload: {
      requestId: "request-3",
      source: literatureSource,
      candidates: [
        {
          acquisition: {
            kind: "quote",
            source: quoteSource,
            snapshot: { text: "Quoted text" },
          },
          attachmentTitle: "Paper.pdf",
          sortIndex: "0001",
        },
      ],
    },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "noteRefreshed",
    payload: {
      requestId: "request-4",
      nodeId: "node-4",
      acquisition: {
        kind: "note",
        source: noteSource,
        content: "Current Zotero text",
      },
    },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "academicRequestFailed",
    payload: {
      requestId: "request-5",
      nodeId: "node-5",
      code: "acquisition-failed",
      diagnostic: "Not available",
    },
  },
] satisfies ParentToWhiteboardMessage[];

const v2IframeMessages = [
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "pickAcademicSource",
    payload: { requestId: "request-6", nodeId: "node-6", kind: "literature" },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "dropAcademicSources",
    payload: {
      requestId: "request-7",
      nodeId: "node-7",
      sources: [
        { library: { type: "user" }, itemKey: "ITEM1234" },
        { library: { type: "group", groupID: 8 }, itemKey: "NOTE1234" },
      ],
    },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "resolveAcademicSources",
    payload: {
      requestId: "request-8",
      generation: 5,
      priority: "visible",
      sources: [
        {
          nodeId: "node-8",
          source: { kind: "literature", source: literatureSource },
        },
      ],
    },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "listLiteratureAnnotations",
    payload: { requestId: "request-9", source: literatureSource },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "refreshZoteroNote",
    payload: { requestId: "request-10", nodeId: "node-10", source: noteSource },
  },
  {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: 2,
    type: "openAcademicSource",
    payload: {
      requestId: "request-11",
      nodeId: "node-11",
      source: { kind: "quote", source: quoteSource },
    },
  },
] satisfies WhiteboardToParentMessage[];

test("whiteboard channel is tab plus canvas id", () => {
  assert.equal(whiteboardChannel("tab-9", "canvas-a"), "tab-9:canvas-a");
});

test("accepts whiteboard messages only from the matching session channel", () => {
  const message = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab-9:canvas-a",
    v: WHITEBOARD_PROTOCOL_VERSION,
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

test("protocol v2 accepts only exact versions and session channels", () => {
  assert.equal(WHITEBOARD_PROTOCOL_VERSION, 2);
  assert.equal(
    isWhiteboardProtocolMessage({
      source: WHITEBOARD_MESSAGE_SOURCE,
      channel: "tab:canvas",
      v: 1,
      type: "ready",
    }),
    false,
  );
  assert.equal(
    isWhiteboardProtocolMessage({
      source: WHITEBOARD_MESSAGE_SOURCE,
      channel: "tab:canvas",
      type: "ready",
    }),
    false,
  );
  assert.equal(
    isWhiteboardProtocolMessageForChannel(
      {
        source: WHITEBOARD_MESSAGE_SOURCE,
        v: WHITEBOARD_PROTOCOL_VERSION,
        type: "ready",
      },
      "tab:canvas",
    ),
    false,
  );
  assert.equal(
    isWhiteboardProtocolMessage({
      source: WHITEBOARD_MESSAGE_SOURCE,
      v: WHITEBOARD_PROTOCOL_VERSION,
      type: "ready",
    }),
    false,
  );
  assert.equal(
    isWhiteboardProtocolMessageForChannel(
      {
        source: WHITEBOARD_MESSAGE_SOURCE,
        channel: "other:canvas",
        v: WHITEBOARD_PROTOCOL_VERSION,
        type: "ready",
      },
      "tab:canvas",
    ),
    false,
  );
  assert.equal(v2ParentMessages.length, 6);
  assert.equal(v2IframeMessages.length, 6);
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
  assert.match(source, /priority: SourceResolutionPriority/);
  assert.doesNotMatch(source, /noteID/);
  const academicDrop = source.slice(
    source.indexOf('type: "dropAcademicSources"'),
    source.indexOf('type: "resolveAcademicSources"'),
  );
  assert.match(academicDrop, /sources:\s*AcademicDropSourceRef\[\]/);
  assert.doesNotMatch(academicDrop, /Record<string, string>|\braw\b|itemID/);
  const hostAcademicDrop = source.slice(
    source.indexOf('type: "academicDropStarted"'),
    source.indexOf('type: "academicDropRejected"'),
  );
  assert.match(hostAcademicDrop, /sources:\s*AcademicDropSourceRef\[\]/);
  assert.doesNotMatch(
    hostAcademicDrop,
    /Record<string, string>|\braw\b|itemID/,
  );
  const sourceActionSuccess = source.slice(
    source.indexOf('type: "sourceActionSucceeded"'),
    source.indexOf('type: "saveState"'),
  );
  assert.match(sourceActionSuccess, /source: AcademicSourceDescriptor/);
  const sourceActionFailure = source.slice(
    source.indexOf('type: "sourceActionFailed"'),
    source.indexOf('type: "sourceActionSucceeded"'),
  );
  assert.match(sourceActionFailure, /source: AcademicSourceDescriptor/);
});

test("tab refocus sends a versioned protocol message", () => {
  const hooks = readFileSync(
    new URL("../src/modules/whiteboard/tabHooks.ts", import.meta.url),
    "utf8",
  );
  assert.match(hooks, /WHITEBOARD_PROTOCOL_VERSION/);
  assert.match(
    hooks,
    /channel: `\$\{tab\.id\}:\$\{tab\.data\?\.canvasId \?\? ""\}`,[\s\S]*v: WHITEBOARD_PROTOCOL_VERSION,[\s\S]*type: "focus"/,
  );
});
