import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  createDeferredLabels,
  forwardAcademicParentMessage,
} from "../packages/whiteboard/src/bootstrapState.ts";
import {
  WHITEBOARD_MESSAGE_SOURCE,
  WHITEBOARD_PROTOCOL_VERSION,
  type AcademicAcquisition,
  type ParentToWhiteboardMessage,
} from "../packages/whiteboard/src/model/protocol.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";

const bootstrap = readFileSync(
  new URL("../packages/whiteboard/src/bootstrap.tsx", import.meta.url),
  "utf8",
);
const editor = readFileSync(
  new URL("../src/modules/whiteboard/editor.ts", import.meta.url),
  "utf8",
);

test("labels received before runtime readiness are replayed on attachment", () => {
  const initial = { canvas: "Localized canvas" } as WhiteboardLabels;
  const replacement = { canvas: "Updated canvas" } as WhiteboardLabels;
  const received: WhiteboardLabels[] = [];
  const deferred = createDeferredLabels();

  deferred.receive(initial);
  assert.deepEqual(received, []);
  deferred.attach({ setLabels: (labels) => received.push(labels) });
  assert.deepEqual(received, [initial]);

  deferred.receive(replacement);
  assert.deepEqual(received, [initial, replacement]);
});

test("protocol-v2 academic acquisition is forwarded across both bridge sides", () => {
  assert.match(bootstrap, /forwardAcademicParentMessage\(runtime, data\)/);
  assert.match(bootstrap, /type: "pickAcademicSource"/);
  assert.match(bootstrap, /type: "dropAcademicSources"/);

  assert.match(editor, /resolveAcademicAcquisition\(/);
  assert.match(editor, /type: "academicSourceAcquired"/);
  assert.match(editor, /rejectAcademicRequest\(/);
  assert.match(editor, /type: "academicRequestFailed"/);
  assert.match(editor, /case "pickAcademicSource"/);
  assert.match(editor, /case "dropAcademicSources"/);
  assert.match(bootstrap, /onResolveAcademicSources/);
  assert.match(
    bootstrap,
    /onResolveAcademicSources=\{\(requestId, generation, priority, sources\)/,
  );
  assert.match(
    bootstrap,
    /payload: \{ requestId, generation, priority, sources \}/,
  );
  assert.match(editor, /case "resolveAcademicSources"/);
  assert.match(editor, /data\.payload\.priority/);
  assert.match(editor, /applySourceResolutionBatch/);
  assert.match(editor, /type: "sourceResolutionBatch"/);
});

test("academic bridge dispatch invokes the correlated runtime methods", () => {
  const acquisition: AcademicAcquisition = {
    kind: "literature",
    source: { library: { type: "user" }, itemKey: "ABCD2345" },
    snapshot: { title: "A paper" },
  };
  const calls: unknown[] = [];
  const runtime = {
    resolveAcademicAcquisition: (...args: unknown[]) =>
      calls.push(["resolve", ...args]),
    rejectAcademicRequest: (...args: unknown[]) =>
      calls.push(["reject", ...args]),
    applySourceResolutionBatch: (...args: unknown[]) =>
      calls.push(["resolution", ...args]),
  };
  const acquired: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "academicSourceAcquired",
    payload: { requestId: "pick-1", nodeId: "node-1", acquisition },
  };
  const rejected: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "academicRequestFailed",
    payload: {
      requestId: "pick-2",
      nodeId: "node-2",
      message: "Cancelled",
    },
  };
  const resolution: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "sourceResolutionBatch",
    payload: {
      requestId: "resolution-1",
      generation: 4,
      results: [
        {
          nodeId: "node-3",
          generation: 4,
          status: "unavailable",
          code: "item-missing",
          message: "Missing",
        },
      ],
    },
  };

  assert.equal(forwardAcademicParentMessage(runtime, acquired), true);
  assert.equal(forwardAcademicParentMessage(runtime, rejected), true);
  assert.equal(forwardAcademicParentMessage(runtime, resolution), true);
  assert.deepEqual(calls, [
    ["resolve", "pick-1", "node-1", acquisition],
    ["reject", "pick-2", "node-2", "Cancelled"],
    ["resolution", 4, resolution.payload.results],
  ]);
});

test("both bridge listeners require the exact peer window and protocol channel", () => {
  assert.match(bootstrap, /event\.source !== window\.parent/);
  assert.match(
    bootstrap,
    /isWhiteboardProtocolMessageForChannel\(event\.data, channel\)/,
  );
  assert.match(editor, /event\.source !== iframe\.contentWindow/);
  assert.match(
    editor,
    /isWhiteboardProtocolMessageForChannel\(event\.data, channel\)/,
  );
});
