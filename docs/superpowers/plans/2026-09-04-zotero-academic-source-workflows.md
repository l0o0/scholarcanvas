# Zotero Academic Source Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Zotero Regular Items, Notes, and supported PDF annotations to the existing Literature, Note, and Quote canvas schema with snapshot-first progressive resolution.

**Architecture:** Keep Zotero APIs in a focused host-side source gateway and communicate with the isolated React canvas through a strict version-2 protocol. Render persisted snapshots immediately, resolve sources through a cancellable four-worker priority queue, and keep source availability outside the persisted document.

**Tech Stack:** TypeScript, Zotero 7 JavaScript APIs, React 19, `@xyflow/react`, Node test runner through `tsx --test`, Fluent localization, pnpm.

## Global Constraints

- Literature accepts only `item.isRegularItem()`.
- Zotero Notes import as independent Academic Notes; only confirmed manual refresh may overwrite local content.
- Only non-empty PDF `highlight` and `underline` annotations under a Regular Item become Quotes.
- Attachments create no new nodes; basic `item`, `pdf`, and `attachment` kinds remain parseable and renderable but lose user-facing acquisition entry points.
- Academic persistence uses Zotero native `library + key` references, never local integer IDs or Better BibTeX keys.
- Initial canvas rendering performs no blocking Zotero lookup.
- Resolution priority is explicit/selected, visible, then idle; at most four lookups run concurrently.
- Source resolution failures preserve snapshots and never fail canvas loading.
- Adding Quotes creates no automatic connection.
- No Zotero Reader command, annotation drag-and-drop, image/ink/EPUB/web annotation, notifier live update, or new Academic node kind is included.
- Follow TDD for every task and keep the production build passing at every commit.

## File Structure

### New files

- `src/modules/whiteboard/source-gateway.ts` — Zotero library/key mapping, source acquisition, exact resolution, Note text conversion, annotation listing, and source opening.
- `src/modules/whiteboard/source-scheduler.ts` — session-scoped prioritized queue, four-worker concurrency, request coalescing, promotion, generation cancellation, and incremental result delivery.
- `packages/whiteboard/src/whiteboard/sourceState.ts` — pure source descriptors, cache keys, transient node states, viewport priority calculation, and snapshot application.
- `packages/whiteboard/src/chrome/AnnotationBrowser.tsx` — Literature annotation search, selection, duplicate state, and batch-add overlay.
- `test/whiteboard-source-gateway.test.ts` — host gateway contract tests with structural Zotero doubles.
- `test/whiteboard-source-scheduler.test.ts` — deterministic queue tests with deferred promises.
- `test/whiteboard-source-state.test.ts` — pure iframe state and snapshot-update tests.
- `test/whiteboard-annotation-browser.test.ts` — server-render and pure annotation-browser state tests.

### Existing files changed

- `packages/whiteboard/src/model/protocol.ts` — strict protocol v2 Academic request/response unions and labels.
- `src/modules/whiteboard/editor.ts` — v2 bridge callbacks and response methods.
- `packages/whiteboard/src/bootstrap.tsx` — v2 message forwarding and runtime dispatch.
- `packages/whiteboard/src/whiteboard/app.tsx` — Literature/Note acquisition, resolution requests, transient source state, refresh, and annotation-browser orchestration.
- `packages/whiteboard/src/chrome/TopIsland.tsx` — Literature replaces Item; PDF and Attachment buttons disappear.
- `packages/whiteboard/src/chrome/PropertiesPanel.tsx` — Academic source actions and source status.
- `packages/whiteboard/src/whiteboard/runtime.ts` — runtime methods for acquisition and incremental source results.
- `packages/whiteboard/src/whiteboard/document.ts` — non-history snapshot replacement helper.
- `packages/whiteboard/src/whiteboard/board.css` — source status and annotation overlay styles.
- `src/modules/whiteboard/tab.ts` — compose the gateway and scheduler into a session; remove PDF rendering/picker paths.
- `src/modules/whiteboard/session-registry.ts` — own and dispose the source scheduler.
- `src/modules/whiteboard/create.ts` — collection canvases emit Literature and source-backed Notes without attachment nodes.
- `addon/locale/en-US/mainWindow.ftl` and `addon/locale/zh-CN/mainWindow.ftl` — all new source and annotation-browser copy.
- Existing `test/whiteboard-*.test.ts` files — protocol, toolbar, bootstrap, app, localization, collection, save, and export regression coverage.

---

### Task 1: Define Protocol v2 and Retire Attachment Entry Points

**Files:**

