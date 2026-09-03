# Academic Canvas Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreleased whiteboard runtime model with a typed Academic Canvas schema that can persist, render, create, group, and export Literature, Quote, Note, Question, Claim, and Frame objects alongside the existing basic objects.

**Architecture:** Introduce pure discriminated-union model modules beside the current runtime, then cut the React Flow adapter, JSON Canvas codec, host storage, and UI over to the new `CanvasDocument` boundary. JSON Canvas owns standard geometry and readable fallback text; the named `bamboo` extension owns academic payloads, Frame membership, visual details, and semantic relationship data.

**Tech Stack:** TypeScript 6, React 19, `@xyflow/react` 12, JSON Canvas-compatible JSON, Zotero Plugin Scaffold, Node test runner through `tsx`, pnpm 9.

**Spec:** `docs/superpowers/specs/2026-09-03-academic-canvas-schema-design.md`

## Global Constraints

- The product is unreleased; do not add migration logic for `.board` or `.zmdboard` runtime documents.
- Preserve the basic kinds `item`, `pdf`, `attachment`, `text`, `rect`, `ellipse`, `line`, and `arrow`; `note` becomes an Academic Node.
- Academic kinds are `literature`, `quote`, `note`, `question`, `claim`, and `frame`.
- Academic relationships are exactly `related`, `supports`, and `contradicts`; the schema permits any existing nodes as endpoints.
- Persist Zotero native library identity and object keys, never local integer item IDs or Better BibTeX citation keys, in Academic Nodes.
- A node may belong to at most one Frame; Frames cannot belong to Frames.
- Member coordinates remain absolute canvas coordinates.
- Unknown root, node, edge, and Bamboo fields must survive a Bamboo read/write round trip.
- Standard JSON Canvas files without Bamboo extensions remain importable as basic objects.
- Zotero APIs stay outside `packages/whiteboard`.
- No new runtime dependency is required for schema validation.
- Every behavioral task follows red-green-refactor and ends with a focused commit.

---

## File Structure

Create these canonical model units:

- `packages/whiteboard/src/model/core.ts`: shared geometry, metadata, style, extension, and parser primitives.
- `packages/whiteboard/src/model/basic.ts`: typed retained basic objects and their creation defaults.
- `packages/whiteboard/src/model/academic.ts`: Zotero references, source snapshots, six Academic Nodes, and academic factories.
- `packages/whiteboard/src/model/connection.ts`: Basic and Academic Connection definitions and factories.
- `packages/whiteboard/src/model/document.ts`: `CanvasDocument`, diagnostics, validation, repair, and empty/demo documents.
- `packages/whiteboard/src/model/canvas-file.ts`: the new JSON Canvas codec only; delete legacy-format branches.
- `packages/whiteboard/src/nodes/academic.tsx`: Literature, Quote, Note, Question, Claim, and Frame renderers.
- `packages/whiteboard/src/chrome/labels.tsx`: localized whiteboard-label context consumed by node renderers.
- `packages/whiteboard/src/whiteboard/frame.ts`: pure Frame membership, move, and delete operations.

Modify these integration units:

- `packages/whiteboard/src/model/index.ts`: export the new canonical model.
- `packages/whiteboard/src/whiteboard/document.ts`: adapt canonical objects to and from React Flow.
- `packages/whiteboard/src/whiteboard/app.tsx`: consume `CanvasDocument`, create Academic Nodes, and apply Frame operations.
- `packages/whiteboard/src/whiteboard/export.ts`: emit readable academic text and semantic relationship labels.
- `packages/whiteboard/src/nodes/types.ts`, `registry.ts`, `index.ts`, `CardShell.tsx`, and existing node files: use the new flow-data and label contracts.
- `packages/whiteboard/src/chrome/tools.ts`, `draw.ts`, `TopIsland.tsx`, and icons: expose Note, Question, Claim, and Frame creation.
- `packages/whiteboard/src/model/protocol.ts`: send `CanvasDocument` and new localized labels.
- `src/modules/whiteboard/file-io.ts`, `editor.ts`, `save-coordinator.ts`, `create.ts`, and `tab.ts`: use the new document and storage APIs.
- `src/modules/whiteboard/snapshot.ts`: compatibility re-export of `model/document.ts` during package integration; it must not contain an independent schema.
- `package.json`: replace obsolete whiteboard tests with the new focused tests in `test:unit`.

---

### Task 1: Add the Canonical Core, Basic, Academic, and Connection Types

**Files:**

- Create: `packages/whiteboard/src/model/core.ts`
- Create: `packages/whiteboard/src/model/basic.ts`
- Create: `packages/whiteboard/src/model/academic.ts`
- Create: `packages/whiteboard/src/model/connection.ts`
- Modify: `packages/whiteboard/src/model/index.ts`
- Create: `test/whiteboard-academic-model.test.ts`

**Interfaces:**

- Produces: `CanvasNodeBase`, `CanvasNodeStyle`, `CanvasNode`, `CanvasNodeKind`, `BasicNode`, `AcademicNode`, `ZoteroLibraryRef`, `LiteratureSource`, `QuoteSource`, `NoteSource`, `LiteratureSnapshot`, `QuoteSnapshot`, `AcademicRelation`, `CanvasConnection`, `createBasicNode()`, `createAcademicNode()`, and `createAcademicConnection()`.
- Consumes: no Zotero or React types.

- [ ] **Step 1: Write the failing model test**

