import assert from "node:assert/strict";
import test from "node:test";
import { createDeferredLabels } from "../packages/whiteboard/src/bootstrapState.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";

test("labels received before runtime readiness are replayed on attachment", () => {
  const initial = { board: "Localized board" } as WhiteboardLabels;
  const replacement = { board: "Updated board" } as WhiteboardLabels;
  const received: WhiteboardLabels[] = [];
  const deferred = createDeferredLabels();

  deferred.receive(initial);
  assert.deepEqual(received, []);
  deferred.attach({ setLabels: (labels) => received.push(labels) });
  assert.deepEqual(received, [initial]);

  deferred.receive(replacement);
  assert.deepEqual(received, [initial, replacement]);
});