- Modify: `packages/whiteboard/src/model/protocol.ts`
- Modify: `packages/whiteboard/src/chrome/TopIsland.tsx`
- Modify: `packages/whiteboard/src/chrome/tools.ts`
- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `addon/locale/en-US/mainWindow.ftl`
- Modify: `addon/locale/zh-CN/mainWindow.ftl`
- Test: `test/whiteboard-protocol.test.ts`
- Test: `test/whiteboard-toolbar.test.ts`
- Test: `test/whiteboard-draw.test.ts`
- Test: `test/whiteboard-localization.test.ts`

**Interfaces:**

- Consumes: existing `LiteratureSource`, `LiteratureSnapshot`, `NoteSource`, `NoteSourceSnapshot`, `QuoteSource`, and `QuoteSnapshot` from `model/academic.ts`.
- Produces: `AcademicSourceDescriptor`, `AcademicAcquisition`, `SourceResolutionResult`, `AnnotationCandidate`, strict `WHITEBOARD_PROTOCOL_VERSION = 2`, and Literature-only library acquisition tools.

- [ ] **Step 1: Write failing protocol and toolbar tests**

Add these assertions:

```ts
assert.equal(WHITEBOARD_PROTOCOL_VERSION, 2);
assert.equal(
  isWhiteboardProtocolMessage({
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "tab:canvas",
    v: 1,
    type: "ready",
  }),
  false,
);
assert.deepEqual(libraryTools(), ["literature"]);
assert.doesNotMatch(renderedToolbar, /Add PDF|Add file/);
```

Cover every new discriminator listed below with a valid typed fixture and reject missing `v`, missing `channel`, and wrong versions.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --test test/whiteboard-protocol.test.ts test/whiteboard-toolbar.test.ts test/whiteboard-draw.test.ts
```

Expected: FAIL because the protocol is version 1 and the toolbar still exposes `item`, `pdf`, and `attachment`.

- [ ] **Step 3: Add exact protocol DTOs**

Define these exported unions in `model/protocol.ts`:

```ts
export type AcademicSourceDescriptor =
  | { kind: "literature"; source: LiteratureSource }
  | { kind: "note"; source: NoteSource }
  | { kind: "quote"; source: QuoteSource };

export type AcademicAcquisition =
  | {
      kind: "literature";
      source: LiteratureSource;
      snapshot: LiteratureSnapshot;
    }
  | {
      kind: "note";
      source: NoteSource;
      sourceSnapshot?: NoteSourceSnapshot;
      content: string;
    }
  | { kind: "quote"; source: QuoteSource; snapshot: QuoteSnapshot };

export type SourceResolutionResult =
  | {
      nodeId: string;
      generation: number;
      status: "resolved";
      acquisition: AcademicAcquisition;
    }
  | {
      nodeId: string;
      generation: number;
      status: "unavailable";
      code:
        "library-missing" | "item-missing" | "wrong-kind" | "parent-mismatch";
      message: string;
    };

export interface AnnotationCandidate {
  acquisition: Extract<AcademicAcquisition, { kind: "quote" }>;
  attachmentTitle: string;
  sortIndex: string;
}
```

Set `WHITEBOARD_PROTOCOL_VERSION` to `2`. Require the exact version in `isWhiteboardProtocolMessage()` and exact channel equality in `isWhiteboardProtocolMessageForChannel()`.

Add parent-to-iframe messages `academicSourceAcquired`, `sourceResolutionBatch`, `annotationsListed`, `noteRefreshed`, and `academicRequestFailed`. Add iframe-to-parent messages `pickAcademicSource`, `dropAcademicSources`, `resolveAcademicSources`, `listLiteratureAnnotations`, `refreshZoteroNote`, and `openAcademicSource`. Every payload carries `requestId`; resolution messages also carry `generation`.

- [ ] **Step 4: Restrict user-facing tools**

Change the library tool surface to one Literature button:

```ts
export type CanvasTool =
  | "select"
  | "hand"
  | "eraser"
  | Exclude<CanvasNodeKind, "item" | "pdf" | "attachment" | "quote">;

