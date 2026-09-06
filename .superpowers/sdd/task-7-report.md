# Task 7 Report — Zotero Annotation Quotes

## Outcome

Completed Quote acquisition, progressive resolution, explicit refresh, and
source opening on base `1f57744`.

- Selected annotation candidates become canonical Quote nodes in a stable
  two-column layout beside the Literature that opened the browser.
- One accepted selection batch creates exactly one history/save revision, no
  automatic connection, and no persisted browser-only candidate fields.
- Existing document Quotes and duplicates within the same selection are
  filtered with the complete native source identity: library, item key,
  attachment key, and annotation key.
- Background resolution updates source snapshots and transient availability
  without touching undo or save history.
- Explicit **Refresh source** bypasses the session cache, promotes selected
  priority, and advances the save revision once only when the resolved snapshot
  changed. It never adds an undo entry.
- **Open source** validates the complete key chain and uses Zotero Reader's
  supported `{ annotationID }` location. Page fallback occurs only when the
  exact-navigation capability reports unavailable; Reader failures propagate
  without an arbitrary retry.
- Saved snapshots remain the readable/exportable fallback when Zotero is
  unavailable.

No new user-facing strings were needed; the existing active-locale **Open
source** and **Refresh source** labels are reused.

## RED evidence

Behavioral tests were written before production changes.

