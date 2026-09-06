# First-run Tutorial Whiteboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and automatically open one localized academic-whiteboard tutorial on first successful Bamboo startup, enriched with a bounded, deterministic sample from the user's Zotero library when available.

**Architecture:** A Zotero-free model module builds a canonical schema-v2 tutorial from localized labels and optional validated acquisitions. One host module performs the bounded recent-item selection and owns the one-time preference/open lifecycle, reusing the existing source gateway and attachment creator. Tutorial nodes contain final data and styles, with no special renderer or persisted onboarding state.

**Tech Stack:** TypeScript, Zotero 7 APIs, existing Bamboo canvas model and source gateway, Fluent localization, Node test runner through `tsx`, pnpm.

## Global Constraints

- Create and automatically open the tutorial once in the Zotero user-library root.
- Mark completion after attachment creation succeeds and before opening.
- Do not recreate a tutorial deleted by the user.
- Never block or reject normal plugin startup because onboarding fails.
- Inspect at most 50 recent user-library Item IDs.
- Rank Regular Items by supported annotations plus child Note, annotations only, child Note only, then plain Item; break ties by `dateModified` and Item ID.
- Materialize at most one Literature, two Quotes, and one child Note.
- Reuse `ZoteroSourceGateway`; never mutate source Items or add fake Zotero keys.
- Fall back to a complete static tutorial when discovery or conversion fails.
- Add no dependency, wizard, tutorial renderer, schema variant, analytics, or preference UI.
- Keep English and Simplified Chinese content equivalent and concise.

---

### Task 1: Pure tutorial canvas builder

**Files:**

- Create: `packages/whiteboard/src/model/tutorial.ts`
- Modify: `packages/whiteboard/src/model/index.ts`
- Test: `test/whiteboard-tutorial-document.test.ts`

**Interfaces:**

- Consumes: `AcademicAcquisition`, `CanvasDocument`, `createAcademicNode`, `createBasicNode`, and `createAcademicConnection` from the canonical model.
- Produces:

```ts
export interface TutorialCanvasLabels {
  title: string;
  welcome: string;
  welcomeBody: string;
  sourceNotice: string;
  addLiterature: string;
  addLiteratureBody: string;
  browseQuotes: string;
  browseQuotesBody: string;
  writeNote: string;
  writeNoteBody: string;
  questionBadge: string;
  claimBadge: string;
  organize: string;
  organizeBody: string;
  practice: string;
  practiceBody: string;
  supports: string;
}

export interface TutorialCanvasSample {
  literature: Extract<AcademicAcquisition, { kind: "literature" }>;
  quotes: Array<Extract<AcademicAcquisition, { kind: "quote" }>>;
  note?: Extract<AcademicAcquisition, { kind: "note" }>;
}

export function tutorialCanvasDocument(
  labels: TutorialCanvasLabels,
  sample?: TutorialCanvasSample,
): CanvasDocument;
```

- [ ] **Step 1: Write failing canonical document tests**

Create English and Chinese label fixtures. Assert the static document parses,
contains the stable guided nodes, includes a Frame and labeled relationship,
contains no source-backed nodes without a sample, and has a left-to-right
viewport.

```ts
const document = tutorialCanvasDocument(labels);
const parsed = parseCanvasDocument(document);
assert.equal(parsed.issues.length, 0);
assert.deepEqual(
  parsed.document.nodes.filter((node) => "source" in node),
  [],
);
assert.ok(parsed.document.nodes.some((node) => node.kind === "frame"));
assert.ok(
  parsed.document.connections.some(
    (connection) =>
      connection.kind === "academic" && connection.relation === "supports",
  ),
);
```