export function libraryTools(): CanvasTool[] {
  return ["literature"];
}
```

Render `{ tool: "literature", title: labels.addItem, icon: <IconItem /> }` in
`TopIsland`. Change the English and Chinese values behind the existing
`whiteboard-add-item` localization key to **Add literature** and **添加文献**.
Keep basic node registry entries intact.

- [ ] **Step 5: Verify and commit**

Run the focused tests plus `pnpm exec tsc --noEmit`, then commit:

```bash
pnpm exec tsx --test test/whiteboard-protocol.test.ts test/whiteboard-toolbar.test.ts test/whiteboard-draw.test.ts test/whiteboard-localization.test.ts
pnpm exec tsc --noEmit
git add packages/whiteboard/src/model/protocol.ts packages/whiteboard/src/chrome/TopIsland.tsx packages/whiteboard/src/chrome/tools.ts src/modules/whiteboard/tab.ts addon/locale/en-US/mainWindow.ftl addon/locale/zh-CN/mainWindow.ftl test/whiteboard-protocol.test.ts test/whiteboard-toolbar.test.ts test/whiteboard-draw.test.ts test/whiteboard-localization.test.ts
git commit -m "refactor(canvas): define academic source protocol"
```

### Task 2: Build the Zotero Academic Source Gateway

**Files:**

- Create: `src/modules/whiteboard/source-gateway.ts`
- Create: `test/whiteboard-source-gateway.test.ts`
- Modify: `src/modules/whiteboard/index.ts`

**Interfaces:**

- Consumes: protocol DTOs from Task 1 and canonical academic source/snapshot types.
- Produces: `createZoteroSourceGateway(deps?)`, `noteHtmlToText(html, utilities)`, and a `ZoteroSourceGateway` with acquire, resolve, list, refresh, and open methods.

- [ ] **Step 1: Write gateway contract tests**

Use structural doubles instead of the real Zotero global. Cover user/group mapping, all four item predicates, exact key lookup, unsupported library type, wrong-kind resolution, Note parent verification, Quote three-level verification, and snapshot normalization.

The central test fixtures should assert:

```ts
const literature = gateway.acquireItem(regularItem);
assert.deepEqual(literature.source, {
  library: { type: "group", groupID: 42 },
  itemKey: "ITEMKEY",
});
assert.equal(literature.snapshot.title, "Paper title");
assert.equal("annotationCount" in literature.snapshot, false);
assert.throws(() => gateway.acquireItem(attachment), /unsupported/i);
```

For Note conversion:

```ts
assert.equal(
  noteHtmlToText("<p>First&nbsp;line</p><p>Second<br>line</p>", utilities),
  "First line\n\nSecond\nline",
);
```

- [ ] **Step 2: Run the gateway test and verify RED**

```bash
pnpm exec tsx --test test/whiteboard-source-gateway.test.ts
```

Expected: FAIL because `source-gateway.ts` does not exist.

- [ ] **Step 3: Implement the dependency boundary**

Create these exact public interfaces:

```ts
export interface SourceGatewayDependencies {
  userLibraryID: number;
  getLibrary(
    libraryID: number,
  ): { libraryType: string; groupID?: number } | null;
  groupLibraryID(groupID: number): number | null;
  getByLibraryAndKey(libraryID: number, key: string): Zotero.Item | null;
  cleanTags(html: string): string;
  unescapeHTML(html: string): string;
  openItem(item: Zotero.Item): Promise<void>;
  openNote(item: Zotero.Item): Promise<void>;
  openAnnotation(
    attachment: Zotero.Item,
    annotation: Zotero.Item,
  ): Promise<boolean>;
  openAttachmentPage(
    attachment: Zotero.Item,
    pageIndex?: number,
  ): Promise<void>;
}

