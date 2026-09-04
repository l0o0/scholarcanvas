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
  type AnnotationCandidate,
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
  assert.match(editor, /type: "academicSourcesAcquired"/);
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
  assert.match(bootstrap, /type: "refreshZoteroNote"/);
  assert.match(editor, /case "refreshZoteroNote"/);
  assert.match(editor, /type: "noteRefreshed"/);
  assert.match(bootstrap, /type: "listLiteratureAnnotations"/);
  assert.match(editor, /case "listLiteratureAnnotations"/);
  assert.match(editor, /type: "annotationsListed"/);
  assert.match(editor, /type: "annotationListFailed"/);
  assert.match(editor, /type: "sourceActionFailed"/);
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
    resolveAcademicAcquisitionBatch: (...args: unknown[]) =>
      calls.push(["resolve-batch", ...args]),
    rejectAcademicRequest: (...args: unknown[]) =>
      calls.push(["reject", ...args]),
    rejectSourceAction: (...args: unknown[]) =>
      calls.push(["source-action-failure", ...args]),
    applySourceResolutionBatch: (...args: unknown[]) =>
      calls.push(["resolution", ...args]),
    applyNoteRefresh: (...args: unknown[]) =>
      calls.push(["note-refresh", ...args]),
    applyAnnotationCandidates: (...args: unknown[]) =>
      calls.push(["annotations", ...args]),
    rejectAnnotationList: (...args: unknown[]) =>
      calls.push(["annotation-failure", ...args]),
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
  const acquiredBatch: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "academicSourcesAcquired",
    payload: {
      requestId: "drop-1",
      nodeId: "drop-node",
      successes: [{ index: 0, acquisition }],
      failures: [
        {
          index: 1,
          code: "unsupported-attachment",
          message: "Unsupported attachment",
        },
      ],
      summary: "Added 1 source; 1 could not be added.",
    },
  };
  const sourceActionFailed: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "sourceActionFailed",
    payload: {
      requestId: "open-1",
      nodeId: "node-1",
      failure: { code: "open-failed", message: "Could not open" },
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
  const noteRefresh: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "noteRefreshed",
    payload: {
      requestId: "refresh-1",
      nodeId: "node-4",
      acquisition: {
        kind: "note",
        source: { library: { type: "user" }, noteKey: "NOTE1234" },
        content: "Current Zotero text",
      },
    },
  };
  const annotation: AnnotationCandidate = {
    attachmentTitle: "Paper.pdf",
    sortIndex: "00001",
    acquisition: {
      kind: "quote",
      source: {
        library: { type: "user" },
        itemKey: "ITEM1234",
        attachmentKey: "PDF12345",
        annotationKey: "ANN12345",
      },
      snapshot: { text: "Evidence", pageLabel: "8" },
    },
  };
  const annotationsListed: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "annotationsListed",
    payload: {
      requestId: "annotations-1",
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      candidates: [annotation],
      failures: [],
    },
  };
  const annotationListFailed: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "annotationListFailed",
    payload: {
      requestId: "annotations-2",
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      failure: { code: "item-missing", message: "Missing" },
    },
  };

  assert.equal(forwardAcademicParentMessage(runtime, acquired), true);
  assert.equal(forwardAcademicParentMessage(runtime, acquiredBatch), true);
  assert.equal(forwardAcademicParentMessage(runtime, rejected), true);
  assert.equal(forwardAcademicParentMessage(runtime, sourceActionFailed), true);
  assert.equal(forwardAcademicParentMessage(runtime, resolution), true);
  assert.equal(forwardAcademicParentMessage(runtime, noteRefresh), true);
  assert.equal(forwardAcademicParentMessage(runtime, annotationsListed), true);
  assert.equal(
    forwardAcademicParentMessage(runtime, annotationListFailed),
    true,
  );
  assert.deepEqual(calls, [
    ["resolve", "pick-1", "node-1", acquisition],
    [
      "resolve-batch",
      "drop-1",
      "drop-node",
      acquiredBatch.payload.successes,
      acquiredBatch.payload.failures,
      acquiredBatch.payload.summary,
    ],
    ["reject", "pick-2", "node-2", "Cancelled"],
    [
      "source-action-failure",
      "open-1",
      "node-1",
      sourceActionFailed.payload.failure,
    ],
    ["resolution", 4, resolution.payload.results],
    ["note-refresh", "refresh-1", "node-4", noteRefresh.payload.acquisition],
    [
      "annotations",
      "annotations-1",
      annotationsListed.payload.source,
      [annotation],
      [],
    ],
    [
      "annotation-failure",
      "annotations-2",
      annotationListFailed.payload.source,
      annotationListFailed.payload.failure,
    ],
  ]);
  assert.equal(JSON.stringify(annotationsListed).includes('"itemID"'), false);
  assert.equal(
    JSON.stringify(annotationsListed).includes('"attachmentID"'),
    false,
  );
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
