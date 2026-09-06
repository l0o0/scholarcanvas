import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureCanvasExtension,
  pickCanvasFile,
  readCanvasFile,
  writeCanvasFile,
} from "../src/modules/whiteboard/file-io.ts";
import { emptyCanvasDocument } from "../src/modules/whiteboard/snapshot.ts";

test("only the canonical canvas suffix is accepted", () => {
  assert.equal(ensureCanvasExtension("review"), "review.canvas");
  assert.equal(ensureCanvasExtension("review.canvas"), "review.canvas");
  assert.equal(ensureCanvasExtension("review.CANVAS"), "review.CANVAS");
  assert.equal(ensureCanvasExtension("review.txt"), "review.txt.canvas");
});

test("the file picker advertises only Research Canvas files", async (t) => {
  const previous = (globalThis as { ztoolkit?: unknown }).ztoolkit;
  let constructorArguments: unknown[] = [];
  class FilePicker {
    constructor(...args: unknown[]) {
      constructorArguments = args;
    }

    async open() {
      return "/tmp/review.canvas";
    }
  }
  (globalThis as { ztoolkit?: unknown }).ztoolkit = { FilePicker };
  t.after(() => {
    (globalThis as { ztoolkit?: unknown }).ztoolkit = previous;
  });

  assert.equal(await pickCanvasFile("open"), "/tmp/review.canvas");
  assert.deepEqual(constructorArguments[2], [
    ["Research Canvas (*.canvas)", "*.canvas"],
  ]);
});

test("reads a schema-v2 canvas with recoverable diagnostics", async () => {
  const result = await readCanvasFile("/tmp/review.canvas", {
    readUTF8: async () =>
      JSON.stringify({
        version: 1,
        nodes: [
          {
            id: "note-1",
            type: "text",
            x: 0,
            y: 0,
            width: 260,
            height: 128,
            text: "Claim",
            bamboo: {
              node: { kind: "note", content: "Claim", badge: "Claim" },
            },
          },
          {
            id: "bad",
            type: "text",
            x: "not-a-number",
            y: 0,
            width: 100,
            height: 80,
            text: "Bad",
          },
        ],
        edges: [],
        bamboo: {
          schemaVersion: 2,
          createdAt: "2026-09-04T00:00:00.000Z",
          updatedAt: "2026-09-04T00:00:00.000Z",
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      }),
  });

  assert.equal(result.document.version, 2);
  assert.equal(result.document.nodes.length, 1);
  assert.deepEqual(
    result.issues.map(({ code, id }) => ({ code, id })),
    [{ code: "malformed-node", id: "bad" }],
  );
});

test("does not open legacy board suffixes through the canvas reader", async () => {
  let read = false;
  await assert.rejects(
    () =>
      readCanvasFile("/tmp/review.board", {
        readUTF8: async () => {
          read = true;
          return JSON.stringify({ version: 1, nodes: [], edges: [] });
        },
      }),
    /Canvas files must use the \.canvas extension/,
  );
  assert.equal(read, false);
});

test("rejects schema-v1 Bamboo and legacy xyflow files", async () => {
  await assert.rejects(
    () =>
      readCanvasFile("/tmp/schema-v1.canvas", {
        readUTF8: async () =>
          JSON.stringify({
            version: 1,
            nodes: [],
            edges: [],
            bamboo: { schemaVersion: 1 },
          }),
      }),
    /Bamboo schema version must be 2/,
  );
  await assert.rejects(
    () =>
      readCanvasFile("/tmp/legacy.canvas", {
        readUTF8: async () =>
          JSON.stringify({ v: 1, engine: "xyflow", nodes: [], edges: [] }),
      }),
    /Legacy xyflow canvas files are unsupported/,
  );
});

test("writes through a same-directory atomic temporary file", async () => {
  const calls: unknown[][] = [];
  const target = await writeCanvasFile(
    "/tmp/review.canvas",
    emptyCanvasDocument(),
    {
      writeUTF8: async (...args) => {
        calls.push(args);
        return 1;
      },
    },
  );
  assert.equal(target, "/tmp/review.canvas");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/tmp/review.canvas");
  assert.match(String(calls[0][1]), /"schemaVersion": 2/);
  assert.deepEqual(calls[0][2], {
    tmpPath: "/tmp/review.canvas.tmp",
    flush: true,
  });
});