export interface ZoteroSourceGateway {
  acquireItem(item: Zotero.Item): AcademicAcquisition;
  resolve(
    nodeId: string,
    generation: number,
    descriptor: AcademicSourceDescriptor,
  ): Promise<SourceResolutionResult>;
  listAnnotations(source: LiteratureSource): Promise<AnnotationCandidate[]>;
  refreshNote(
    source: NoteSource,
  ): Promise<Extract<AcademicAcquisition, { kind: "note" }>>;
  open(descriptor: AcademicSourceDescriptor): Promise<void>;
}
```

`createZoteroSourceGateway()` builds production dependencies lazily so importing the module in Node tests does not access `Zotero`. `noteHtmlToText()` calls `cleanTags`, then `unescapeHTML`, normalizes CRLF, trims line-edge spaces, limits blank runs to two newlines, and uses a DOM text-content fallback only when a Zotero utility throws.

`openAnnotation()` returns `true` only when the installed Zotero Reader accepts
exact annotation navigation. When it returns `false`, the gateway parses the
annotation's current `annotationPosition`, extracts its zero-based `pageIndex`,
and calls `openAttachmentPage()`. It never derives a page index from the display
`pageLabel`.

- [ ] **Step 4: Implement strict acquisition and resolution**

Use `item.isRegularItem()`, `item.isNote()`, `item.isAnnotation()`, and `item.isAttachment()` as the only top-level classifier. Build Literature snapshots without traversing attachments. Build Note sources with `noteKey` and an `itemKey` only when the parent is Regular. For Quote resolution, verify `annotation.parentItem.key === attachmentKey` and `annotation.parentItem.parentItem.key === itemKey` before returning current annotation fields.

`listAnnotations()` traverses only PDF child attachments, accepts only non-empty highlight/underline text, sorts by attachment title/key and `annotationSortIndex`, and returns no integer IDs.

- [ ] **Step 5: Verify and commit**

```bash
pnpm exec tsx --test test/whiteboard-source-gateway.test.ts test/whiteboard-academic-model.test.ts
pnpm exec tsc --noEmit
git add src/modules/whiteboard/source-gateway.ts src/modules/whiteboard/index.ts test/whiteboard-source-gateway.test.ts
git commit -m "feat(canvas): add Zotero academic source gateway"
```

### Task 3: Complete the Single-Literature Vertical Slice

**Files:**

- Modify: `src/modules/whiteboard/editor.ts`
- Modify: `packages/whiteboard/src/bootstrap.tsx`
- Modify: `packages/whiteboard/src/whiteboard/runtime.ts`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `src/modules/whiteboard/create.ts`
- Test: `test/whiteboard-bootstrap.test.ts`
- Test: `test/whiteboard-app-state.test.ts`
- Test: `test/whiteboard-save-integration.test.ts`
- Test: `test/whiteboard-snapshot.test.ts`

**Interfaces:**

- Consumes: `AcademicAcquisition`, protocol v2, and `ZoteroSourceGateway.acquireItem()`.
- Produces: `WhiteboardHandle.resolveAcademicAcquisition()`, Literature picker/drop integration, source-key collection canvases, and no Attachment acquisition path.

- [ ] **Step 1: Write failing bridge and vertical-slice tests**

Assert that a Literature placement emits `pickAcademicSource` with kind
`literature`, a successful reply creates `createAcademicNode("literature")`, a
failure removes the placeholder, and serialization includes `itemKey` but no
`itemID`. Update the collection fixture so its Regular Item becomes Literature
and its PDF child produces no node.

```ts
assert.equal(saved.nodes[0].kind, "literature");
assert.deepEqual(saved.nodes[0].source, {
  library: { type: "user" },
  itemKey: "ABCD2345",
});
assert.equal(JSON.stringify(saved).includes("itemID"), false);
assert.equal(
  saved.nodes.some((node) => node.kind === "pdf"),
  false,
);
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --test test/whiteboard-bootstrap.test.ts test/whiteboard-app-state.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-snapshot.test.ts
```

Expected: FAIL because the old bridge returns `BasicPickerPayload` and collection generation creates basic Item/PDF nodes.

- [ ] **Step 3: Wire protocol v2 through editor and bootstrap**

Replace `resolvePick()` with:

```ts
resolveAcademicAcquisition(
  requestId: string,
  nodeId: string,
  acquisition: AcademicAcquisition,
): void;
rejectAcademicRequest(requestId: string, nodeId: string, message: string): void;
```

Forward the v2 messages in both bridge directions. Reject messages whose event source, version, or channel does not match the current iframe.

- [ ] **Step 4: Replace picker/drop handlers**

In `tab.ts`, accept only a Regular Item for the Literature picker. For generic drops, parse every Zotero item ID but pass only Regular Items to `gateway.acquireItem()`; report Attachments and other unsupported objects without creating an asset or PDF image. Remove `promptPageNumber()`, `renderPdfPageToDataUrl()`, and the PDF/Attachment picker branches once no caller remains.

In `app.tsx`, make Literature placement create a loading placeholder, then replace it with `createAcademicNode("literature", position, nodeId, { source, snapshot })`. Commit the replacement once to history; rejection deletes the placeholder outside canonical persistence and reports the error.

- [ ] **Step 5: Update collection generation**

Build each top-level Regular Item through the same snapshot/source helpers. Keep source-backed Academic Notes already selected by collection generation, but remove PDF child nodes and their connections. Ensure collection generation never calls `getAttachments()` merely to construct Literature.

- [ ] **Step 6: Verify reopen and commit**

```bash
pnpm exec tsx --test test/whiteboard-bootstrap.test.ts test/whiteboard-app-state.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-snapshot.test.ts
pnpm exec tsc --noEmit
git add src/modules/whiteboard/editor.ts packages/whiteboard/src/bootstrap.tsx packages/whiteboard/src/whiteboard/runtime.ts packages/whiteboard/src/whiteboard/app.tsx src/modules/whiteboard/tab.ts src/modules/whiteboard/create.ts test/whiteboard-bootstrap.test.ts test/whiteboard-app-state.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-snapshot.test.ts
git commit -m "feat(canvas): acquire Zotero literature by native key"
```

### Task 4: Add Progressive Lazy Source Resolution

**Files:**

- Create: `src/modules/whiteboard/source-scheduler.ts`
- Create: `packages/whiteboard/src/whiteboard/sourceState.ts`
- Create: `test/whiteboard-source-scheduler.test.ts`
- Create: `test/whiteboard-source-state.test.ts`
- Modify: `src/modules/whiteboard/session-registry.ts`
- Modify: `src/modules/whiteboard/editor.ts`
- Modify: `packages/whiteboard/src/bootstrap.tsx`
- Modify: `packages/whiteboard/src/whiteboard/runtime.ts`
- Modify: `packages/whiteboard/src/whiteboard/document.ts`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `src/modules/whiteboard/tab.ts`

**Interfaces:**

- Consumes: `AcademicSourceDescriptor`, `SourceResolutionResult`, and `ZoteroSourceGateway.resolve()`.
- Produces: `ProgressiveSourceScheduler`, `sourceDescriptor(node)`, `sourceCacheKey(descriptor)`, `applyResolvedAcquisition(node, acquisition)`, and transient source states.

- [ ] **Step 1: Write deterministic scheduler tests**

Use deferred promises to prove priority, maximum concurrency, cache-key coalescing,
promotion, per-job failure isolation, and generation cancellation:

```ts
const scheduler = new ProgressiveSourceScheduler({
  concurrency: 4,
  run: async (job) => deferred.get(job.cacheKey)!.promise,
  emit: (results) => emitted.push(results),
});
scheduler.enqueue(idleJob);
scheduler.enqueue(visibleJob);
scheduler.enqueue(selectedJob);
assert.deepEqual(started.slice(0, 3), ["selected", "visible", "idle"]);
assert.ok(maxObservedConcurrency <= 4);
```

State tests must prove a Literature or Quote snapshot can update without touching
position, style, frame membership, selection state, or `CanvasDocumentHistory.revision`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --test test/whiteboard-source-scheduler.test.ts test/whiteboard-source-state.test.ts
```