Create `test/whiteboard-academic-model.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createAcademicConnection,
  createAcademicNode,
  type LiteratureNode,
  type QuoteNode,
} from "../packages/whiteboard/src/model/index.ts";

const user = { type: "user" } as const;

test("creates the six academic object kinds with explicit defaults", () => {
  const note = createAcademicNode("note", { x: 10, y: 20 }, "note-1");
  const question = createAcademicNode(
    "question",
    { x: 20, y: 30 },
    "question-1",
  );
  const claim = createAcademicNode("claim", { x: 30, y: 40 }, "claim-1");
  const frame = createAcademicNode("frame", { x: 0, y: 0 }, "frame-1");

  assert.equal(note.kind, "note");
  assert.equal(note.content, "");
  assert.equal(question.kind, "question");
  assert.equal(question.content, "");
  assert.equal(claim.kind, "claim");
  assert.equal(claim.content, "");
  assert.equal(frame.kind, "frame");
  assert.equal(frame.title, "Frame");
});

test("literature and quote factories require native Zotero keys and snapshots", () => {
  const literature: LiteratureNode = createAcademicNode(
    "literature",
    { x: 0, y: 0 },
    "lit-1",
    {
      source: { library: user, itemKey: "ABCD1234" },
      snapshot: { title: "A paper", creators: "Smith", year: "2026" },
    },
  );
  const quote: QuoteNode = createAcademicNode(
    "quote",
    { x: 280, y: 0 },
    "quote-1",
    {
      source: {
        library: user,
        itemKey: "ABCD1234",
        attachmentKey: "PDFD1234",
        annotationKey: "ANNO1234",
      },
      snapshot: { text: "Evidence", pageLabel: "12", color: "#ffd400" },
    },
  );

  assert.equal(literature.source.itemKey, "ABCD1234");
  assert.equal(quote.source.annotationKey, "ANNO1234");
});

test("academic relationships allow arbitrary existing endpoint kinds", () => {
  const edge = createAcademicConnection(
    "edge-1",
    "rect-1",
    "question-1",
    "contradicts",
  );
  assert.deepEqual(edge, {
    id: "edge-1",
    kind: "academic",
    source: "rect-1",
    target: "question-1",
    relation: "contradicts",
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `pnpm exec tsx --test test/whiteboard-academic-model.test.ts`

Expected: FAIL because the new factories and types are not exported.

- [ ] **Step 3: Implement the pure type modules**

Define the exact public unions in the new files:

```ts
// core.ts
export interface CanvasPoint {
  x: number;
  y: number;
}
export interface CanvasViewport extends CanvasPoint {
  zoom: number;
}
export interface CanvasMetadata {
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface CanvasNodeStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  radius?: number;
  dashed?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  textColor?: string;
  textOpacity?: number;
  strokeOpacity?: number;
  fillStyle?: "none" | "solid" | "hatch";
  strokeStyle?: "solid" | "dotted" | "dashed";
}
export interface CanvasNodeBase<K extends string> {
  id: string;
  kind: K;
  position: CanvasPoint;
  width: number;
  height: number;
  frameId?: string;
  style?: CanvasNodeStyle;
  extensions?: Record<string, unknown>;
}
```

```ts
// academic.ts
export type AcademicNodeKind =
  "literature" | "quote" | "note" | "question" | "claim" | "frame";
export type ZoteroLibraryRef =
  { type: "user" } | { type: "group"; groupID: number };
export interface LiteratureSource {
  library: ZoteroLibraryRef;
  itemKey: string;
}
export interface QuoteSource extends LiteratureSource {
  attachmentKey: string;
  annotationKey: string;
}
export interface NoteSource {
  library: ZoteroLibraryRef;
  noteKey: string;
  itemKey?: string;
}
export interface LiteratureSnapshot {
  title: string;
  creators?: string;
  year?: string;
  publicationTitle?: string;
  tags?: string[];
  annotationCount?: number;
}
export interface QuoteSnapshot {
  text: string;
  comment?: string;
  citation?: string;
  pageLabel?: string;
  color?: string;
}
export interface NoteSourceSnapshot {
  title?: string;
}
```

Implement `LiteratureNode`, `QuoteNode`, `NoteNode`, `QuestionNode`, `ClaimNode`, and `FrameNode` exactly as specified. Use overloads for `createAcademicNode()` so Literature and Quote require their source and snapshot arguments while the four locally creatable kinds have defaults. Default sizes are Literature `280x136`, Quote `280x168`, Note `260x152`, Question `260x128`, Claim `260x128`, and Frame `480x320`.

Define retained Basic Nodes in `basic.ts` as a union over `item`, `pdf`, `attachment`, `text`, `rect`, `ellipse`, `line`, and `arrow`. Move the current defaults from `createBoardNode()` into `createBasicNode()` and keep visual properties under `style`; retain source-card payload fields under explicitly typed `data` objects.

Define connections in `connection.ts`:

```ts
export type AcademicRelation = "related" | "supports" | "contradicts";
export interface CanvasConnectionBase {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  color?: string;
  dashed?: boolean;
  arrow?: boolean;
  extensions?: Record<string, unknown>;
}
export interface BasicConnection extends CanvasConnectionBase {
  kind: "basic";
}
export interface AcademicConnection extends CanvasConnectionBase {
  kind: "academic";
  relation: AcademicRelation;
}
export type CanvasConnection = BasicConnection | AcademicConnection;
```

`createAcademicConnection(id, source, target, relation = "related")` returns only the five required fields demonstrated in the test.

- [ ] **Step 4: Export the model and verify green**

Replace `packages/whiteboard/src/model/index.ts` exports with explicit star exports for `core`, `basic`, `academic`, and `connection`, while temporarily retaining the existing `snapshot`, `protocol`, and `canvas-file` exports until the cutover task.

Run: `pnpm exec tsx --test test/whiteboard-academic-model.test.ts && pnpm exec tsc --noEmit`

Expected: the focused tests pass and TypeScript exits with status 0.

- [ ] **Step 5: Commit**

```bash
git add packages/whiteboard/src/model test/whiteboard-academic-model.test.ts
git commit -m "feat(canvas): add academic object model"
```

---

### Task 2: Add Strict Document Parsing With Recoverable Diagnostics

**Files:**

- Create: `packages/whiteboard/src/model/document.ts`
- Modify: `packages/whiteboard/src/model/index.ts`
- Create: `test/whiteboard-academic-document.test.ts`

**Interfaces:**

- Consumes: `CanvasNode`, `CanvasConnection`, `CanvasViewport`, and `CanvasMetadata` from Task 1.
- Produces: `CANVAS_DOCUMENT_VERSION`, `CanvasDocument`, `CanvasParseIssue`, `CanvasParseResult`, `CanvasDocumentError`, `emptyCanvasDocument()`, `demoCanvasDocument()`, and `parseCanvasDocument()`.

- [ ] **Step 1: Write failing parser tests**

Create `test/whiteboard-academic-document.test.ts` with these cases:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  CanvasDocumentError,
  parseCanvasDocument,
} from "../packages/whiteboard/src/model/document.ts";

test("rejects a wholly invalid Bamboo document", () => {
  assert.throws(
    () => parseCanvasDocument({ version: 2, nodes: "bad", connections: [] }),
    CanvasDocumentError,
  );
});

test("repairs dangling connections and invalid frame membership", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      {
        id: "frame-1",
        kind: "frame",
        position: { x: 0, y: 0 },
        width: 400,
        height: 300,
        title: "Topic",
      },
      {
        id: "claim-1",
        kind: "claim",
        position: { x: 20, y: 30 },
        width: 240,
        height: 120,
        frameId: "missing-frame",
        content: "Claim",
      },
    ],
    connections: [
      {
        id: "bad-edge",
        kind: "academic",
        source: "claim-1",
        target: "missing",
        relation: "supports",
      },
    ],
  });

  assert.equal(result.document.nodes[1].frameId, undefined);
  assert.deepEqual(result.document.connections, []);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["invalid-frame", "dangling-connection"],
  );
});

test("allows semantic relationships between arbitrary existing nodes", () => {
  const result = parseCanvasDocument({
    version: 2,
    nodes: [
      {
        id: "rect-1",
        kind: "rect",
        position: { x: 0, y: 0 },
        width: 100,
        height: 80,
        data: { title: "Context" },
      },
      {
        id: "question-1",
        kind: "question",
        position: { x: 200, y: 0 },
        width: 240,
        height: 120,
        content: "Why?",
      },
    ],
    connections: [
      {
        id: "edge-1",
        kind: "academic",
        source: "rect-1",
        target: "question-1",
        relation: "supports",
      },
    ],
  });
  assert.equal(result.document.connections[0].kind, "academic");
});
```