Add an enriched sample with three Quotes and one child Note. Assert the builder
uses one Literature, only the first two Quotes, and the supplied Note; preserves
native source keys; and round-trips through
`documentToCanvasFile()` plus `canvasFileToDocument()`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-document.test.ts
```

Expected: FAIL because `model/tutorial.ts` does not exist.

- [ ] **Step 3: Implement the pure builder with stable IDs and final styles**

Use stable IDs prefixed `tutorial-`. Static nodes form the approved horizontal
path and remain useful without a sample. When a sample exists, place its
Literature at the source step, Quotes below it, and its Note at the thinking
step. Use `createAcademicNode()` for Academic data and ordinary canonical Frame,
Note, shape, and connection factories for the rest.

The builder must slice `sample.quotes` to two, copy every style/source/snapshot
record, and return this viewport:

```ts
viewport: { x: 40, y: 40, zoom: 0.85 }
```

Do not introduce a tutorial flag or template reference in the document.

- [ ] **Step 4: Run focused model and codec tests and verify GREEN**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-document.test.ts test/whiteboard-academic-document.test.ts test/whiteboard-canvas-file.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/whiteboard/src/model/tutorial.ts packages/whiteboard/src/model/index.ts test/whiteboard-tutorial-document.test.ts
git commit -m "feat(whiteboard): build tutorial canvas document"
```

### Task 2: Bounded real-library sample selection

**Files:**

- Create: `src/modules/whiteboard/tutorial.ts`
- Modify: `src/modules/whiteboard/index.ts`
- Test: `test/whiteboard-tutorial-sample.test.ts`

**Interfaces:**

- Consumes: `TutorialCanvasSample` from Task 1 and `ZoteroSourceGateway` from `source-gateway.ts`.
- Produces:

```ts
export const TUTORIAL_CANDIDATE_LIMIT = 50;

export interface TutorialSampleDependencies {
  userLibraryID: number;
  recentItemIDs(libraryID: number, limit: number): Promise<number[]>;
  getItem(itemID: number): Zotero.Item | null;
  gateway: ZoteroSourceGateway;
}

export async function selectTutorialSample(
  deps?: TutorialSampleDependencies,
): Promise<TutorialCanvasSample | undefined>;
```

- [ ] **Step 1: Write failing selector tests with minimal fake Items**

Build fake Regular Items exposing only `id`, `libraryID`, `key`, `dateModified`,
`isRegularItem()`, and `getNotes()`. Inject a fake gateway whose
`acquireItem()` and `listAnnotations()` return typed acquisitions.

Cover these cases:

```ts
assert.deepEqual(recentCalls, [[USER_LIBRARY_ID, 50]]);
assert.equal(result?.literature.source.itemKey, "RICH1234");
assert.equal(result?.quotes.length, 2);
assert.equal(result?.note?.source.noteKey, "NOTE1234");
```

Also assert:

- attachments, annotations, Notes, wrong-library Items, deleted/missing IDs, and
  thrown candidates are skipped;
- annotations plus Note outranks newer annotation-only and Note-only Items;
- same-tier candidates sort by descending `dateModified`, then descending ID;
- no candidates and a discovery exception both return `undefined`;
- no fake Item exposes or receives a save call.

- [ ] **Step 2: Run the selector test and verify RED**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-sample.test.ts
```

Expected: FAIL because `src/modules/whiteboard/tutorial.ts` does not exist.

- [ ] **Step 3: Implement bounded selection with the existing gateway**

Call `recentItemIDs(userLibraryID, TUTORIAL_CANDIDATE_LIMIT)` exactly once.
For each resolved user-library Regular Item:

1. acquire its Literature record;
2. call `gateway.listAnnotations(literature.source)` and keep the first two
   candidates;
3. resolve the first valid child Note from `item.getNotes()` and acquire it;
4. compute tier `3` for both, `2` for Quotes, `1` for Note, `0` for plain;
5. select highest tier, then newest ISO `dateModified`, then largest numeric ID.

Catch errors per candidate. Catch the outer recent-ID call and return
`undefined`. Production `recentItemIDs` must issue one parameterized query:

```sql
SELECT itemID
FROM items
WHERE libraryID = ?
  AND itemID NOT IN (SELECT itemID FROM deletedItems)
ORDER BY dateModified DESC, itemID DESC
LIMIT ?
```

Use `Zotero.DB.columnQueryAsync()` for IDs and `Zotero.Items.get()` for Item
resolution. Do not query annotation or Note tables directly.

- [ ] **Step 4: Run selector and source-gateway tests and verify GREEN**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-sample.test.ts test/whiteboard-source-gateway.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/modules/whiteboard/tutorial.ts src/modules/whiteboard/index.ts test/whiteboard-tutorial-sample.test.ts
git commit -m "feat(whiteboard): select bounded tutorial sample"
```

