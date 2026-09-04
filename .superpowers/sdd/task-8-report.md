# Task 8 Report — Resilient Multi-Source Acquisition

## Outcome

Implemented resilient multi-source Zotero acquisition and visible source-action
failure UX on base `af76a1d`.

- The Zotero picker and generic drop path accept multiple objects and acquire
  each supported Regular Item or Note independently.
- Input indexes survive asynchronous completion. Successful nodes are sorted by
  input index and compacted into a deterministic three-column grid from the
  requested canvas point.
- Attachments create no acquisition or canonical node. They return an indexed
  typed `unsupported-attachment` failure and contribute to the localized batch
  failure count.
- Repeated item IDs within one ordered input remain repeated Literature
  placements. Mirrored MIME payloads do not multiply those placements.
- A successful batch takes one history snapshot and advances the save revision
  once. A zero-success batch removes its loading state without history or save
  changes. No connection is created automatically.
- Duplicate Literature placements retain independent node IDs while producing
  the same scheduler cache key, so the existing scheduler coalesces resolution.
- The Properties panel distinguishes idle, loading, resolved, and unavailable
  source states without replacing persisted snapshot content.
- A single nonblocking `aria-live` canvas notice displays the localized batch
  summary. Open, explicit refresh, Note refresh, and annotation failures are
  visible in the canvas; typed acquisition codes remain in host diagnostics.
- Document replacement clears acquisition and source-action correlation state,
  so late replies cannot mutate the replacement document.

The active `addon/locale/*/addon.ftl` resources and generated localization key
typing were updated. The inactive `mainWindow.ftl` copies were not changed.

## RED evidence

Behavioral tests were added before production changes. The initial required
focused command was:

```bash
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-localization.test.ts
```

It reported 64 tests: 56 passed and 8 failed. The intended failures showed:

- `resolveBatch()` did not exist;
- the host exported no multi-item acquisition helper;
- source `idle` and `loading` rendered as the same state;
- no nonblocking canvas notice or localized summary existed; and
- the new active-locale keys were absent.

Additional RED/GREEN cycles covered edge cases found during implementation:

1. A history-snapshot test failed because the first batch implementation
   removed its pending marker before `pushHistory()`. The captured undo snapshot
   contained `['claim', 'item']`, proving the loading placeholder leaked into
   history. Moving pending cleanup after the canonical history capture made the
   test pass with `['claim']`.
2. A repeated-input test expected `[11, 11, 12]` but received `[11, 12]`.
   Occurrence-aware parsing now preserves intentional repeats inside one
   ordered payload while suppressing mirrored MIME copies.
3. The clarified mixed-input test failed because an Attachment produced no
   diagnostic. It now returns `{ index: 1, code: 'unsupported-attachment' }`
   while still creating no acquisition or node.

## Implementation

`acquireAcademicItems()` maps every input to an independent promise and uses
`Promise.all()` only as the collection boundary. Each outcome retains the
original index, so completion order cannot affect the returned order. Missing
items, unsupported kinds, Attachments, and acquisition exceptions have finite
typed codes. The host logs each failure with its index, code, and message, then
sends one batch reply and a Fluent-formatted summary to the iframe.

`createAcademicAcquisitionRuntime().resolveBatch()` correlates replies against
the pending request, rejects replies from replaced documents, sorts successes
by source index, and materializes only Literature and Note acquisitions. The
first success replaces the interaction placeholder; later successes receive
independent node IDs. Placement uses three columns with a 24px gap and a fixed
row stride. The pre-edit canonical document is captured once while the pending
marker still hides the placeholder, and the complete batch is then applied
with one revision change.

The existing Task 5 Note conversion is reused without changing Note ownership:
source keys and optional source-title snapshots are preserved, and imported
content remains independent local content. Batch statistics count successful
source nodes, while kind assertions separately prove the mixed example creates
two Literature nodes and one Note rather than treating the Note as Literature.

New nodes enter transient `idle` state and trigger the established progressive
resolution cycle. Repeated Literature placements have identical
`sourceCacheKey()` values; the existing four-concurrent scheduler therefore
fans one resolved cache entry out to all placements.

Source action errors use a correlated parent-to-iframe failure message. The
canvas notice reports open failures immediately, while explicit source refresh
failures also surface from their typed unavailable result. Note refresh errors
use the same notice path, and annotation terminal/partial errors remain visible
in the canvas annotation browser with terminal failures also announced by the
notice. Arbitrary open failures do not overwrite the source snapshot or falsely
change canonical availability.

## Verification

- Required focused app/save/localization plus scheduler command: 88 passed, 0
  failed.
- Supplemental source-state suite: 9 passed, 0 failed.
- Full `pnpm run test:unit`: 565 passed, 0 failed across 24 suites.
- `pnpm exec tsc --noEmit`: passed.
- Full `pnpm run lint:check` (Prettier and ESLint): passed.
- `git diff --check`: passed.

## Self-review

- Order/concurrency: host acquisition is failure-isolated and safe when
  promises settle out of order; the iframe independently sorts by input index.
- Mixed kinds: Regular Items and Notes use the gateway, Attachments have an
  indexed typed failure and no node, and other kinds have a distinct typed
  failure. The required mixed example reports failure indexes `[1]`.
- Duplicates/cache: neither parsing nor placement deduplicates intentional
  repeated Literature. Both placements share the same scheduler cache key.
- History/persistence: a non-empty batch records exactly one canonical history
  boundary and one save revision. Zero success records neither. Loading models,
  transient status, notices, and diagnostic objects are absent from saved
  `CanvasDocument` data.
- Geometry/relationships: the grid has a fixed three-column bound and stable
  strides. Failures compact out without disturbing success order. Existing
  connections are preserved and no new connection is synthesized.
- Lifecycle: request/node correlation rejects stale acquisition and open-action
  failures. Loading a different document clears pending maps and source queues.
- Failure UX: the Properties panel exposes all four runtime states. The notice
  is nonmodal and pointer-transparent, snapshots remain readable, and open,
  refresh, Note refresh, and annotation failures have canvas-visible paths.
- Scope: no schema uniqueness constraint, automatic Zotero Note update,
  automatic edge, Attachment node entry point, or Task 9 document change was
  introduced.

No blocking concerns remain. A real Zotero smoke test should still confirm the
native multi-select dialog's returned ordering and the visual placement at
several canvas zoom levels.