Expected: FAIL because both modules are absent.

- [ ] **Step 3: Implement the scheduler**

Export:

```ts
export type SourcePriority = "selected" | "visible" | "idle";

export interface SourceResolutionJob {
  nodeId: string;
  generation: number;
  priority: SourcePriority;
  descriptor: AcademicSourceDescriptor;
  cacheKey: string;
}

export class ProgressiveSourceScheduler {
  constructor(options: {
    concurrency?: number;
    run(job: SourceResolutionJob): Promise<SourceResolutionResult>;
    emit(results: SourceResolutionResult[]): void;
  });
  enqueue(job: SourceResolutionJob): void;
  promote(cacheKey: string, priority: SourcePriority): void;
  cancelGeneration(generation: number): void;
  dispose(): void;
}
```

Default concurrency is four. Sort selected before visible before idle and retain
FIFO order within a priority. Coalesce one lookup per cache key but fan its result
out to every waiting node ID. Emit completed results in micro-batches. Ignore all
completion callbacks after disposal or cancellation.

- [ ] **Step 4: Implement iframe source state and priority requests**

`sourceState.ts` returns descriptors only for source-backed Literature, Quote,
and Note nodes. It applies current Literature/Quote snapshots and Note source
title only; it never changes Note content during background resolution.

In `app.tsx`, render the loaded document before emitting resolution requests.
Promote selected nodes immediately, compute visible nodes from current React Flow
viewport bounds, and schedule the remainder after an idle callback with a
`setTimeout(0)` fallback. Increment the document generation on every
`loadSnapshot()`.

- [ ] **Step 5: Own lifecycle in the session**

Add `sourceScheduler?: ProgressiveSourceScheduler` to `WhiteboardSession`.
Create it after the gateway, cancel the old generation on document replacement,
and call `dispose()` before unregistering a tab. Send incremental batches through
`WhiteboardHandle.applySourceResolutionBatch()`.

- [ ] **Step 6: Verify and commit**

```bash
pnpm exec tsx --test test/whiteboard-source-scheduler.test.ts test/whiteboard-source-state.test.ts test/whiteboard-session-registry.test.ts test/whiteboard-app-state.test.ts test/whiteboard-bootstrap.test.ts
pnpm exec tsc --noEmit
git add src/modules/whiteboard/source-scheduler.ts packages/whiteboard/src/whiteboard/sourceState.ts test/whiteboard-source-scheduler.test.ts test/whiteboard-source-state.test.ts src/modules/whiteboard/session-registry.ts src/modules/whiteboard/editor.ts packages/whiteboard/src/bootstrap.tsx packages/whiteboard/src/whiteboard/runtime.ts packages/whiteboard/src/whiteboard/document.ts packages/whiteboard/src/whiteboard/app.tsx src/modules/whiteboard/tab.ts
git commit -m "feat(canvas): resolve academic sources progressively"
```

### Task 5: Add Zotero Note Import and Confirmed Refresh

**Files:**

- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `packages/whiteboard/src/chrome/PropertiesPanel.tsx`
- Modify: `packages/whiteboard/src/model/protocol.ts`
- Modify: `addon/locale/en-US/mainWindow.ftl`
- Modify: `addon/locale/zh-CN/mainWindow.ftl`
- Test: `test/whiteboard-app-state.test.ts`
- Test: `test/whiteboard-localization.test.ts`
- Test: `test/whiteboard-save-integration.test.ts`

**Interfaces:**