### Task 3: Root-library attachment options and one-time coordinator

**Files:**

- Modify: `src/modules/whiteboard/create.ts`
- Modify: `src/modules/whiteboard/tutorial.ts`
- Modify: `src/modules/whiteboard/index.ts`
- Modify: `addon/prefs.js`
- Modify: `typings/prefs.d.ts`
- Test: `test/whiteboard-tutorial-onboarding.test.ts`
- Test: `test/whiteboard-file-io.test.ts`

**Interfaces:**

- Extends:

```ts
export interface CreateWhiteboardAttachmentOptions {
  document?: CanvasDocument;
  libraryID?: number;
  collections?: number[];
  filename?: string;
  select?: boolean;
  reportError?: boolean;
}
```

- Produces:

```ts
export interface TutorialOnboardingDependencies {
  completed(): boolean;
  markCompleted(): void;
  labels(): TutorialCanvasLabels;
  selectSample(): Promise<TutorialCanvasSample | undefined>;
  create(
    document: CanvasDocument,
    filename: string,
  ): Promise<Zotero.Item | null>;
  open(item: Zotero.Item): Promise<unknown>;
  log(message: string, error?: unknown): void;
}

export function ensureTutorialWhiteboard(
  deps?: TutorialOnboardingDependencies,
): Promise<void>;
```

- [ ] **Step 1: Write failing attachment-option and lifecycle tests**

Assert explicit options override ambient selection while omitted options retain
existing menu behavior. For the coordinator, inject spies and verify ordering:

```ts
await ensureTutorialWhiteboard(deps);
assert.deepEqual(events, ["select", "create", "mark", "open"]);
```

Cover marked startup, create returning `null`, create throwing, open throwing,
sample selection throwing, and two simultaneous calls. Required expectations:

```ts
assert.equal(createCalls, 1);
assert.equal(markCalls, attachmentCreated ? 1 : 0);
await assert.doesNotReject(() => ensureTutorialWhiteboard(deps));
```

Production create arguments must be asserted as:

```ts
{
  libraryID: Zotero.Libraries.userLibraryID,
  collections: [],
  filename: labels.title,
  select: false,
  reportError: false,
}
```

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-onboarding.test.ts test/whiteboard-file-io.test.ts
```

Expected: FAIL because the coordinator and explicit attachment options do not
exist.

- [ ] **Step 3: Extend attachment creation without changing menu defaults**

Resolve values with nullish coalescing so `collections: []` remains explicit:

```ts
const libraryID =
  options.libraryID ??
  parent?.libraryID ??
  selectedLibraryIDs?.[0] ??
  Zotero.Libraries.userLibraryID;
const collections =
  options.collections ??
  (selectedCollection ? [selectedCollection] : undefined);
```

Use `options.filename ?? defaultCanvasFilename(titleBase)`. Select the attachment
unless `options.select === false`. Show the existing ProgressWindow unless
`options.reportError === false`.

- [ ] **Step 4: Implement the coalesced one-time coordinator**

Add Boolean preference `whiteboardTutorialCreated` to `addon/prefs.js` and
`typings/prefs.d.ts`. Production dependencies use `getPref`/`setPref`, localized
labels, `selectTutorialSample`, `createWhiteboardAttachment`, and
`openWhiteboardAttachment`.

Keep one module-level in-flight promise:

```ts
let tutorialInFlight: Promise<void> | undefined;

export function ensureTutorialWhiteboard(deps = productionDependencies()) {
  if (deps.completed()) return Promise.resolve();
  return (tutorialInFlight ??= runTutorial(deps).finally(() => {
    tutorialInFlight = undefined;
  }));
}
```

`runTutorial` catches discovery separately and continues with no sample. It
catches the complete create/open flow so the exported promise resolves on every
failure. It calls `markCompleted()` only for a non-null created attachment and
before `open()`.

- [ ] **Step 5: Run lifecycle tests and verify GREEN**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-onboarding.test.ts test/whiteboard-file-io.test.ts test/whiteboard-save-integration.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/modules/whiteboard/create.ts src/modules/whiteboard/tutorial.ts src/modules/whiteboard/index.ts addon/prefs.js typings/prefs.d.ts test/whiteboard-tutorial-onboarding.test.ts test/whiteboard-file-io.test.ts
git commit -m "feat(whiteboard): create tutorial once on startup"
```

