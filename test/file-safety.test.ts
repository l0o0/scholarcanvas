import assert from "node:assert/strict";
import test from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  writeProtectedFile,
  readFileVersions,
} from "../src/modules/file-safety.ts";

async function setup(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-safety-"));
  const names = ["Zotero", "IOUtils", "PathUtils", "ztoolkit"];
  const previous = names.map((key) => [key, (globalThis as any)[key]]);
  const io = {
    exists: async (target: string) =>
      fs.access(target).then(
        () => true,
        () => false,
      ),
    getChildren: async (target: string) =>
      (await fs.readdir(target)).map((name) => path.join(target, name)),
    readUTF8: (target: string) => fs.readFile(target, "utf8"),
    makeDirectory: (target: string) => fs.mkdir(target, { recursive: true }),
    writeUTF8: async (
      target: string,
      content: string,
      options?: { mode?: string },
    ) =>
      fs.writeFile(target, content, {
        flag: options?.mode === "create" ? "wx" : "w",
      }),
    remove: (target: string) => fs.unlink(target),
  };
  Object.assign(globalThis, {
    Zotero: {
      DataDirectory: { dir: root },
      File: { getContentsAsync: io.readUTF8 },
    },
    IOUtils: io,
    PathUtils: { join: path.join, parent: path.dirname },
    ztoolkit: { log() {} },
  });
  t.after(async () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete (globalThis as any)[key];
      else (globalThis as any)[key] = value;
    }
    await fs.rm(root, { recursive: true, force: true });
  });
  const target = path.join(root, "note.md");
  await fs.writeFile(target, "initial");
  const item = { libraryID: 1, key: "ABCD1234" };
  const write = (content: string) => fs.writeFile(target, content);
  return { root, target, item, io, write };
}

test("saves a restorable pre-write version and does not duplicate unchanged saves", async (t) => {
  const { target, item, write } = await setup(t);
  const revision = { content: "initial" };
  await writeProtectedFile(target, "edited", revision, item, write);
  assert.equal(revision.content, "edited");
  await writeProtectedFile(target, "edited", revision, item, write);
  const versions = await readFileVersions(item);
  assert.deepEqual(
    versions.map((v) => [v.kind, v.content]),
    [["saved", "initial"]],
  );
  // A new reader can recover history after the editor has gone away.
  assert.equal(await fs.readFile(target, "utf8"), "edited");
  assert.equal((await readFileVersions({ ...item }))[0].content, "initial");
});

test("external changes never get overwritten; conflicting draft remains recoverable", async (t) => {
  const { target, item, write } = await setup(t);
  const revision = { content: "initial" };
  await fs.writeFile(target, "outside"); // Same byte length as initial.
  await assert.rejects(
    writeProtectedFile(target, "my draft", revision, item, write),
    { code: "WRITE_CONFLICT" },
  );
  assert.equal(await fs.readFile(target, "utf8"), "outside");
  assert.equal(revision.content, "initial");
  assert.deepEqual(
    (await readFileVersions(item)).map((v) => [v.kind, v.content]),
    [["conflict", "my draft"]],
  );
  assert.deepEqual(await readFileVersions({ ...item, libraryID: 2 }), []);
});

test("two editors cannot silently overwrite each other's saves", async (t) => {
  const { target, item, write } = await setup(t);
  const results = await Promise.allSettled([
    writeProtectedFile(target, "first", { content: "initial" }, item, write),
    writeProtectedFile(target, "second", { content: "initial" }, item, write),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    ["fulfilled", "rejected"],
  );
  assert.equal(await fs.readFile(target, "utf8"), "first");
  assert.ok((await readFileVersions(item)).some((v) => v.content === "second"));
});

test("history failure blocks the overwrite and a later save can retry", async (t) => {
  const { target, item, write, io } = await setup(t);
  const original = io.writeUTF8;
  io.writeUTF8 = async () => {
    throw new Error("disk full");
  };
  const revision = { content: "initial" };
  await assert.rejects(
    writeProtectedFile(target, "edited", revision, item, write),
    /disk full/,
  );
  assert.equal(await fs.readFile(target, "utf8"), "initial");
  io.writeUTF8 = original;
  await writeProtectedFile(target, "edited", revision, item, write);
  assert.equal(await fs.readFile(target, "utf8"), "edited");
});

test("external change during history I/O is detected by the second read", async (t) => {
  const { target, item, write, io } = await setup(t);
  const original = io.writeUTF8;
  io.writeUTF8 = async (...args) => {
    await original(...args);
    await fs.writeFile(target, "external during backup");
  };
  await assert.rejects(
    writeProtectedFile(target, "edited", { content: "initial" }, item, write),
    { code: "WRITE_CONFLICT" },
  );
  assert.equal(await fs.readFile(target, "utf8"), "external during backup");
});

test("save history is bounded while conflicting drafts survive ordinary saves", async (t) => {
  const { target, item, write } = await setup(t);
  await assert.rejects(
    writeProtectedFile(target, "recover me", { content: "stale" }, item, write),
  );
  const revision = { content: "initial" };
  for (let i = 0; i < 55; i++)
    await writeProtectedFile(target, `edit ${i}`, revision, item, write);
  const versions = await readFileVersions(item);
  assert.equal(versions.filter((v) => v.kind === "saved").length, 50);
  assert.ok(
    versions.some((v) => v.kind === "conflict" && v.content === "recover me"),
  );
});

test("Markdown persistence uses the protection before title, cleanup, or sync changes", async (t) => {
  const { target, item, write } = await setup(t);
  const { persistMarkdownContent } =
    await import("../src/modules/markdown/persist.ts");
  (globalThis as any).Zotero.File.putContentsAsync = (
    _path: string,
    content: string,
  ) => write(content);
  const attachment = { ...item, getFilePathAsync: async () => target } as any;
  const revision = { content: "initial" };
  await persistMarkdownContent(attachment, "edited", { revision });
  await fs.writeFile(target, "outside");
  await assert.rejects(
    persistMarkdownContent(attachment, "draft", {
      revision,
      syncTitle: true,
      cleanupImages: true,
    }),
    { code: "WRITE_CONFLICT" },
  );
  assert.equal(await fs.readFile(target, "utf8"), "outside");
});

test("Canvas reuses the exact loaded source as its save baseline", async (t) => {
  const { root, item } = await setup(t);
  const { readCanvasFile, writeCanvasFile } =
    await import("../src/modules/whiteboard/file-io.ts");
  const target = path.join(root, "board.canvas");
  const original = '{"nodes":[],"edges":[]}';
  await fs.writeFile(target, original);
  const loaded = await readCanvasFile(target);
  assert.equal(loaded.source, original);
  const revision = { content: loaded.source };
  await writeCanvasFile(target, loaded.document, { revision, item });
  assert.equal(revision.content, await fs.readFile(target, "utf8"));
  await fs.writeFile(target, '{"nodes":[],"edges":[],"external":true}');
  await assert.rejects(
    writeCanvasFile(target, loaded.document, { revision, item }),
    { code: "WRITE_CONFLICT" },
  );
  assert.ok((await readFileVersions(item)).some((v) => v.kind === "conflict"));
});
