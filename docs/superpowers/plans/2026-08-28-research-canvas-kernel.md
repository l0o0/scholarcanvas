# Research Canvas Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing whiteboard branch to the free Research Canvas kernel by making new documents `.canvas` files with a JSON Canvas-compatible representation, preserving legacy boards, and serializing every save through an atomic single-writer queue.

**Architecture:** Keep the existing React/xyflow iframe and its internal `BoardDocument` as the runtime representation. Add a pure codec at the package boundary that converts runtime documents to and from the user-owned JSON Canvas-compatible file, while legacy `.board` and `.zmdboard` files continue using the existing representation. The Zotero host chooses the file codec, owns atomic I/O, and uses a canvas-specific save coordinator so autosave, explicit save, and close cannot race.

**Tech Stack:** TypeScript 6, React 19, `@xyflow/react` 12, JSON Canvas-compatible JSON, Zotero `IOUtils`, Node test runner through `tsx`, pnpm 9.

**Spec:** `docs/superpowers/specs/2026-08-28-bamboo-research-canvas-free-design.md`

## Global Constraints

- Core use remains free, local-first, account-free, and server-free.
- The React iframe never imports or calls Zotero APIs.
- React Flow remains a rendering engine and is not the `.canvas` storage format.
- New stored attachments use `.canvas`; `.board` and `.zmdboard` remain readable and writable without forced conversion.
- JSON Canvas standard geometry and edge fields remain readable outside Bamboo; Bamboo runtime semantics live under a `bamboo` extension object.
- Unknown root, node, edge, and Bamboo data fields survive a Bamboo read/write round trip.
- File writes use `IOUtils.writeUTF8()` with a same-directory `tmpPath` and `flush: true`.
- Every production behavior follows red-green-refactor.
- The existing 325-test post-merge baseline and production build must remain green.

---

### Task 1: Add the JSON Canvas-Compatible File Codec

**Files:**

- Create: `packages/whiteboard/src/model/canvas-file.ts`
- Modify: `packages/whiteboard/src/model/snapshot.ts`
- Modify: `packages/whiteboard/src/model/index.ts`
- Create: `test/whiteboard-canvas-file.test.ts`

**Interfaces:**

- Consumes: `BoardDocument`, `BoardNode`, `BoardEdge`, `BoardViewport`, and `parseBoardDocument()` from `packages/whiteboard/src/model/snapshot.ts`.
- Produces: `CanvasFile`, `StoredCanvasFormat`, `boardDocumentToCanvasFile()`, `canvasFileToBoardDocument()`, `parseStoredCanvas()`, and `serializeStoredCanvas()` from `packages/whiteboard/src/model/canvas-file.ts`.
- Preserves: optional `extra` records on `BoardDocument`, `BoardNode`, and `BoardEdge`.

- [ ] **Step 1: Write failing codec and passthrough tests**