- Consumes: `gateway.acquireItem(note)`, `gateway.refreshNote(source)`, and v2 Note messages.
- Produces: source-backed Note import, source status in properties, and undoable confirmed overwrite.

- [ ] **Step 1: Write failing Note interaction tests**

Cover standalone and child Note import, no automatic content update during
resolution, absence of refresh for local Notes, warning text, cancel behavior,
successful overwrite, failure preservation, undo, and save revision.

```ts
assert.equal(afterBackgroundResolution.content, "Local edit");
assert.equal(localNoteActions.includes("refresh-note"), false);
assert.equal(sourceNoteActions.includes("refresh-note"), true);
assert.equal(afterCancelledRefresh.content, "Local edit");
assert.equal(afterConfirmedRefresh.content, "Current Zotero text");
assert.equal(afterUndo.content, "Local edit");
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts
```

Expected: FAIL because Note drops are rejected and no refresh action exists.

- [ ] **Step 3: Enable Note acquisition without enabling Attachments**

Route dropped or picked Zotero Notes through `gateway.acquireItem()`. Create
`createAcademicNode("note")`, then assign `content`, `source`, and
`sourceSnapshot`. Do not expose a separate Zotero Note toolbar button; generic
Zotero dropping is sufficient while the existing Note button continues to create
a local Note.

- [ ] **Step 4: Add transactional manual refresh**

Add PropertiesPanel callbacks:

```ts
onRefreshSource(node: CanvasFlowNode): void;
onViewAnnotations(node: CanvasFlowNode): void;
```

Only a Note with `model.source` renders **Refresh from Zotero**. Use the localized
confirmation text exactly once before posting `refreshZoteroNote`. On success,
replace `content` and `sourceSnapshot` in one `CanvasDocumentHistory.commit()`.
On cancellation or failure, commit nothing.

- [ ] **Step 5: Add and verify localized copy**

Add English and Simplified Chinese labels for source status, open source,
refresh source, refresh Note, overwrite title/body, confirm, cancel, and missing
source. Extend localization parity tests so every protocol label is supplied by
both locales.

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-source-gateway.test.ts
pnpm exec tsc --noEmit
git add src/modules/whiteboard/tab.ts packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/chrome/PropertiesPanel.tsx packages/whiteboard/src/model/protocol.ts addon/locale/en-US/mainWindow.ftl addon/locale/zh-CN/mainWindow.ftl test/whiteboard-app-state.test.ts test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts
git commit -m "feat(canvas): import and refresh Zotero notes"
```

### Task 6: Build the Literature Annotation Browser

**Files:**

- Create: `packages/whiteboard/src/chrome/AnnotationBrowser.tsx`
- Create: `test/whiteboard-annotation-browser.test.ts`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `packages/whiteboard/src/chrome/PropertiesPanel.tsx`
- Modify: `packages/whiteboard/src/whiteboard/board.css`
- Modify: `src/modules/whiteboard/editor.ts`
- Modify: `packages/whiteboard/src/bootstrap.tsx`
- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `addon/locale/en-US/mainWindow.ftl`
- Modify: `addon/locale/zh-CN/mainWindow.ftl`
- Test: `test/whiteboard-bootstrap.test.ts`
- Test: `test/whiteboard-localization.test.ts`

**Interfaces:**

- Consumes: `gateway.listAnnotations()`, `AnnotationCandidate`, and existing Quote source identity.
- Produces: `filterAnnotationCandidates()`, `existingAnnotationKeys()`, and an accessible annotation selection overlay.

- [ ] **Step 1: Write failing browser state and render tests**

```ts
assert.deepEqual(
  filterAnnotationCandidates(candidates, "method").map(
    (candidate) => candidate.acquisition.source.annotationKey,
  ),
  ["ANN2"],
);
assert.deepEqual(existingAnnotationKeys(document), new Set(["ANN1"]));
assert.match(markup, /role="dialog"/);
assert.match(markup, /aria-label="Search annotations"/);
assert.match(markup, /Already added/);
```

Also assert loading, empty, unavailable, partial-failure, multi-selection, Escape,
and focus-return states.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --test test/whiteboard-annotation-browser.test.ts test/whiteboard-bootstrap.test.ts test/whiteboard-localization.test.ts
```

Expected: FAIL because the component and list-annotation bridge do not exist.

- [ ] **Step 3: Implement pure browser helpers and accessible overlay**

Export:

```ts
export function filterAnnotationCandidates(
  candidates: AnnotationCandidate[],
  query: string,
): AnnotationCandidate[];

export function existingAnnotationKeys(document: CanvasDocument): Set<string>;
```

The dialog groups rows by `attachmentTitle`, preserves gateway order, searches
text/comment/page label case-insensitively, uses checkboxes, disables already
acquired keys, and exposes a focus-existing action. Close on Escape or backdrop,
restore focus to **View annotations**, and keep the add button disabled with no
selection.