Add cases for duplicate IDs, Frame nesting, non-finite coordinates, non-positive dimensions, empty Zotero keys, malformed individual nodes, all six academic payloads, and unknown `extensions` preservation.

- [ ] **Step 2: Run the parser tests and verify red**

Run: `pnpm exec tsx --test test/whiteboard-academic-document.test.ts`

Expected: FAIL because `model/document.ts` does not exist.

- [ ] **Step 3: Implement document parsing and diagnostics**

Use these public definitions:

```ts
export const CANVAS_DOCUMENT_VERSION = 2 as const;
export interface CanvasDocument {
  version: typeof CANVAS_DOCUMENT_VERSION;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  viewport?: CanvasViewport;
  metadata?: CanvasMetadata;
  extensions?: Record<string, unknown>;
}
export type CanvasParseIssueCode =
  | "malformed-node"
  | "duplicate-node-id"
  | "malformed-connection"
  | "duplicate-connection-id"
  | "dangling-connection"
  | "invalid-frame"
  | "nested-frame";
export interface CanvasParseIssue {
  code: CanvasParseIssueCode;
  id?: string;
  message: string;
}
export interface CanvasParseResult {
  document: CanvasDocument;
  issues: CanvasParseIssue[];
}
export class CanvasDocumentError extends Error {}
export function parseCanvasDocument(value: unknown): CanvasParseResult;
```

Implement small internal parsers for shared geometry, library references, each discriminated node kind, and each connection kind. `parseCanvasDocument()` must:

1. throw `CanvasDocumentError` for a non-object root, a version other than `2`, or missing/non-array `nodes` and `connections`;
2. parse nodes in source order, dropping malformed and duplicate records with issues;
3. clear an unknown/non-Frame `frameId` and every Frame's own `frameId` with issues;
4. parse connections in source order, dropping malformed, duplicate, or dangling records with issues;
5. preserve unknown values only through explicit `extensions` records;
6. return an empty issue list for a valid document.

`emptyCanvasDocument()` returns version `2`, empty arrays, and viewport `{ x: 0, y: 0, zoom: 1 }`. `demoCanvasDocument()` contains one Literature, one Quote, one Claim, one `supports` connection, and no Zotero integer IDs.

- [ ] **Step 4: Run focused and model tests**

Run: `pnpm exec tsx --test test/whiteboard-academic-model.test.ts test/whiteboard-academic-document.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/whiteboard/src/model/document.ts packages/whiteboard/src/model/index.ts test/whiteboard-academic-document.test.ts
git commit -m "feat(canvas): validate academic documents"
```

---

### Task 3: Replace the JSON Canvas Codec

**Files:**

- Replace: `packages/whiteboard/src/model/canvas-file.ts`
- Replace: `test/whiteboard-canvas-file.test.ts`

**Interfaces:**

- Consumes: `CanvasDocument` and `parseCanvasDocument()` from Task 2.
- Produces: `CanvasFile`, `CanvasFileNode`, `CanvasFileEdge`, `CanvasFileOptions`, `ParsedCanvasFile`, `canvasDocumentToFile()`, `canvasFileToDocument()`, `parseStoredCanvas()`, and `serializeCanvasDocument()`.

- [ ] **Step 1: Replace the codec tests with v2 expectations**

Build a valid document fixture containing a Literature, Quote, Note, Question, Claim, Frame, rect, a Basic Connection, and all three Academic Connection relations. Assert these exact rules:

```ts
const file = canvasDocumentToFile(document, {
  title: "Review",
  now: "2026-09-03T00:00:00.000Z",
});

assert.equal(file.version, 1); // JSON Canvas format version
assert.equal(file.bamboo.schemaVersion, 2); // Bamboo schema version
assert.equal(file.nodes.find((node) => node.id === "lit-1")?.type, "text");
assert.match(
  String(file.nodes.find((node) => node.id === "lit-1")?.text),
  /A paper/,
);
assert.equal(file.nodes.find((node) => node.id === "frame-1")?.type, "group");
assert.equal(
  file.edges.find((edge) => edge.id === "supports-1")?.bamboo?.relation,
  "supports",
);
```

Add tests that:

- round-trip Zotero user/group references, snapshots, Frame membership, styles, and all connection data;
- preserve unknown root, node, edge, and nested Bamboo extension fields;
- import a standard JSON Canvas `text` node as a Basic text object and `group` node as a Frame;
- reject unsupported `bamboo.schemaVersion` with `CanvasDocumentError`;
- return recoverable parser issues from malformed individual records;
- reject legacy `{ v: 1, engine: "xyflow" }` documents instead of silently converting them.

- [ ] **Step 2: Run the codec test and verify red**

Run: `pnpm exec tsx --test test/whiteboard-canvas-file.test.ts`

Expected: FAIL because the current codec emits schema version `1` and legacy fallback behavior.

- [ ] **Step 3: Implement the new codec**

Use JSON Canvas version `1` and Bamboo schema version `2`:

```ts
export const JSON_CANVAS_VERSION = 1 as const;
export interface ParsedCanvasFile {
  document: CanvasDocument;
  issues: CanvasParseIssue[];
}
export function canvasDocumentToFile(
  document: CanvasDocument,
  options?: CanvasFileOptions,
): CanvasFile;
export function canvasFileToDocument(value: unknown): ParsedCanvasFile;
export function parseStoredCanvas(value: unknown): ParsedCanvasFile;
export function serializeCanvasDocument(
  document: CanvasDocument,
  options?: CanvasFileOptions,
): string;
```

Encode readable fallback text as follows:

```ts
function academicText(node: AcademicNode): string {
  switch (node.kind) {
    case "literature":
      return [node.snapshot.title, node.snapshot.creators, node.snapshot.year]
        .filter(Boolean)
        .join("\n\n");
    case "quote":
      return [
        node.snapshot.text,
        node.snapshot.citation,
        node.snapshot.pageLabel,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "note":
    case "question":
    case "claim":
      return node.content;
    case "frame":
      return node.title;
  }
}
```

Store the full discriminated payload under `node.bamboo.node`, `frameId` under `node.bamboo.frameId`, connection kind/relation under `edge.bamboo`, and unknown Bamboo data under `bamboo.extensions`. Standard files without `bamboo` map `text` to a Basic text node and `group` to a Frame. Generate deterministic fallback IDs only when an imported standard node has a valid string ID; do not invent identity for malformed records.

Delete `StoredCanvasFormat`, legacy serialization, `legacyDocument()`, and every `format: "legacy"` branch.

- [ ] **Step 4: Verify codec and parser tests**

Run: `pnpm exec tsx --test test/whiteboard-academic-document.test.ts test/whiteboard-canvas-file.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/whiteboard/src/model/canvas-file.ts test/whiteboard-canvas-file.test.ts
git commit -m "feat(canvas): encode academic canvas files"
```

---

### Task 4: Cut React Flow Over to the Canonical Model

**Files:**

- Modify: `packages/whiteboard/src/nodes/types.ts`
- Modify: `packages/whiteboard/src/whiteboard/document.ts`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `packages/whiteboard/src/whiteboard/layout.ts`
- Modify: `packages/whiteboard/src/chrome/StyleBar.tsx`
- Modify: `packages/whiteboard/src/chrome/TextStyleBar.tsx`
- Replace: `test/whiteboard-app-state.test.ts`
- Modify: `test/whiteboard-draw.test.ts`

**Interfaces:**

- Consumes: `CanvasDocument`, `CanvasNode`, and `CanvasConnection` from Tasks 1-2.
- Produces: `CanvasFlowData`, `CanvasFlowNode`, `canvasDocumentToFlow()`, `flowToCanvasDocument()`, `CanvasDocumentHistory`, `updateFlowNodeModel()`, `flowNodeText()`, and retained style helpers.

- [ ] **Step 1: Write failing adapter and history tests**

Replace the document-facing portions of `test/whiteboard-app-state.test.ts` with tests that assert:

```ts
const flow = canvasDocumentToFlow(document);
assert.equal(flow.nodes[0].data.model.kind, "literature");
assert.equal(flow.nodes[0].position.x, document.nodes[0].position.x);

const restored = flowToCanvasDocument(flow.nodes, flow.edges, {
  x: 12,
  y: -8,
  zoom: 1.25,
});
assert.equal(restored.nodes[0].kind, "literature");
assert.equal(restored.connections[0].kind, "academic");
assert.equal(restored.viewport?.zoom, 1.25);
```

Retain coverage for arrow opt-out, edge color updates, history replacement, editing-style merge, and vertical alignment. Update those assertions to read or write `node.data.model.style` and Academic `content` instead of the old open-ended `node.data` bag.

- [ ] **Step 2: Run the focused test and verify red**

Run: `pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-draw.test.ts`

Expected: FAIL because the adapter still consumes `BoardDocument` and flattened node data.

- [ ] **Step 3: Implement the flow adapter**

Define:

```ts
export interface CanvasFlowData extends Record<string, unknown> {
  model: CanvasNode;
}
export type CanvasFlowNode = Node<CanvasFlowData, CanvasNodeKind>;
```

`canvasDocumentToFlow()` maps canonical geometry to React Flow fields and keeps the canonical object in `data.model`. `flowToCanvasDocument()` copies React Flow position and measured dimensions back over the model, maps edge rendering fields back into the typed connection, and returns version `2`.

Rename `BoardDocumentHistory` to `CanvasDocumentHistory`. Keep the revision, maximum history length `80`, replace, undo, and redo behavior unchanged.