Create `test/whiteboard-canvas-file.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  boardDocumentToCanvasFile,
  canvasFileToBoardDocument,
  parseStoredCanvas,
  serializeStoredCanvas,
} from "../packages/whiteboard/src/model/canvas-file.ts";
import { parseBoardDocument } from "../packages/whiteboard/src/model/snapshot.ts";

const board = parseBoardDocument({
  v: 1,
  engine: "xyflow",
  viewport: { x: 12, y: -8, zoom: 1.25 },
  vendorRoot: { keep: true },
  nodes: [
    {
      id: "paper-1",
      type: "item",
      position: { x: 30, y: 40 },
      width: 260,
      height: 120,
      vendorNode: "keep-node",
      data: {
        kind: "item",
        title: "Paper",
        subtitle: "Smith · 2026",
        vendorData: "keep-data",
      },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "paper-1",
      target: "claim-1",
      label: "related",
      vendorEdge: "keep-edge",
    },
  ],
});

test("encodes runtime geometry as JSON Canvas fields", () => {
  const file = boardDocumentToCanvasFile(board, {
    title: "Review",
    now: "2026-08-28T00:00:00.000Z",
  });
  assert.equal(file.version, 1);
  assert.deepEqual(file.nodes[0], {
    id: "paper-1",
    type: "text",
    x: 30,
    y: 40,
    width: 260,
    height: 120,
    text: "Paper\n\nSmith · 2026",
    vendorNode: "keep-node",
    bamboo: {
      kind: "item",
      data: {
        kind: "item",
        title: "Paper",
        subtitle: "Smith · 2026",
        vendorData: "keep-data",
      },
    },
  });
  assert.equal(file.edges[0].fromNode, "paper-1");
  assert.equal(file.edges[0].toNode, "claim-1");
  assert.equal(file.bamboo.viewport.zoom, 1.25);
  assert.deepEqual(file.vendorRoot, { keep: true });
});

test("decodes a canonical canvas without losing unknown fields", () => {
  const file = boardDocumentToCanvasFile(board, {
    title: "Review",
    now: "2026-08-28T00:00:00.000Z",
  });
  const decoded = canvasFileToBoardDocument(file);
  assert.equal(decoded.nodes[0].data.vendorData, "keep-data");
  assert.equal(decoded.nodes[0].extra?.vendorNode, "keep-node");
  assert.equal(decoded.edges[0].extra?.vendorEdge, "keep-edge");
  assert.deepEqual(decoded.extra?.vendorRoot, { keep: true });
});

test("detects canonical and legacy stored documents", () => {
  const canonical = parseStoredCanvas(
    boardDocumentToCanvasFile(board, {
      title: "Review",
      now: "2026-08-28T00:00:00.000Z",
    }),
  );
  assert.equal(canonical.format, "canvas");
  assert.equal(canonical.document.nodes[0].id, "paper-1");

  const legacy = parseStoredCanvas(board);
  assert.equal(legacy.format, "legacy");
  assert.equal(legacy.document.nodes[0].id, "paper-1");
});

test("serializes canonical and legacy formats explicitly", () => {
  const canonical = JSON.parse(
    serializeStoredCanvas(board, "canvas", {
      title: "Review",
      now: "2026-08-28T00:00:00.000Z",
    }),
  );
  assert.equal(canonical.version, 1);
  assert.equal(canonical.bamboo.schemaVersion, 1);
  assert.equal(canonical.nodes[0].x, 30);
  assert.equal(canonical.nodes[0].position, undefined);

  const legacy = JSON.parse(serializeStoredCanvas(board, "legacy"));
  assert.equal(legacy.engine, "xyflow");
  assert.deepEqual(legacy.nodes[0].position, { x: 30, y: 40 });
});
```

- [ ] **Step 2: Run the codec test and verify red**

Run:

```bash
pnpm exec tsx --test test/whiteboard-canvas-file.test.ts
```

Expected: FAIL with `Cannot find module .../canvas-file.ts`.

- [ ] **Step 3: Preserve unknown runtime fields**

In `packages/whiteboard/src/model/snapshot.ts`, extend the runtime types:

```ts
export interface BoardNode {
  id: string;
  type: BoardNodeKind;
  position: { x: number; y: number };
  data: BoardNodeData;
  width?: number;
  height?: number;
  extra?: Record<string, unknown>;
}

export interface BoardEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  dashed?: boolean;
  color?: string;
  arrow?: boolean;
  extra?: Record<string, unknown>;
}

export interface BoardDocument {
  v: typeof BOARD_DOCUMENT_VERSION;
  engine: typeof BOARD_ENGINE;
  nodes: BoardNode[];
  edges: BoardEdge[];
  viewport?: BoardViewport;
  metadata?: {
    title?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  extra?: Record<string, unknown>;
}
```

Add a pure helper and use it in `parseNode()`, `parseEdge()`, and `parseBoardDocument()`:

```ts
function withoutKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  const blocked = new Set(keys);
  const entries = Object.entries(source).filter(([key]) => !blocked.has(key));
  return entries.length ? Object.fromEntries(entries) : undefined;
}
```

Build parsed node data as `{ ...data, kind, title, ...normalizedKnownFields }`, and store non-runtime node, edge, and root fields in `extra`. Do not put `extra` itself back inside `extra`.

- [ ] **Step 4: Implement the canonical codec**

Create `packages/whiteboard/src/model/canvas-file.ts` with these public definitions:

```ts
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_ENGINE,
  parseBoardDocument,
  type BoardDocument,
  type BoardNodeData,
  type BoardNodeKind,
  type BoardViewport,
} from "./snapshot";

export const CANVAS_FILE_VERSION = 1;
export type StoredCanvasFormat = "canvas" | "legacy";

export interface CanvasFileNode extends Record<string, unknown> {
  id: string;
  type: "text" | "group" | "file" | "link";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  label?: string;
  bamboo: {
    kind: BoardNodeKind;
    data: BoardNodeData;
  };
}

export interface CanvasFileEdge extends Record<string, unknown> {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
  label?: string;
  color?: string;
  bamboo?: {
    dashed?: boolean;
    arrow?: boolean;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  };
}

export interface CanvasFile extends Record<string, unknown> {
  version: typeof CANVAS_FILE_VERSION;
  nodes: CanvasFileNode[];
  edges: CanvasFileEdge[];
  bamboo: {
    schemaVersion: typeof CANVAS_FILE_VERSION;
    engine: typeof BOARD_ENGINE;
    title?: string;
    createdAt: string;
    updatedAt: string;
    viewport: BoardViewport;
  };
}
```