- [ ] **Step 4: Wire on-demand listing**

Selecting Literature exposes **View annotations**. Opening the dialog posts one
`listLiteratureAnnotations` request and performs no lookup before that action.
The host calls `gateway.listAnnotations()`, returns candidates or a typed failure,
and never returns Zotero integer IDs.

- [ ] **Step 5: Style, localize, verify, and commit**

Use existing board color variables, a viewport-safe modal width, scrollable row
list, visible focus rings, and restrained annotation color indicators. Add all
English and Simplified Chinese browser labels and empty/error messages.

```bash
pnpm exec tsx --test test/whiteboard-annotation-browser.test.ts test/whiteboard-bootstrap.test.ts test/whiteboard-localization.test.ts test/whiteboard-node-registry.test.ts
pnpm exec tsc --noEmit
git add packages/whiteboard/src/chrome/AnnotationBrowser.tsx test/whiteboard-annotation-browser.test.ts packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/chrome/PropertiesPanel.tsx packages/whiteboard/src/whiteboard/board.css src/modules/whiteboard/editor.ts packages/whiteboard/src/bootstrap.tsx src/modules/whiteboard/tab.ts addon/locale/en-US/mainWindow.ftl addon/locale/zh-CN/mainWindow.ftl test/whiteboard-bootstrap.test.ts test/whiteboard-localization.test.ts
git commit -m "feat(canvas): browse Literature annotations"
```

### Task 7: Complete Quote Acquisition, Resolution, and Source Opening

**Files:**

- Modify: `packages/whiteboard/src/chrome/AnnotationBrowser.tsx`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `packages/whiteboard/src/chrome/PropertiesPanel.tsx`
- Modify: `packages/whiteboard/src/whiteboard/sourceState.ts`
- Modify: `src/modules/whiteboard/source-gateway.ts`
- Modify: `src/modules/whiteboard/tab.ts`
- Test: `test/whiteboard-app-state.test.ts`
- Test: `test/whiteboard-source-state.test.ts`
- Test: `test/whiteboard-source-gateway.test.ts`
- Test: `test/whiteboard-export.test.ts`

**Interfaces:**

- Consumes: selected `AnnotationCandidate[]`, progressive resolution, and gateway source opening.
- Produces: one-history-entry Quote batches, no automatic edges, exact annotation navigation with page fallback, and snapshot-safe export.

- [ ] **Step 1: Write failing Quote end-to-end state tests**

```ts
assert.equal(afterAdd.nodes.filter((node) => node.kind === "quote").length, 2);
assert.equal(afterAdd.connections.length, beforeAdd.connections.length);
assert.equal(history.revision, beforeRevision + 1);
assert.equal(afterResolve.snapshot.text, "Current Zotero excerpt");
assert.equal(history.revision, beforeBackgroundRevision);
assert.equal(exportedMarkdown.includes("Persisted fallback"), true);
```

Gateway tests must prove exact annotation navigation is attempted first and page
fallback is used only when the Zotero Reader capability is unavailable.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-source-state.test.ts test/whiteboard-source-gateway.test.ts test/whiteboard-export.test.ts
```

Expected: FAIL because selected annotations are not yet added to the document and Academic source opening is absent.

- [ ] **Step 3: Add Quote batches as one edit**

Map each selected candidate to `createAcademicNode("quote", position, id, {
source, snapshot })`. Lay out Quotes in deterministic columns beside or below the
originating Literature. Filter keys already present before committing. Call
history commit once for the complete batch and create no `CanvasConnection`.

- [ ] **Step 4: Apply progressive Quote updates and open sources**

Background resolution replaces only the Quote snapshot and transient state. It
does not dirty history. **Refresh source** promotes the Quote immediately and,
when snapshot data changes, advances the save revision without adding an undo
entry by applying the snapshot without `pushHistory()` and then calling
`history.changed()` exactly once.

`gateway.open()` resolves all three keys, calls Zotero Reader with exact
annotation location when supported, and otherwise opens the resolved PDF page.
If no exact page can be derived, open the attachment without claiming exact
navigation.

- [ ] **Step 5: Verify export, save/reopen, and commit**

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-source-state.test.ts test/whiteboard-source-gateway.test.ts test/whiteboard-export.test.ts test/whiteboard-canvas-file.test.ts test/whiteboard-file-io.test.ts
pnpm exec tsc --noEmit
git add packages/whiteboard/src/chrome/AnnotationBrowser.tsx packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/chrome/PropertiesPanel.tsx packages/whiteboard/src/whiteboard/sourceState.ts src/modules/whiteboard/source-gateway.ts src/modules/whiteboard/tab.ts test/whiteboard-app-state.test.ts test/whiteboard-source-state.test.ts test/whiteboard-source-gateway.test.ts test/whiteboard-export.test.ts
git commit -m "feat(canvas): add Zotero annotation Quotes"
```