The initial focused command was:

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-source-state.test.ts test/whiteboard-source-gateway.test.ts test/whiteboard-export.test.ts test/whiteboard-source-scheduler.test.ts
```

It exited 1 with 32 tests reported: 26 passed and 6 failed. The failures showed
the intended gaps:

- Quote batch and academic refresh runtime exports did not exist;
- the production Reader call used `annotationKey` instead of the supported
  `annotationID` location;
- production Reader errors were converted to false capability and incorrectly
  retried by page;
- the completed source cache had no invalidation path for explicit refresh.

A separate wrong-annotation-key behavioral test then failed with “Missing
expected rejection”, proving that a lookup result could pass parent validation
without matching the requested annotation key. The full native identity check
made this test GREEN before opening was attempted.

## Implementation

`createQuoteBatchRuntime()` owns the application mutation boundary. It reads
the working document, validates the originating Literature, deduplicates
against both the document and the pending batch, creates canonical
`createAcademicNode("quote", ...)` payloads, commits the pre-edit document once,
and applies the complete node batch once. Existing connections are reused
unchanged.

`createSourceRefreshRuntime()` distinguishes explicit refreshes from ordinary
progressive results. Both paths use the existing snapshot-only resolution
transition; only a correlated explicit result whose full identity matches and
whose Literature/Quote snapshot actually differs calls `history.changed()`.
Pending refresh state is cleared when a different document is loaded.

The iframe sends an explicit refresh marker through the existing typed source
request. The host invalidates any completed cache entry, promotes selected
priority, and enqueues the lookup. This small protocol/scheduler extension is
required to prevent a manual refresh from replaying an old session result.

Academic open requests now cross the existing bootstrap/editor bridge to the
host gateway. Quote opening resolves the annotation by native library and
annotation key, verifies its annotation, attachment, and Literature keys, then
attempts exact Reader navigation. A valid zero-based `pageIndex` from
`annotationPosition` is the only page fallback; `pageLabel` is never presented
as a Reader page index.

After a successful add, the originating Literature remains selected while the
dialog closes, so the existing mounted focus-restoration behavior retains its
trigger. Duplicate-only additions close without mutating the selection,
document, history, or revision.

## Files

- Updated Quote UI/application behavior in
  `packages/whiteboard/src/chrome/AnnotationBrowser.tsx`,
  `packages/whiteboard/src/chrome/PropertiesPanel.tsx`,
  `packages/whiteboard/src/whiteboard/app.tsx`, and
  `packages/whiteboard/src/whiteboard/sourceState.ts`.
- Updated the typed bridge in `packages/whiteboard/src/model/protocol.ts`,
  `packages/whiteboard/src/bootstrap.tsx`, and
  `src/modules/whiteboard/editor.ts`.
- Updated host resolution/open behavior in
  `src/modules/whiteboard/source-gateway.ts`,
  `src/modules/whiteboard/source-scheduler.ts`, and
  `src/modules/whiteboard/tab.ts`.
- Added behavioral coverage in `test/whiteboard-app-state.test.ts`,
  `test/whiteboard-source-state.test.ts`,
  `test/whiteboard-source-gateway.test.ts`,
  `test/whiteboard-source-scheduler.test.ts`, and
  `test/whiteboard-export.test.ts`.

The bridge and scheduler files extend existing Task 4/6 production paths and
are necessary for real explicit refresh and source opening; no Task 8
multi-Literature ownership behavior was added.

## GREEN and verification

- Required Task 7 app/state/gateway/export/canvas-file/file-I/O command: 124
  passed, 0 failed.
- Supplemental scheduler/browser/DOM/session/bridge/protocol command: 39 passed,
  0 failed.
- Full `pnpm test:unit`, run once after GREEN: 556 passed, 0 failed.
- `pnpm exec tsc --noEmit`: passed.
- ESLint over every changed TypeScript/TSX file: passed.
- Prettier check over every changed code, test, and report file: passed.
- `git diff --check`: passed.

## Self-review

- Identity: batch deduplication, resolution, refresh comparison, and opening all
  use the complete native identity. Same annotation keys in distinct PDF
  attachments remain distinct, while duplicate payloads in one reply collapse.
- Persistence: Quote source/snapshot contain only canonical native source keys
  and snapshot fields. Attachment titles, sort indexes, transient state, queue
  metadata, and integer Zotero IDs do not enter `CanvasDocument`.
- History: a non-empty Quote batch commits once; duplicate-only batches do
  nothing. Background results never call the revision callback. A changed
  explicit refresh calls it exactly once and deliberately skips history commit;
  unchanged and unavailable results do neither.
- Geometry/relationships: deterministic placement derives from the originating
  Literature and existing Quote rows. Resolution and refresh replace only
  source-owned snapshot data, preserving geometry, styling, frames, and
  connections. Acquisition creates no connection.
- Reader behavior: gateway capability tests cover exact success, explicit
  capability unavailability, missing page data, arbitrary exact-call failure,
  full-key mismatch, and the production Reader argument shape.
- Offline behavior: a Quote acquired from a candidate survives canonical save
  and reopen and exports its persisted fallback without requiring live source
  resolution.
- UI lifecycle: the dialog still closes on add, keeps the originating
  Literature selected for trigger focus restoration, and retains the existing
  Escape/backdrop/close/focus-existing DOM guarantees.
- Scope: no Reader command integration, drag-and-drop annotation acquisition,
  automatic semantic edges, schema uniqueness rule, or Task 8 duplicate
  Literature policy was introduced.

No blocking concerns remain. Real Zotero Reader navigation is still an
appropriate host-runtime smoke test in addition to the production dependency
contract exercised by the Node suite.

## Important review fix — Independent Reader fallback

The review found that the production adapter correctly reported missing
`Zotero.Reader.open` as unavailable, but its fallback immediately called the
same missing Reader API. Quote opening therefore threw a `TypeError` instead of
opening the resolved attachment.

Local `zotero-types` 4.1.3 defines the project-supported independent entrypoint
as:

```ts
Zotero.FileHandlers.open(item, {
  location: { pageIndex },
});
```

The existing whiteboard host also uses `Zotero.FileHandlers.open(attachment)`
as its default attachment opener. The production gateway now uses this entrypoint
for capability fallback. A valid zero-based annotation page is passed through
the typed `location.pageIndex`; missing or invalid position data opens only the
attachment and does not claim page or annotation navigation.

### Review-fix RED / GREEN

Production-adapter tests were added before changing the adapter. The first
source-gateway run reported 20 tests: 18 passed and 2 failed. With `Reader`
absent, the valid-page test failed with
`Cannot read properties of undefined (reading 'open')`; with `Reader.open`
absent, the no-page test failed with `Reader.open is not a function`. Neither
case reached the expected independent attachment opener.

After switching only the fallback dependency to `FileHandlers.open`, the same
gateway suite passed 20/20. The new tests prove:

- missing `Reader` plus `{"pageIndex":7}` calls
  `FileHandlers.open(attachment, { location: { pageIndex: 7 } })` exactly once;
- missing `Reader.open` plus absent position, and missing `Reader` plus invalid
  position, each call `FileHandlers.open(attachment)` exactly once;
- the existing production exact-annotation test still calls
  `Reader.open(attachment.id, { annotationID })`; and
- a rejected exact Reader call still propagates and never invokes fallback.

Fresh review-fix verification:

- Task 7 focused app/state/gateway/export/canvas-file/file-I/O suite: 126 passed,
  0 failed.
- Full `pnpm test:unit`, run once for this fix: 558 passed, 0 failed.
- `pnpm exec tsc --noEmit`: passed.
- ESLint and Prettier over both changed TypeScript files: passed.
- `git diff --check`: passed.

The fix does not alter source identity resolution, Quote acquisition/history,
snapshot persistence, explicit refresh scheduling, or Task 8 behavior.