Implement the conversion rules exactly:

- runtime `position.x/y` becomes standard `x/y`;
- absent dimensions use `240 × 120`;
- runtime `frame` will map to `group` when that kind is introduced; every current kind maps to `text`;
- `text` is `[title, subtitle or preview].filter(Boolean).join("\n\n")`;
- the full `BoardNodeData` lives under `bamboo.data`;
- runtime edge `source/target` becomes `fromNode/toNode`;
- runtime-only edge fields live under `edge.bamboo`;
- viewport and document metadata live under the root `bamboo` object;
- `parseStoredCanvas()` detects canonical input through `bamboo.schemaVersion === 1`; all other objects go through the legacy parser;
- serialization ends with one newline;
- canonical conversion restores `extra` fields before assigning standard fields, so canonical fields always win.

Export the codec from `packages/whiteboard/src/model/index.ts`:

```ts
export * from "./snapshot";
export * from "./protocol";
export * from "./canvas-file";
```

- [ ] **Step 5: Run focused and existing model tests**

Run:

```bash
pnpm exec tsx --test test/whiteboard-canvas-file.test.ts test/whiteboard-snapshot.test.ts test/whiteboard-app-state.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit the codec**

```bash
git add packages/whiteboard/src/model/canvas-file.ts packages/whiteboard/src/model/snapshot.ts packages/whiteboard/src/model/index.ts test/whiteboard-canvas-file.test.ts
git commit -m "feat(canvas): add JSON Canvas file codec"
```

---

### Task 2: Make `.canvas` the Default Without Breaking Legacy Boards

**Files:**

- Modify: `src/modules/whiteboard/detect.ts`
- Modify: `src/modules/whiteboard/file-io.ts`
- Modify: `src/modules/whiteboard/create.ts`
- Modify: `src/modules/whiteboard/index.ts`
- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `test/whiteboard-detect.test.ts`
- Modify: `test/whiteboard-snapshot.test.ts`
- Create: `test/whiteboard-file-io.test.ts`

**Interfaces:**

- Consumes: `parseStoredCanvas()` and `serializeStoredCanvas()` from the package model.
- Produces: `canvasFormatForPath()`, `ensureCanvasExtension()`, atomic `writeBoardFile()`, and backward-compatible `ensureBoardExtension()`.
- Keeps: `readBoardFile()` returning a runtime `BoardDocument`.

- [ ] **Step 1: Write failing extension and atomic-write tests**

Extend `test/whiteboard-detect.test.ts`:

```ts
test("recognizes canvas and legacy board extensions", () => {
  assert.equal(getExtension("review.canvas"), "canvas");
  assert.equal(getExtension("review.board"), "board");
  assert.equal(getExtension("review.zmdboard"), "zmdboard");
});

test("new research canvases use the canvas suffix", () => {
  const name = defaultBoardFilename("Review", new Date(2026, 7, 28, 9, 5));
  assert.equal(name, "Review-2026-08-28-09-05.canvas");
});
```

Create `test/whiteboard-file-io.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  canvasFormatForPath,
  ensureCanvasExtension,
  writeBoardFile,
} from "../src/modules/whiteboard/file-io.ts";
import { emptyBoard } from "../src/modules/whiteboard/snapshot.ts";

test("selects canonical and legacy codecs from the target suffix", () => {
  assert.equal(canvasFormatForPath("review.canvas"), "canvas");
  assert.equal(canvasFormatForPath("review.board"), "legacy");
  assert.equal(canvasFormatForPath("review.zmdboard"), "legacy");
  assert.equal(ensureCanvasExtension("review"), "review.canvas");
});