### Task 8: Add Multi-Literature Acquisition and Harden Failure UX

**Files:**

- Modify: `src/modules/whiteboard/tab.ts`
- Modify: `packages/whiteboard/src/whiteboard/app.tsx`
- Modify: `packages/whiteboard/src/whiteboard/board.css`
- Modify: `addon/locale/en-US/mainWindow.ftl`
- Modify: `addon/locale/zh-CN/mainWindow.ftl`
- Test: `test/whiteboard-app-state.test.ts`
- Test: `test/whiteboard-save-integration.test.ts`
- Test: `test/whiteboard-localization.test.ts`

**Interfaces:**

- Consumes: the single-source gateway and established acquisition protocol.
- Produces: deterministic multi-item layout, partial-success reporting, and visible per-source diagnostics.

- [ ] **Step 1: Write failing multi-drop and failure-state tests**

Cover mixed Regular Item/Attachment drops, partial source failure, one history
entry for successful Literature nodes, stable grid placement, and localized
unavailable indicators.

```ts
assert.equal(
  result.nodes.filter((node) => node.kind === "literature").length,
  2,
);
assert.equal(
  result.nodes.some((node) => node.kind === "attachment"),
  false,
);
assert.equal(history.revision, beforeRevision + 1);
assert.deepEqual(
  result.errors.map((error) => error.index),
  [1],
);
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-localization.test.ts
```

Expected: FAIL because acquisition still handles one source per interaction.

- [ ] **Step 3: Implement indexed partial success**

Preserve dropped Zotero item order. Acquire every Regular Item independently,
skip Attachments without creating placeholders, return indexed failures, and lay
out successes in a bounded grid from the drop point. Commit all successes once.
Do not deduplicate Literature sources: repeated Regular Items remain valid
independent placements with shared resolution-cache entries.
Show a single localized summary containing success and failure counts; retain
individual diagnostic codes for logs.

- [ ] **Step 4: Render non-blocking source states**

PropertiesPanel displays idle/loading/resolved/unavailable status for
source-backed nodes. Card rendering may show a small unavailable indicator but
must not replace snapshot text. Open, refresh, and annotation actions report
their failure in the canvas UI rather than only `ztoolkit.log`.

- [ ] **Step 5: Verify and commit**

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-localization.test.ts test/whiteboard-source-scheduler.test.ts
pnpm exec tsc --noEmit
git add src/modules/whiteboard/tab.ts packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/whiteboard/board.css addon/locale/en-US/mainWindow.ftl addon/locale/zh-CN/mainWindow.ftl test/whiteboard-app-state.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-localization.test.ts
git commit -m "feat(canvas): add resilient multi-source acquisition"
```

### Task 9: Full Verification and Real-Zotero Smoke Matrix

**Files:**

- Modify: `docs/architecture.md`

**Interfaces:**

- Consumes: all previous tasks.
- Produces: verified production build and a documented source-workflow architecture boundary.

- [ ] **Step 1: Run all automated checks from a clean command invocation**

```bash
pnpm test:unit
pnpm exec tsc --noEmit
pnpm lint:check
pnpm --filter @zotero-markdown/whiteboard build
pnpm build
git diff --check
```

Expected: every command exits 0, the test runner reports zero failures, and the production build contains non-empty whiteboard JS/CSS assets referenced through `chrome://bamboo/`.

- [ ] **Step 2: Exercise the real-Zotero smoke matrix**

In the configured test profile, verify each row and record any failure before
continuing:

```text
Personal Regular Item -> Literature -> save -> restart -> resolve -> open
Group Regular Item -> Literature -> save -> restart -> resolve -> open
Standalone Note -> import -> local edit -> reopen -> unchanged
Child Note -> import -> refresh cancel -> unchanged -> refresh confirm -> undo
Literature with two PDFs -> open browser -> search -> batch-add two Quotes
Quote -> save -> restart -> open exact annotation or defined page fallback
Deleted Item/Note/Annotation -> reopen -> snapshot retained -> graph editable
Large source canvas -> initial snapshot visible before background queue completes
Close tab during resolution -> no late mutation, toast, or uncaught exception
```

- [ ] **Step 3: Update architecture documentation**

Document that the canonical model is Zotero-free, the host source gateway owns
all native-key resolution, snapshots render before lookup, and runtime source
state is not persisted. Do not document excluded Reader integrations as present.

- [ ] **Step 4: Commit verified documentation**

```bash
git add docs/architecture.md
git commit -m "docs(canvas): document academic source workflow"
```

Record the exact automated command results and manual smoke outcomes in the
implementation handoff. If either verification step fails, stop this task and
return to the owning task with a new failing regression test before claiming
completion.