Add narrow helpers so UI files never mutate the canonical object indirectly:

```ts
export function updateFlowNodeModel(
  node: CanvasFlowNode,
  update: (model: CanvasNode) => CanvasNode,
): CanvasFlowNode {
  const model = update(node.data.model);
  return { ...node, type: model.kind, data: { ...node.data, model } };
}

export function flowNodeText(node: CanvasFlowNode): string {
  const model = node.data.model;
  if (
    model.kind === "note" ||
    model.kind === "question" ||
    model.kind === "claim"
  ) {
    return model.content;
  }
  if (model.kind === "frame") return model.title;
  if (model.kind === "literature") return model.snapshot.title;
  if (model.kind === "quote") return model.snapshot.text;
  return model.data.title;
}
```

- [ ] **Step 4: Update the app and style consumers**

Replace `parseBoardDocument`, `BoardDocument`, `BoardNodeKind`, `AcademicNode`, and flattened `node.data` uses with the new parser result, canonical names, `CanvasFlowNode`, and `node.data.model`. Keep existing drawing, selection, save revision, undo/redo, color, alignment, resize-by-style-bar, and deletion behaviors.

When loading a snapshot, call `parseCanvasDocument(snapshot).document`. When building a snapshot, call `flowToCanvasDocument()`. Store Basic Connection data under `edge.data.connection`; `onConnect` creates a Basic Connection with `kind: "basic"`.

Update `layout.ts`, `StyleBar.tsx`, and `TextStyleBar.tsx` to consume `CanvasFlowNode` and `model.style`. Do not add Academic relationship editing controls in this task.

- [ ] **Step 5: Verify the adapter and package types**

Run: `pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-draw.test.ts && pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit`

Expected: focused tests and package typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add packages/whiteboard/src/nodes/types.ts packages/whiteboard/src/whiteboard packages/whiteboard/src/chrome/StyleBar.tsx packages/whiteboard/src/chrome/TextStyleBar.tsx test/whiteboard-app-state.test.ts test/whiteboard-draw.test.ts
git commit -m "refactor(canvas): adopt canonical graph model"
```

---

### Task 5: Render and Create the Six Academic Objects

**Files:**

- Create: `packages/whiteboard/src/chrome/labels.tsx`
- Create: `packages/whiteboard/src/nodes/academic.tsx`
- Modify: `packages/whiteboard/src/nodes/registry.ts`
- Modify: `packages/whiteboard/src/nodes/index.ts`
- Modify: `packages/whiteboard/src/nodes/CardShell.tsx`
- Modify: `packages/whiteboard/src/nodes/library.tsx`
- Modify: `packages/whiteboard/src/nodes/shapes.tsx`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `packages/whiteboard/src/chrome/tools.ts`
- Modify: `packages/whiteboard/src/chrome/draw.ts`
- Modify: `packages/whiteboard/src/chrome/TopIsland.tsx`
- Modify: `packages/whiteboard/src/whiteboard/icons.tsx`
- Modify: `packages/whiteboard/src/model/protocol.ts`
- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `addon/locale/en-US/addon.ftl`
- Modify: `addon/locale/zh-CN/addon.ftl`
- Replace: `test/whiteboard-node-registry.test.ts`
- Modify: `test/whiteboard-localization.test.ts`

**Interfaces:**

- Consumes: Academic factories and `CanvasFlowNode`.
- Produces: `WhiteboardLabelsProvider`, `useWhiteboardLabels()`, six Academic React node components, registry entries, and toolbar tools for `note`, `question`, `claim`, and `frame`.

- [ ] **Step 1: Write failing registry, render, and localization tests**

Assert the registry exposes all six Academic kinds and retained Basic kinds:

```ts
for (const kind of [
  "literature",
  "quote",
  "note",
  "question",
  "claim",
  "frame",
] as const) {
  assert.equal(getNodeSpec(kind).group, "academic");
  assert.ok(boardNodeTypes[kind]);
}
```

Server-render each Academic component inside `WhiteboardLabelsProvider`. Assert Literature includes its title, Quote includes excerpt and page, Note/Question/Claim include content, Frame includes title, and the visible kind names come from supplied test labels rather than registry English strings.

Extend localization expectations with `whiteboard-add-question`, `whiteboard-add-claim`, `whiteboard-add-frame`, `whiteboard-kind-literature`, `whiteboard-kind-quote`, `whiteboard-kind-note`, `whiteboard-kind-question`, `whiteboard-kind-claim`, and `whiteboard-kind-frame` in both locales.

- [ ] **Step 2: Run focused tests and verify red**

Run: `pnpm exec tsx --test test/whiteboard-node-registry.test.ts test/whiteboard-localization.test.ts`

Expected: FAIL because Academic renderers and labels do not exist.

- [ ] **Step 3: Add localized Academic renderers**

Implement a React context whose value is the existing `WhiteboardLabels` object. `useWhiteboardLabels()` throws a clear error outside the provider. Wrap the whiteboard host returned by `WhiteboardApp` in the provider.

Add renderer behavior:

- Literature: title, creators/year line, optional publication title, at most three tags, and annotation count.
- Quote: excerpt, optional comment, citation/page line, and a small indicator using `snapshot.color`.
- Note, Question, Claim: plain `content` with `white-space: pre-wrap`; do not add Markdown rendering.
- Frame: title and a non-interactive visual boundary with connection handles omitted.

Change `CardShell` to accept a localized `kindLabel` prop and remove its internal English `LABELS` record.

- [ ] **Step 4: Add local creation tools**

Extend `CanvasTool` and `StampKind` with `question`, `claim`, and `frame`; keep `note` as a stamp. `isLibraryKind()` becomes exactly `item | pdf | attachment`, so creating Note no longer opens the Zotero picker. Add `Q` for Question, `C` for Claim, and `F` for Frame to `toolShortcut()` and the shortcuts overlay.

Add Note, Question, Claim, and Frame buttons to one Academic toolbar group. Literature and Quote remain registry/factory-only in this phase. `addNode()` calls `createAcademicNode()` for Academic stamps and enters text editing immediately for Note, Question, Claim, and Frame.

Add the new `WhiteboardLabels` fields, host label wiring, locale strings, and simple distinct icons. Reuse the existing restrained icon vocabulary; do not add filled decorative card backgrounds.

- [ ] **Step 5: Verify renderer, toolbar, and package tests**

Run: `pnpm exec tsx --test test/whiteboard-node-registry.test.ts test/whiteboard-localization.test.ts test/whiteboard-toolbar.test.ts test/whiteboard-draw.test.ts && pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit`

Expected: all focused tests and package typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add packages/whiteboard/src/chrome packages/whiteboard/src/nodes packages/whiteboard/src/whiteboard packages/whiteboard/src/model/protocol.ts src/modules/whiteboard/tab.ts addon/locale test/whiteboard-node-registry.test.ts test/whiteboard-localization.test.ts test/whiteboard-toolbar.test.ts test/whiteboard-draw.test.ts
git commit -m "feat(canvas): render academic objects"
```