test("writes through a same-directory atomic temporary file", async () => {
  const calls: unknown[][] = [];
  const target = await writeBoardFile("/tmp/review.canvas", emptyBoard(), {
    nonce: "fixed",
    writeUTF8: async (...args) => {
      calls.push(args);
      return 1;
    },
  });
  assert.equal(target, "/tmp/review.canvas");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/tmp/review.canvas");
  assert.match(String(calls[0][1]), /"schemaVersion": 1/);
  assert.deepEqual(calls[0][2], {
    tmpPath: "/tmp/.review.canvas.fixed.tmp",
    flush: true,
  });
});
```

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```bash
pnpm exec tsx --test test/whiteboard-detect.test.ts test/whiteboard-file-io.test.ts
```

Expected: FAIL because `.canvas`, `canvasFormatForPath()`, `ensureCanvasExtension()`, and injected atomic writing are not implemented.

- [ ] **Step 3: Update detection and new filenames**

In `src/modules/whiteboard/detect.ts`:

```ts
const BOARD_EXTENSIONS = new Set(["canvas", "board", "zmdboard"]);
```

Strip all three extensions before generating a name and return `.canvas` from `defaultBoardFilename()`.

- [ ] **Step 4: Route file I/O through the correct codec**

Update `src/modules/whiteboard/file-io.ts` to expose:

```ts
export type AtomicWriteUTF8 = (
  path: string,
  value: string,
  options: { tmpPath: string; flush: boolean },
) => Promise<number | void>;

export function canvasFormatForPath(path: string): StoredCanvasFormat {
  return /\.(board|zmdboard)$/i.test(path) ? "legacy" : "canvas";
}

export function ensureCanvasExtension(path: string): string {
  return /\.(canvas|board|zmdboard)$/i.test(path) ? path : `${path}.canvas`;
}

export const ensureBoardExtension = ensureCanvasExtension;
```

Use a `Research Canvas (*.canvas)` picker filter for saving and add a legacy filter for opening. `readBoardFile()` must use `parseStoredCanvas(parsed).document`.

Implement atomic writes with an injectable writer:

```ts
export async function writeBoardFile(
  path: string,
  doc: BoardDocument,
  options: { nonce?: string; writeUTF8?: AtomicWriteUTF8 } = {},
): Promise<string> {
  const target = ensureCanvasExtension(path);
  const name = basename(target);
  const nonce =
    options.nonce ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const separatorIndex = Math.max(
    target.lastIndexOf("/"),
    target.lastIndexOf("\\"),
  );
  const parent = separatorIndex >= 0 ? target.slice(0, separatorIndex + 1) : "";
  const tmpPath = `${parent}.${name}.${nonce}.tmp`;
  const writeUTF8 = options.writeUTF8 ?? IOUtils.writeUTF8.bind(IOUtils);
  await writeUTF8(
    target,
    serializeStoredCanvas(doc, canvasFormatForPath(target), {
      title: name.replace(/\.(canvas|board|zmdboard)$/i, ""),
    }),
    { tmpPath, flush: true },
  );
  return target;
}
```

Keep `serializeBoardDocument()` as a compatibility export that serializes canonical canvas by default and accepts an optional `StoredCanvasFormat` second argument.

Update `tab.ts` to load initial files through `readBoardFile()` (or equivalently `parseStoredCanvas()`), so canonical `.canvas` files are converted to the runtime representation before mounting the iframe.

- [ ] **Step 5: Create canonical content for new attachments**

In `src/modules/whiteboard/create.ts`, serialize newly created documents as `canvas` and keep MIME type `application/json`. Use the generated `.canvas` filename for the attachment title.

Export `ensureCanvasExtension` and `canvasFormatForPath` from `src/modules/whiteboard/index.ts`.

- [ ] **Step 6: Run focused tests and update old assertions**

Update old tests that assert `.board` is the new suffix so they assert `.canvas`. Keep explicit assertions that `.board` and `.zmdboard` remain unchanged.

Run:

```bash
pnpm exec tsx --test test/whiteboard-detect.test.ts test/whiteboard-file-io.test.ts test/whiteboard-snapshot.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit `.canvas` storage**

```bash
git add src/modules/whiteboard/detect.ts src/modules/whiteboard/file-io.ts src/modules/whiteboard/create.ts src/modules/whiteboard/index.ts test/whiteboard-detect.test.ts test/whiteboard-file-io.test.ts test/whiteboard-snapshot.test.ts
git commit -m "feat(canvas): store new boards as canvas files"
```

---

### Task 3: Add a Canvas-Specific Single-Writer Save Coordinator

**Files:**

- Create: `src/modules/whiteboard/save-coordinator.ts`
- Create: `test/whiteboard-save-coordinator.test.ts`

**Interfaces:**

