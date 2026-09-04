import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SourceResolutionResult } from "../packages/whiteboard/src/model/protocol.ts";
import {
  ProgressiveSourceScheduler,
  type SourceResolutionJob,
} from "../src/modules/whiteboard/source-scheduler.ts";

const tabSource = readFileSync(
  new URL("../src/modules/whiteboard/tab.ts", import.meta.url),
  "utf8",
);
const editorSource = readFileSync(
  new URL("../src/modules/whiteboard/editor.ts", import.meta.url),
  "utf8",
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(turns = 8) {
  for (let turn = 0; turn < turns; turn += 1) {
    await Promise.resolve();
  }
}

function job(
  cacheKey: string,
  priority: SourceResolutionJob["priority"],
  values: Partial<SourceResolutionJob> = {},
): SourceResolutionJob {
  return {
    nodeId: values.nodeId ?? `${cacheKey}-node`,
    generation: values.generation ?? 1,
    priority,
    descriptor: values.descriptor ?? {
      kind: "literature",
      source: { library: { type: "user" }, itemKey: cacheKey },
    },
    cacheKey,
  };
}

function resolved(value: SourceResolutionJob): SourceResolutionResult {
  return {
    nodeId: value.nodeId,
    generation: value.generation,
    status: "resolved",
    acquisition: {
      kind: "literature",
      source: { library: { type: "user" }, itemKey: value.cacheKey },
      snapshot: { title: value.cacheKey },
    },
  };
}

test("starts selected, visible, then idle jobs with FIFO ordering", async () => {
  const gates = new Map(
    ["idle-1", "visible-1", "selected-1", "selected-2"].map((key) => [
      key,
      deferred<SourceResolutionResult>(),
    ]),
  );
  const started: string[] = [];
  const scheduler = new ProgressiveSourceScheduler({
    concurrency: 1,
    run: (next) => {
      started.push(next.cacheKey);
      return gates.get(next.cacheKey)!.promise;
    },
    emit: () => undefined,
  });

  scheduler.enqueue(job("idle-1", "idle"));
  scheduler.enqueue(job("visible-1", "visible"));
  scheduler.enqueue(job("selected-1", "selected"));
  scheduler.enqueue(job("selected-2", "selected"));
  await flushMicrotasks();
  assert.deepEqual(started, ["selected-1"]);

  for (const key of ["selected-1", "selected-2", "visible-1", "idle-1"]) {
    gates.get(key)!.resolve(resolved(job(key, "idle")));
    await flushMicrotasks();
  }
  assert.deepEqual(started, [
    "selected-1",
    "selected-2",
    "visible-1",
    "idle-1",
  ]);
});

test("defaults to four concurrent lookups", async () => {
  const gates = Array.from({ length: 9 }, () =>
    deferred<SourceResolutionResult>(),
  );
  let active = 0;
  let maxObserved = 0;
  let started = 0;
  const scheduler = new ProgressiveSourceScheduler({
    run: async (next) => {
      const index = Number(next.cacheKey.slice(4));
      started += 1;
      active += 1;
      maxObserved = Math.max(maxObserved, active);
      const result = await gates[index].promise;
      active -= 1;
      return result;
    },
    emit: () => undefined,
  });

  for (let index = 0; index < gates.length; index += 1) {
    scheduler.enqueue(job(`job-${index}`, "idle"));
  }
  await flushMicrotasks();
  assert.equal(started, 4);
  assert.equal(maxObserved, 4);

  for (let index = 0; index < gates.length; index += 1) {
    gates[index].resolve(resolved(job(`job-${index}`, "idle")));
    await flushMicrotasks();
  }
  assert.equal(started, 9);
  assert.ok(maxObserved <= 4);
});

test("coalesces a cache key and fans the result out to every node", async () => {
  const gate = deferred<SourceResolutionResult>();
  const emitted: SourceResolutionResult[][] = [];
  const runs: SourceResolutionJob[] = [];
  const scheduler = new ProgressiveSourceScheduler({
    run: (next) => {
      runs.push(next);
      return gate.promise;
    },
    emit: (results) => emitted.push(results),
  });
  const first = job("shared", "visible", { nodeId: "literature-a" });
  const second = job("shared", "idle", { nodeId: "literature-b" });

  scheduler.enqueue(first);
  scheduler.enqueue(second);
  await flushMicrotasks();
  assert.equal(runs.length, 1);

  gate.resolve(resolved(first));
  await flushMicrotasks();
  assert.deepEqual(
    emitted.flat().map(({ nodeId }) => nodeId),
    ["literature-a", "literature-b"],
  );
});

test("emits same-turn completions as one micro-batch", async () => {
  const emitted: SourceResolutionResult[][] = [];
  const scheduler = new ProgressiveSourceScheduler({
    run: async (next) => resolved(next),
    emit: (results) => emitted.push(results),
  });

  scheduler.enqueue(job("batch-a", "visible"));
  scheduler.enqueue(job("batch-b", "visible"));
  await flushMicrotasks(16);

  assert.equal(emitted.length, 1);
  assert.deepEqual(
    emitted[0].map(({ nodeId }) => nodeId),
    ["batch-a-node", "batch-b-node"],
  );
});

test("promotes queued cache keys without disturbing priority FIFO", async () => {
  const gates = new Map(
    ["blocker", "older", "promoted"].map((key) => [
      key,
      deferred<SourceResolutionResult>(),
    ]),
  );
  const started: string[] = [];
  const scheduler = new ProgressiveSourceScheduler({
    concurrency: 1,
    run: (next) => {
      started.push(next.cacheKey);
      return gates.get(next.cacheKey)!.promise;
    },
    emit: () => undefined,
  });

  scheduler.enqueue(job("blocker", "selected"));
  scheduler.enqueue(job("older", "idle"));
  scheduler.enqueue(job("promoted", "idle"));
  await flushMicrotasks();
  scheduler.promote("promoted", "selected");
  gates.get("blocker")!.resolve(resolved(job("blocker", "selected")));
  await flushMicrotasks();

  assert.deepEqual(started, ["blocker", "promoted"]);
});

test("a rejected lookup does not stop unrelated work", async () => {
  const emitted: SourceResolutionResult[] = [];
  const started: string[] = [];
  const scheduler = new ProgressiveSourceScheduler({
    concurrency: 1,
    run: async (next) => {
      started.push(next.cacheKey);
      if (next.cacheKey === "broken") throw new Error("lookup failed");
      return resolved(next);
    },
    emit: (results) => emitted.push(...results),
  });

  scheduler.enqueue(job("broken", "selected"));
  scheduler.enqueue(job("healthy", "visible"));
  await flushMicrotasks(16);

  assert.deepEqual(started, ["broken", "healthy"]);
  assert.deepEqual(
    emitted.map(({ nodeId }) => nodeId),
    ["healthy-node"],
  );
});

test("cancels queued and late results for one document generation", async () => {
  const oldGate = deferred<SourceResolutionResult>();
  const emitted: SourceResolutionResult[] = [];
  const started: string[] = [];
  const scheduler = new ProgressiveSourceScheduler({
    concurrency: 1,
    run: (next) => {
      started.push(next.nodeId);
      return next.generation === 1
        ? oldGate.promise
        : Promise.resolve(resolved(next));
    },
    emit: (results) => emitted.push(...results),
  });
  const activeOld = job("old-active", "selected", {
    nodeId: "old-active-node",
    generation: 1,
  });
  scheduler.enqueue(activeOld);
  scheduler.enqueue(
    job("old-queued", "visible", {
      nodeId: "old-queued-node",
      generation: 1,
    }),
  );
  scheduler.enqueue(
    job("current", "idle", { nodeId: "current-node", generation: 2 }),
  );
  await flushMicrotasks();

  scheduler.cancelGeneration(1);
  oldGate.resolve(resolved(activeOld));
  await flushMicrotasks(16);

  assert.deepEqual(started, ["old-active-node", "current-node"]);
  assert.deepEqual(
    emitted.map(({ nodeId }) => nodeId),
    ["current-node"],
  );
});

test("does not cache a completion owned only by a cancelled generation", async () => {
  const stale = deferred<SourceResolutionResult>();
  let runs = 0;
  const emitted: SourceResolutionResult[] = [];
  const scheduler = new ProgressiveSourceScheduler({
    run: (next) => {
      runs += 1;
      return runs === 1 ? stale.promise : Promise.resolve(resolved(next));
    },
    emit: (results) => emitted.push(...results),
  });
  const old = job("same-source", "selected", { generation: 1 });

  scheduler.enqueue(old);
  await flushMicrotasks();
  scheduler.cancelGeneration(1);
  stale.resolve(resolved(old));
  await flushMicrotasks();
  scheduler.enqueue(job("same-source", "selected", { generation: 2 }));
  await flushMicrotasks();

  assert.equal(runs, 2);
  assert.deepEqual(
    emitted.map(({ generation }) => generation),
    [2],
  );
});

test("disposal ignores in-flight completion callbacks", async () => {
  const gate = deferred<SourceResolutionResult>();
  const emitted: SourceResolutionResult[] = [];
  const current = job("dispose", "selected");
  const scheduler = new ProgressiveSourceScheduler({
    run: () => gate.promise,
    emit: (results) => emitted.push(...results),
  });

  scheduler.enqueue(current);
  await flushMicrotasks();
  scheduler.dispose();
  gate.resolve(resolved(current));
  await flushMicrotasks();

  assert.deepEqual(emitted, []);
});

test("the host session composes gateway, scheduler, and resolution bridge", () => {
  assert.match(tabSource, /new ProgressiveSourceScheduler/);
  assert.match(tabSource, /gateway\.resolve\(/);
  assert.match(tabSource, /cancelGeneration\(/);
  assert.match(tabSource, /applySourceResolutionBatch\(/);
  assert.match(editorSource, /case "resolveAcademicSources"/);
  assert.match(editorSource, /applySourceResolutionBatch:/);
  assert.match(editorSource, /type: "sourceResolutionBatch"/);
});