---

### Task 6: Implement Single-Level Frame Membership

**Files:**

- Create: `packages/whiteboard/src/whiteboard/frame.ts`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `packages/whiteboard/src/nodes/academic.tsx`
- Modify: `packages/whiteboard/src/whiteboard/board.css`
- Create: `test/whiteboard-frame.test.ts`

**Interfaces:**

- Consumes: `CanvasDocument`, `CanvasNode`, and absolute positions.
- Produces: `assignNodeToFrame()`, `moveFrame()`, `deleteNodeFromDocument()`, and app integration that records one history entry per Frame move.

- [ ] **Step 1: Write failing Frame operation tests**

Create `test/whiteboard-frame.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  assignNodeToFrame,
  deleteNodeFromDocument,
  moveFrame,
} from "../packages/whiteboard/src/whiteboard/frame.ts";
import { parseCanvasDocument } from "../packages/whiteboard/src/model/document.ts";

const fixture = () =>
  parseCanvasDocument({
    version: 2,
    nodes: [
      {
        id: "frame-1",
        kind: "frame",
        position: { x: 0, y: 0 },
        width: 400,
        height: 300,
        title: "Topic",
      },
      {
        id: "claim-1",
        kind: "claim",
        position: { x: 40, y: 60 },
        width: 240,
        height: 120,
        frameId: "frame-1",
        content: "Claim",
      },
    ],
    connections: [],
  }).document;

test("moving a frame applies the same absolute delta to direct members", () => {
  const moved = moveFrame(fixture(), "frame-1", { x: 100, y: 80 });
  assert.deepEqual(moved.nodes[0].position, { x: 100, y: 80 });
  assert.deepEqual(moved.nodes[1].position, { x: 140, y: 140 });
});

test("deleting a frame detaches and preserves members", () => {
  const deleted = deleteNodeFromDocument(fixture(), "frame-1");
  assert.equal(deleted.nodes.length, 1);
  assert.equal(deleted.nodes[0].id, "claim-1");
  assert.equal(deleted.nodes[0].frameId, undefined);
});

test("deleting a node removes every incident connection", () => {
  const doc = fixture();
  doc.connections.push({
    id: "edge-1",
    kind: "academic",
    source: "claim-1",
    target: "frame-1",
    relation: "related",
  });
  assert.deepEqual(deleteNodeFromDocument(doc, "claim-1").connections, []);
});

test("assignment rejects a Frame as a member", () => {
  assert.throws(() => assignNodeToFrame(fixture(), "frame-1", "frame-1"));
});
```

- [ ] **Step 2: Run the Frame test and verify red**

Run: `pnpm exec tsx --test test/whiteboard-frame.test.ts`

Expected: FAIL because `whiteboard/frame.ts` does not exist.

- [ ] **Step 3: Implement pure immutable Frame operations**

Each exported function returns a new `CanvasDocument` and preserves metadata/extensions. `assignNodeToFrame()` verifies both IDs exist, verifies the target is a Frame, and rejects a Frame member. Passing `undefined` as the Frame ID detaches the node. `moveFrame()` calculates one delta from the old Frame position and applies it to the Frame and direct members. `deleteNodeFromDocument()` applies the exact deletion rules in the tests.

- [ ] **Step 4: Integrate Frame movement and deletion**

On Frame drag start, push one history snapshot and record its previous position. During drag, move direct members by the incremental delta without pushing additional history. On drag end, clear the drag record and mark the document changed once. Route eraser, Delete key, context-menu delete, and Properties Panel delete through `deleteNodeFromDocument()`.

Do not infer membership from overlap. Provide programmatic assignment through the pure function only; the Inspector assignment UI belongs to a later phase. Render Frames below ordinary nodes with a stable z-index and `pointer-events` only on their border/title region.

- [ ] **Step 5: Verify Frame and app-state tests**

Run: `pnpm exec tsx --test test/whiteboard-frame.test.ts test/whiteboard-app-state.test.ts && pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit`

