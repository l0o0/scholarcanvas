import assert from "node:assert/strict";
import test from "node:test";
import { emptyBoard } from "../src/modules/whiteboard/snapshot.ts";
import { WhiteboardSaveCoordinator } from "../src/modules/whiteboard/save-coordinator.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

test("serializes a change that arrives during a write", async () => {
  const gate = deferred();
  const writes: number[] = [];
  let snapshotRev = 1;
  const save = new WhiteboardSaveCoordinator({
    getSnapshot: () => ({ rev: snapshotRev, document: emptyBoard() }),
    write: async ({ rev }) => {
      writes.push(rev);
      if (writes.length === 1) await gate.promise;
    },
  });

  save.markChanged(1);
  const first = save.request();
  await Promise.resolve();
  snapshotRev = 2;
  save.markChanged(2);
  const second = save.request();
  gate.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(writes, [1, 2]);
  assert.equal(save.dirty, false);
});

test("keeps a failed revision dirty and reports the error state", async () => {
  const states: string[] = [];
  const save = new WhiteboardSaveCoordinator({
    getSnapshot: () => ({ rev: 1, document: emptyBoard() }),
    write: async () => {
      throw new Error("disk full");
    },
    onStateChange: (state) => states.push(state),
  });
  save.markChanged(1);
  await assert.rejects(() => save.request(), /disk full/);
  assert.equal(save.dirty, true);
  assert.equal(save.lastError?.message, "disk full");
  assert.equal(states.at(-1), "error");
});

test("flush waits for the latest known revision", async () => {
  const writes: number[] = [];
  const save = new WhiteboardSaveCoordinator({
    getSnapshot: () => ({ rev: save.currentRev, document: emptyBoard() }),
    write: async ({ rev }) => {
      writes.push(rev);
    },
  });
  save.markChanged(3);
  await save.flush();
  assert.deepEqual(writes, [3]);
  assert.equal(save.savedRev, 3);
});