- Consumes: runtime `BoardDocument` snapshots from the iframe handle.
- Produces: `WhiteboardSaveCoordinator`, `WhiteboardSaveSnapshot`, and `WhiteboardSaveState`.
- Guarantees: one writer, revision-aware follow-up writes, dirty state after failures, and an awaitable `flush()`.

- [ ] **Step 1: Write failing concurrency tests**

Create `test/whiteboard-save-coordinator.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the coordinator test and verify red**

Run:

```bash
pnpm exec tsx --test test/whiteboard-save-coordinator.test.ts
```

Expected: FAIL with `Cannot find module .../save-coordinator.ts`.

- [ ] **Step 3: Implement the coordinator**

Create `src/modules/whiteboard/save-coordinator.ts` with:

```ts
import type { BoardDocument } from "./snapshot";

export type WhiteboardSaveState = "saved" | "saving" | "error";

export interface WhiteboardSaveSnapshot {
  rev: number;
  document: BoardDocument;
}

export interface WhiteboardSaveCoordinatorOptions {
  getSnapshot: () => WhiteboardSaveSnapshot | Promise<WhiteboardSaveSnapshot>;
  write: (snapshot: WhiteboardSaveSnapshot) => Promise<void>;
  onStateChange?: (state: WhiteboardSaveState) => void;
}
```

Implement `WhiteboardSaveCoordinator` with public `currentRev`, `savedRev`, `writing`, `lastError`, `dirty`, `markChanged(rev)`, `request({ force? })`, and `flush()`. Use one promise tail and one merged pending request. After a successful write, assign `savedRev = snapshot.rev`; if `currentRev` advanced during I/O, the drain loop takes a new snapshot and writes again. On failure, retain dirty state and rethrow.

- [ ] **Step 4: Run the coordinator tests**

Run:

```bash
pnpm exec tsx --test test/whiteboard-save-coordinator.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit the coordinator**

```bash
git add src/modules/whiteboard/save-coordinator.ts test/whiteboard-save-coordinator.test.ts
git commit -m "feat(canvas): serialize whiteboard saves"
```

---

### Task 4: Route Autosave, Explicit Save, and Close Through the Coordinator

**Files:**

- Modify: `src/modules/whiteboard/session-registry.ts`
- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `src/modules/whiteboard/index.ts`
- Modify: `src/hooks.ts`
- Create: `test/whiteboard-save-integration.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `WhiteboardSaveCoordinator` and the existing iframe `requestSnapshot()` result.
- Produces: one coordinator per `WhiteboardSession` and exported `flushAllWhiteboards()`.
- Preserves: existing UI save-state messages and asset cleanup after successful saves.

- [ ] **Step 1: Write a failing host integration contract**

Create `test/whiteboard-save-integration.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tab = readFileSync(
  new URL("../src/modules/whiteboard/tab.ts", import.meta.url),
  "utf8",
);
const session = readFileSync(
  new URL("../src/modules/whiteboard/session-registry.ts", import.meta.url),
  "utf8",
);