Expected: focused tests and package typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add packages/whiteboard/src/whiteboard/frame.ts packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/nodes/academic.tsx packages/whiteboard/src/whiteboard/board.css test/whiteboard-frame.test.ts
git commit -m "feat(canvas): add frame membership"
```

---

### Task 7: Cut Host Persistence and Protocols Over to Schema Version 2

**Files:**

- Modify: `src/modules/whiteboard/file-io.ts`
- Modify: `src/modules/whiteboard/create.ts`
- Modify: `src/modules/whiteboard/editor.ts`
- Modify: `src/modules/whiteboard/save-coordinator.ts`
- Modify: `src/modules/whiteboard/session-registry.ts`
- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `src/modules/whiteboard/snapshot.ts`
- Modify: `src/modules/whiteboard/protocol.ts`
- Modify: `packages/whiteboard/src/model/protocol.ts`
- Modify: `test/whiteboard-file-io.test.ts`
- Modify: `test/whiteboard-save-coordinator.test.ts`
- Modify: `test/whiteboard-save-integration.test.ts`
- Modify: `test/whiteboard-protocol.test.ts`
- Modify: `test/whiteboard-snapshot.test.ts`
- Modify: `test/whiteboard-detect.test.ts`

**Interfaces:**

- Consumes: `CanvasDocument`, `ParsedCanvasFile`, `parseStoredCanvas()`, and `serializeCanvasDocument()`.
- Produces: host read/write/save APIs that accept only schema-v2 `.canvas` documents and surface parse diagnostics.

- [ ] **Step 1: Update host-facing tests to the new contract**

Change save snapshots to:

```ts
export interface WhiteboardSaveSnapshot {
  rev: number;
  document: CanvasDocument;
}
```

Update file-I/O tests to assert:

```ts
const result = await readCanvasFile("/tmp/review.canvas", { readUTF8 });
assert.equal(result.document.version, 2);
assert.deepEqual(result.issues, []);
```

Assert `ensureCanvasExtension("review.board")` returns `review.board.canvas`, the open-file picker advertises only `Research Canvas (*.canvas)`, and schema-v1/legacy input rejects with a clear error. Keep atomic same-directory `tmpPath` and `flush: true` assertions.

- [ ] **Step 2: Run host tests and verify red**

Run: `pnpm exec tsx --test test/whiteboard-file-io.test.ts test/whiteboard-save-coordinator.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-protocol.test.ts test/whiteboard-snapshot.test.ts test/whiteboard-detect.test.ts`

Expected: FAIL because host APIs still accept `BoardDocument`, format switches, and legacy suffixes.

- [ ] **Step 3: Replace file-I/O and save types**

Rename `readBoardFile()` to `readCanvasFile()` and `writeBoardFile()` to `writeCanvasFile()`. Remove `StoredCanvasFormat`, `canvasFormatForPath()`, legacy picker filters, and format parameters. Keep the injected atomic writer contract:

```ts
export async function writeCanvasFile(
  path: string,
  document: CanvasDocument,
  options: { writeUTF8?: AtomicWriteUTF8 } = {},
): Promise<string> {
  const target = ensureCanvasExtension(path);
  await (options.writeUTF8 ?? IOUtils.writeUTF8)(
    target,
    serializeCanvasDocument(document),
    { tmpPath: `${target}.tmp`, flush: true },
  );
  return target;
}
```

`readCanvasFile()` returns `ParsedCanvasFile`, not only the document. The tab
logs every issue with its code and affected object ID. Do not add user-facing
parse-warning UI in this phase; the returned diagnostics are the later UI
boundary required by the spec.

- [ ] **Step 4: Update protocol, creation, save, and compatibility re-exports**

Change snapshot payloads and runtime methods to `CanvasDocument`. `createWhiteboardAttachment()` serializes `emptyCanvasDocument()`. The host mount passes `parsed.document`. The save coordinator, shutdown flush, autosave interval `800ms`, and close-before-flush behavior remain unchanged.

Replace `src/modules/whiteboard/snapshot.ts` with:

```ts
export * from "../../../packages/whiteboard/src/model/document";
export * from "../../../packages/whiteboard/src/model/basic";
export * from "../../../packages/whiteboard/src/model/academic";
export * from "../../../packages/whiteboard/src/model/connection";
```

Remove host handling that persists Academic Zotero references as integer IDs.
Existing Basic `item`, `pdf`, and `attachment` picker/drop flows may continue
using their explicitly typed Basic payloads until the later Zotero Academic
integration phase. Remove `"note"` from the `pickItem` protocol kind union
because Academic Note is now local content. When the existing collection-board
command encounters a Zotero Note, copy its plain-text content into a local
Academic Note without persisting its integer ID; the later Zotero Academic
integration phase will add native-key source capture.

- [ ] **Step 5: Verify host tests and root typecheck**

Run: `pnpm exec tsx --test test/whiteboard-file-io.test.ts test/whiteboard-save-coordinator.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-protocol.test.ts test/whiteboard-snapshot.test.ts test/whiteboard-detect.test.ts && pnpm exec tsc --noEmit`

Expected: focused tests pass and root TypeScript exits with status 0.

- [ ] **Step 6: Commit**

```bash
git add src/modules/whiteboard packages/whiteboard/src/model/protocol.ts test/whiteboard-file-io.test.ts test/whiteboard-save-coordinator.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-protocol.test.ts test/whiteboard-snapshot.test.ts test/whiteboard-detect.test.ts
git commit -m "refactor(canvas): adopt academic persistence"
```

---

### Task 8: Make Export Understand Academic Content and Relationships

**Files:**

- Modify: `packages/whiteboard/src/whiteboard/export.ts`
- Replace: `test/whiteboard-export.test.ts`

**Interfaces:**

- Consumes: `CanvasDocument`, all Academic Nodes, Basic/Academic Connections, and the existing SVG-to-PNG converter.
- Produces: `buildCanvasSvg()`, `buildCanvasMarkdown()`, `svgToPngDataUrl()`, and readable fallback output for every Academic kind.

- [ ] **Step 1: Write failing academic export tests**

Use a fixture containing all six Academic kinds and assert:

```ts
const markdown = buildCanvasMarkdown(document);
assert.match(markdown, /## Literature: A paper/);
assert.match(markdown, /> Evidence/);
assert.match(markdown, /Claim: The result generalizes/);
assert.match(markdown, /supports: Evidence → The result generalizes/);

const svg = buildCanvasSvg(document);
assert.match(svg, /A paper/);
assert.match(svg, /Evidence/);
assert.match(svg, /data-relation="supports"/);
```

Retain the current XML escaping, text-style, arrow, endpoint, shape, and contain-geometry assertions using canonical model fixtures.

- [ ] **Step 2: Run the export tests and verify red**

Run: `pnpm exec tsx --test test/whiteboard-export.test.ts`

Expected: FAIL because export still reads `BoardDocument.nodes[].data.title` and untyped edges.

- [ ] **Step 3: Implement canonical academic export**

Rename builders to `buildCanvasSvg()` and `buildCanvasMarkdown()` and update app imports. Add one exhaustive helper:

```ts
export function canvasNodeText(node: CanvasNode): string {
  switch (node.kind) {
    case "literature":
      return node.snapshot.title;
    case "quote":
      return node.snapshot.text;
    case "note":
    case "question":
    case "claim":
      return node.content;
    case "frame":
      return node.title;
    default:
      return node.data.title;
  }
}
```

SVG uses canonical geometry and styles, renders Frame before other nodes, and adds `data-relation` only for Academic Connections. Markdown groups objects by Academic kind, preserves plain Basic objects in a final `Other objects` section, and emits a `Relationships` section whose lines use the relationship value and readable endpoint text. Do not render Markdown to HTML.

- [ ] **Step 4: Verify export and app typecheck**

Run: `pnpm exec tsx --test test/whiteboard-export.test.ts test/whiteboard-app-state.test.ts && pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit`

Expected: focused tests and package typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add packages/whiteboard/src/whiteboard/export.ts packages/whiteboard/src/whiteboard/app.tsx test/whiteboard-export.test.ts
git commit -m "feat(canvas): export academic graphs"
```

---

### Task 9: Remove the Old Schema and Verify the Finished Phase

**Files:**

- Delete: `packages/whiteboard/src/model/snapshot.ts`
- Modify: `packages/whiteboard/src/model/index.ts`
- Modify: `packages/whiteboard/src/index.ts`
- Modify: `src/modules/whiteboard/index.ts`
- Modify: `package.json`
- Verify: all whiteboard package, host, locale, and test files changed by Tasks 1-8

**Interfaces:**

- Consumes: the canonical model, codec, UI, host, and export APIs.
- Produces: one schema authority, a green full suite, two green production builds, and no legacy runtime-format branches.

- [ ] **Step 1: Add all new tests to the unit suite**

Add these exact paths to `test:unit`:

```text
test/whiteboard-academic-model.test.ts
test/whiteboard-academic-document.test.ts
test/whiteboard-frame.test.ts
```

Keep the updated existing whiteboard tests. Remove a test path only if its file was explicitly replaced or deleted in this plan.

- [ ] **Step 2: Delete the old schema authority and stale exports**

Delete `packages/whiteboard/src/model/snapshot.ts`. Remove its export from `model/index.ts`; export `core`, `basic`, `academic`, `connection`, `document`, `canvas-file`, and `protocol`. Update package/plugin entry points to expose `CanvasDocument`, `CanvasNode`, `CanvasConnection`, and the new factories.

Search:

```bash
rg -n "BoardDocument|BoardNodeData|BoardNodeKind|BoardEdge|BOARD_ENGINE|StoredCanvasFormat|format: \"legacy\"|\.zmdboard|\.board\b|parseBoardDocument|serializeStoredCanvas|boardDocumentTo" packages/whiteboard/src src/modules/whiteboard test/whiteboard-*.test.ts
```

Expected: no matches except an intentional user-facing explanation in a test that asserts legacy input rejection. Rename remaining `Board` implementation symbols to `Canvas` where they describe the new domain document; CSS class names may remain stable.

- [ ] **Step 3: Run formatting and lint checks**

Run:

```bash
pnpm exec prettier --check packages/whiteboard src/modules/whiteboard test/whiteboard-*.test.ts addon/locale docs/superpowers/specs/2026-09-03-academic-canvas-schema-design.md docs/superpowers/plans/2026-09-03-academic-canvas-schema.md
pnpm exec eslint packages/whiteboard/src src/modules/whiteboard test/whiteboard-*.test.ts
```

Expected: both commands exit with status 0. If formatting fails, run Prettier `--write` on exactly the listed paths, inspect the diff, and rerun both checks.

- [ ] **Step 4: Run the full unit suite and both builds**

Run:

```bash
pnpm test:unit
pnpm whiteboard:build
pnpm build
pnpm exec tsc --noEmit
```

Expected: every command exits with status 0.

- [ ] **Step 5: Perform standalone visual smoke checks**

Run: `pnpm whiteboard:dev -- --host 127.0.0.1`

Inspect `http://127.0.0.1:5173/` at `900x840` and `390x844`. Verify:

- Literature, Quote, Note, Question, Claim, and Frame are visibly distinct and readable.
- Note, Question, Claim, and Frame can be created and edited.
- The toolbar remains reachable without horizontal clipping.
- Frame renders behind its members and moving it moves members once.
- Selection, connection, undo, redo, save-state display, dark mode, and fit-view remain functional.
- No node displays an internal kind key or untranslated English when Chinese labels are active.

Stop the dev server after inspection.

- [ ] **Step 6: Check scope and commit cleanup**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors or generated `packages/whiteboard/dist` files; changes are limited to the schema, codec, adapter, Academic UI, Frame behavior, host integration, export, localization, tests, and this plan.

```bash
git add packages/whiteboard src/modules/whiteboard addon/locale test package.json docs/superpowers/plans/2026-09-03-academic-canvas-schema.md
git commit -m "refactor(canvas): remove experimental board schema"
```

---

## Execution Notes

- Run tasks in order. Tasks 1-3 deliberately introduce the pure schema beside the current runtime so their focused commits remain type-safe before the integration cutover.
- Task 4 is the only broad adapter migration. Keep its changes mechanical and do not add new UI behavior there.
- Task 5 owns visible Academic behavior and localization.
- Task 6 owns all Frame invariants and mutations; do not duplicate Frame logic in React callbacks.
- Task 7 is the storage cutover point. After it, newly created and opened files use only Bamboo schema version `2`.
- Task 9 is the removal gate. Do not delete the old schema before all production consumers have moved.
