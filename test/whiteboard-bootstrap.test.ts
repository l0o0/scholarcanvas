import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createDeferredLabels } from "../packages/whiteboard/src/bootstrapState.ts";
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
  assert.match(bootstrap, /case "academicSourceAcquired"/);
  assert.match(bootstrap, /runtime\?\.resolveAcademicAcquisition\(/);
  assert.match(bootstrap, /case "academicRequestFailed"/);
  assert.match(bootstrap, /runtime\?\.rejectAcademicRequest\(/);
  assert.match(bootstrap, /type: "pickAcademicSource"/);
  assert.match(bootstrap, /type: "dropAcademicSources"/);

  assert.match(editor, /resolveAcademicAcquisition\(/);
  assert.match(editor, /type: "academicSourceAcquired"/);
  assert.match(editor, /rejectAcademicRequest\(/);
  assert.match(editor, /type: "academicRequestFailed"/);
  assert.match(editor, /case "pickAcademicSource"/);
  assert.match(editor, /case "dropAcademicSources"/);
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