### Task 4: Localization, startup wiring, and complete verification

**Files:**

- Modify: `addon/locale/en-US/addon.ftl`
- Modify: `addon/locale/zh-CN/addon.ftl`
- Modify: `typings/i10n.d.ts`
- Modify: `src/hooks.ts`
- Modify: `test/whiteboard-localization.test.ts`
- Modify: `test/whiteboard-save-integration.test.ts`
- Modify: `docs/architecture.md`

**Interfaces:**

- Consumes: `ensureTutorialWhiteboard()` from Task 3.
- Produces: complete `TutorialCanvasLabels` in both locales and non-blocking startup scheduling.

- [ ] **Step 1: Write failing localization and startup wiring tests**

Require matching English and Chinese keys for every `TutorialCanvasLabels`
field. Assert `src/hooks.ts` schedules but does not await onboarding:

```ts
assert.match(hooksSource, /void ensureTutorialWhiteboard\(\)/);
assert.doesNotMatch(hooksSource, /await ensureTutorialWhiteboard\(\)/);
```

Require the production labels function to map every field through `getString()`
and the title to end in `.canvas` in both locales.

- [ ] **Step 2: Run localization tests and verify RED**

Run:

```bash
pnpm exec tsx --test test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts
```

Expected: FAIL for missing tutorial Fluent keys and startup call.

- [ ] **Step 3: Add bilingual tutorial content and schedule startup**

Add concise keys using prefix `whiteboard-tutorial-`, including `title`,
`welcome`, `welcome-body`, `source-notice`, `add-literature`,
`add-literature-body`, `browse-quotes`, `browse-quotes-body`, `write-note`,
`write-note-body`, `question-badge`, `claim-badge`, `organize`,
`organize-body`, `practice`, `practice-body`, and `supports`.

Add every key to `typings/i10n.d.ts`. Export `ensureTutorialWhiteboard` from the
whiteboard index, import it in `src/hooks.ts`, and call it after locale,
menus, windows, and sidebar initialization:

```ts
void ensureTutorialWhiteboard();
```

Do not await the call and do not add a startup notification.

- [ ] **Step 4: Document the lifecycle boundary**

Add a short `First-run tutorial` section to `docs/architecture.md` recording:

- bounded user-library selection;
- pure canonical document generation;
- root-library standalone attachment;
- completion marker timing;
- no recreation and no source Item mutation.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-*.test.ts test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Run the complete verification gate**

Run:

```bash
pnpm exec tsx --test test/whiteboard-*.test.ts
pnpm exec tsc --noEmit
pnpm lint:check
pnpm build
git diff --check
```

Expected: every command exits 0 and the whiteboard suite reports zero failures.

- [ ] **Step 7: Commit Task 4**

```bash
git add addon/locale/en-US/addon.ftl addon/locale/zh-CN/addon.ftl typings/i10n.d.ts src/hooks.ts test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts docs/architecture.md
git commit -m "feat(whiteboard): launch localized first-run tutorial"
```

### Task 5: Ponytail complexity review and cleanup

**Files:**

- Review all changes from this plan against its merge base.
- Modify only files with a proven simplification opportunity.

**Interfaces:**

- Consumes: completed Tasks 1 through 4.
- Produces: a minimal implementation with the same tested behavior.

- [ ] **Step 1: Run `ponytail-review` on the implementation diff**

Review only for over-engineering: unnecessary interfaces, duplicate conversion,
speculative configuration, custom helpers replaceable by existing project code,
and state that can be deleted.

- [ ] **Step 2: Apply only evidence-backed simplifications**

Do not remove fixed bounds, trust-boundary validation, startup error isolation,
localization, accessibility meaning, or tests that prevent data loss and
duplicates. Prefer deletion and existing helpers; add no dependency.

- [ ] **Step 3: Rerun the complete verification gate**

Run:

```bash
pnpm exec tsx --test test/whiteboard-*.test.ts
pnpm exec tsc --noEmit
pnpm lint:check
pnpm build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Commit review fixes if any**

```bash
git add -A
git commit -m "refactor(whiteboard): simplify tutorial onboarding"
```

Skip the commit when the review produces no code changes.