test("whiteboard sessions own a save coordinator", () => {
  assert.match(session, /saveCoordinator\?: WhiteboardSaveCoordinator/);
  assert.match(tab, /new WhiteboardSaveCoordinator\(/);
});

test("all save entry points call the coordinator", () => {
  assert.match(tab, /saveCoordinator\?\.markChanged\(rev\)/);
  assert.match(tab, /saveCoordinator\.request\(/);
  assert.match(tab, /saveCoordinator\.flush\(\)/);
  assert.doesNotMatch(tab, /session\.savedRev\s*=/);
});
```

- [ ] **Step 2: Run the host integration contract and verify red**

Run:

```bash
pnpm exec tsx --test test/whiteboard-save-integration.test.ts
```

Expected: FAIL because sessions still store raw revision fields and `tab.ts` writes directly.

- [ ] **Step 3: Put the coordinator on each session**

In `src/modules/whiteboard/session-registry.ts`, replace `currentRev` and `savedRev` with:

```ts
saveCoordinator?: WhiteboardSaveCoordinator;
```

Import the type from `./save-coordinator`.

In `tab.ts`, make `isDirty()` return `session.saveCoordinator?.dirty ?? false`. After `createWhiteboardEditor()` returns, construct the coordinator:

```ts
session.saveCoordinator = new WhiteboardSaveCoordinator({
  getSnapshot: async () => {
    if (!session.editor) throw new Error("Canvas editor is unavailable");
    const shot = await session.editor.requestSnapshot();
    return {
      rev: shot.rev,
      document: parseBoardDocument(shot.snapshot),
    };
  },
  write: async ({ document }) => {
    const item = Zotero.Items.get(session.itemID);
    if (!item || !isWhiteboardAttachment(item)) {
      throw new Error("Canvas attachment is gone");
    }
    const path = (await item.getFilePathAsync()) || session.path;
    if (!path) throw new Error("Canvas file not found");
    session.path = await writeBoardFile(path, document);
    await cleanupUnusedAssets(session, document);
    session.title = attachmentTitle(item);
  },
  onStateChange: (state) => {
    session.editor?.setSaveState(state);
    refreshTabTitle(session);
  },
});
```

- [ ] **Step 4: Route every lifecycle action through the queue**

Change iframe `onChange(rev)` to call `session.saveCoordinator?.markChanged(rev)` before scheduling autosave.

Make `saveSession()` await `session.saveCoordinator.request()` and only show success/failure UI; it must no longer request or write snapshots itself.

When closing a dirty session, call `saveSession()` for the save choice and abort teardown if it returns false. Before destroying the editor, call `await session.saveCoordinator?.flush()` whenever it remains dirty.

Add:

```ts
export async function flushAllWhiteboards(): Promise<void> {
  await Promise.all(
    whiteboardRegistry
      .all()
      .map((session) => session.saveCoordinator?.flush() ?? Promise.resolve()),
  );
}
```

Export it from `src/modules/whiteboard/index.ts` and invoke it in plugin shutdown before `closeAllWhiteboards()`.

- [ ] **Step 5: Add new tests to the unit suite**

Append these files to `test:unit` in `package.json`:

- `test/whiteboard-canvas-file.test.ts`
- `test/whiteboard-file-io.test.ts`
- `test/whiteboard-save-coordinator.test.ts`
- `test/whiteboard-save-integration.test.ts`

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
pnpm exec tsx --test test/whiteboard-save-coordinator.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-session-registry.test.ts
pnpm test:unit
```

Expected: focused tests pass and the full suite reports 0 failures.

- [ ] **Step 7: Commit the host integration**

```bash
git add src/hooks.ts src/modules/whiteboard/session-registry.ts src/modules/whiteboard/tab.ts src/modules/whiteboard/index.ts test/whiteboard-save-integration.test.ts package.json
git commit -m "refactor(canvas): route saves through one writer"
```

---

### Task 5: Verify the Updated Canvas Kernel

**Files:**

- Verify: all files changed by Tasks 1–4
- Modify: `docs/superpowers/plans/2026-08-28-research-canvas-kernel.md`

**Interfaces:**

- Consumes: the canonical codec, extension routing, atomic writer, and save coordinator.
- Produces: an updated `whiteboard` branch ready for the Zotero Research Bridge milestone.

- [ ] **Step 1: Run formatting and lint checks**

Run:

```bash
pnpm exec prettier --check packages/whiteboard/src/model src/modules/whiteboard test/whiteboard-*.test.ts package.json docs/superpowers/plans/2026-08-28-research-canvas-kernel.md
pnpm exec eslint packages/whiteboard/src/model src/modules/whiteboard test/whiteboard-*.test.ts
```

Expected: both commands exit with status 0.

- [ ] **Step 2: Run all unit tests**

Run:

```bash
pnpm test:unit
```

Expected: every test passes with 0 failures.

- [ ] **Step 3: Build both whiteboard targets**

Run:

```bash
pnpm whiteboard:build
pnpm run build
```

Expected: standalone Vite build, Zotero Plugin Scaffold build, and TypeScript checks all exit with status 0.

- [ ] **Step 4: Inspect the packaged canvas assets**

Run:

```bash
test -f .scaffold/build/addon/content/whiteboard/whiteboard.js
test -f .scaffold/build/addon/content/whiteboard/index.html
```

Expected: both commands exit with status 0.

- [ ] **Step 5: Check scope and repository state**

Run:

```bash
git diff --check
git status --short
git log --oneline --decorate -8
```

Expected: no uncommitted production or test changes remain after updating this plan's checkboxes; commits are limited to the main-branch merge, the plan, the codec, `.canvas` storage, and save lifecycle work.

- [ ] **Step 6: Commit the completed plan checklist**

```bash
git add docs/superpowers/plans/2026-08-28-research-canvas-kernel.md
git commit -m "docs: complete research canvas kernel plan"
```
