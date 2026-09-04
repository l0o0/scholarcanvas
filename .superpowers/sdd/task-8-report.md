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

## Review follow-up: closed drop and failure protocols

This follow-up supersedes the report's earlier description of raw drag payloads
and host-formatted summaries. The iframe no longer reads or forwards a MIME
bag. A capture-phase listener owned by the Zotero host reads the production
`DataTransfer`, applies Zotero's `collection > item > search` precedence, and
accepts only the canonical `zotero/item` payload. It resolves local database IDs
inside the host and crosses the protocol boundary with an ordered closed list of
`{ library, itemKey }` references. Mirrored plain-text/JSON flavors are ignored,
while intentional repeats in the canonical payload are retained. Listener
ownership follows iframe loads and is released on editor destruction.

Every canvas-visible failure is now selected inside the iframe from a finite
typed code plus localized labels. Host exception text remains a diagnostic field
for protocol logging and is never rendered as notice or tooltip content. Picker
cancellation is silent; malformed and unsupported drops have localized notices.
The acquisition summary is interpolated from typed success/failure counts in
the iframe. English and Simplified Chinese active locale resources and generated
key typings remain in parity.

Annotation success/failure is correlated by live request and complete source
identity before any state or notice mutation. Closed, replaced, reopened,
request-mismatched, and source-mismatched replies are inert. Open actions now
have symmetric typed success/failure replies; either consumes the matching
pending entry exactly once, and a successful action clears a relevant stale
notice. Note/source refresh and annotation successes likewise clear relevant
failure notices. Notices auto-expire after six seconds, and their timer plus all
request/session maps are cleared on document load or React unmount.

### Follow-up RED evidence

The first review-focused RED run reported 96 tests, 86 passed and 10 failed. It
demonstrated that mirrored MIME flavors multiplied/reordered entries, the
academic protocol still exposed an open raw bag, gateway English reached the
DOM, the host supplied the batch summary string, annotation errors could notify
before correlation, and localized/timer lifecycle behavior was absent.

Separate RED cycles then proved the remaining lifecycle surfaces:

- open success and source identity were missing from the protocol;
- the request/node/source action correlator did not exist;
- native iframe drop capture and cleanup were not owned by the host editor;
- bootstrap destruction did not unmount React; and
- open and Note-refresh gateway exceptions lost their finite typed codes.

Each test failed for the stated missing behavior before its implementation was
added.

### Follow-up GREEN evidence

- Review-focused app, production-drop, locale, scheduler, gateway, annotation,
  bootstrap, protocol, and module-runtime suites: 136 passed, 0 failed.
- Full `pnpm run test:unit`: 572 passed, 0 failed across 24 suites.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run lint:check`: Prettier and ESLint passed.
- `git diff --check`: passed.

### Follow-up self-review

- Protocol boundary: neither direction of the academic drop protocol contains
  arbitrary MIME records or integer item IDs; tests inspect both message arms.
- Production drag behavior: only Zotero's canonical item flavor is consumed,
  with deterministic precedence, order, and duplicate semantics matching the
  inspected Zotero drag implementation.
- Mixed acquisition: Attachment input remains an indexed typed failure (the
  required mixed example returns failure indexes `[1]`) and creates no node or
  placeholder; Literature and Note counts remain distinct.
- Async/history: acquisition outcomes retain input indexes despite settlement
  order, successes commit once, and zero-success batches do not create history
  or save revisions.
- Correlation: stale acquisition, annotation, resolution, Note refresh, and open
  replies cannot mutate a replaced document or display a notice.
- Localization/privacy: raw host diagnostics remain available to logs but have
  no rendering path; all user-facing summaries and failures use active Fluent
  labels.
- Lifecycle: drop listeners, message/key listeners, React, timers, and pending
  correlation state are released by their owning session.
- Scope: no Task 9 documentation was modified.

## Review follow-up: accessible notices and specific failures

This follow-up supersedes the earlier statement that notices are
pointer-transparent. The notice remains a compact absolutely positioned region,
so the rest of the canvas is unobstructed, but the region itself now accepts
pointer input for a localized close button. The advisory text uses
`role="status"`, `aria-live="polite"`, and `aria-atomic="true"`; the close control
is a native button labelled by the active locale and supports click, Enter, and
Space activation. Notices auto-expire after eight seconds. Replacing a notice
resets that timer, while success clearing, document replacement, and unmount
cancel it through the component effect lifecycle.

Canvas notices now retain the finite failure code associated with open,
explicit source refresh, Note refresh, and annotation list replies. The iframe
maps library missing, item missing, wrong kind, parent mismatch, unavailable
attachment, unavailable annotation, resolution failure, open failure, and list
failure to distinct active Fluent strings. Partial annotation failures retain
all distinct reasons. Action context remains visible, but raw gateway diagnostic
text has no rendering path. The Properties panel's accessible `Selection` name
also comes from the active locale payload instead of a hard-coded string.

Picker exceptions and native/acquisition drop failures now pass through one
host logging helper before rejection. Log records include operation, request ID,
optional node/input index, finite code, and raw diagnostic. Native resolver
exceptions become typed `drop-malformed` results; only the localized code crosses
to the visible notice, while the host keeps the diagnostic. Picker cancellation
remains silent. A mounted production-editor test exercises initial iframe load,
reload without duplicate listeners, typed rejection logging context, and final
listener release on destroy.

### Accessible-notice RED evidence

The initial focused run reported 85 tests: 77 passed and 8 failed. The failures
showed the absent mounted notice component, pointer-transparent notice CSS,
hard-coded Properties-panel accessible name, missing specific en/zh failure
labels, discarded source-action failure specificity, and missing production
diagnostic logging helper.

A separate resolver-exception test then failed 1/1 because an exception escaped
the native drop capture listener instead of becoming a typed host diagnostic.
The listener catch and correlated logging callback were added only after that
RED result.

### Accessible-notice GREEN evidence

- Focused notice/app/drop/localization/scheduler/gateway/annotation/bootstrap/
  protocol/module suites: 144 passed, 0 failed.
- Full `pnpm run test:unit`: 580 passed, 0 failed across 24 suites.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run lint:check`: Prettier and ESLint passed.
- `git diff --check`: passed.

### Accessible-notice self-review

- Mounted behavior: DOM tests exercise click and keyboard dismissal, polite
  announcement semantics, timer expiry/reset, success clearing, and unmount
  cleanup rather than relying only on source inspection.
- Canvas interaction: only the compact notice receives pointer events; no
  full-canvas overlay or modal behavior was introduced.
- Specificity/privacy: closed typed unions constrain the visible reason, all
  active en/zh labels remain in parity, and raw host messages are absent from
  notices and source-state tooltips.
- Correlation: specific reasons are attached only after the existing
  request/node/source or annotation-session checks accept a reply. Stale replies
  remain inert.
- Logging: picker/drop diagnostics are recorded before rejection with request
  context. Indexed acquisition failures retain their input index in the log.
- Lifecycle: the real editor rebinding test proves reload replaces listeners
  instead of multiplying them and destroy detaches the active document.
- Persistence/history: notices, timers, labels, error codes, and diagnostics
  remain transient and do not alter Task 8's single-revision or zero-success
  guarantees.
- Scope: no Task 9 document was changed.

## Bridge regression follow-up: cross-realm closed validation

The initial nullable-source bridge fix compared every record prototype with the
validator realm's `Object.prototype`. That accepted local records but rejected
ordinary records created in the packaged iframe realm. Its field checks also
read inherited envelope properties and allowed unknown own properties in nested
academic values.

### Cross-realm RED evidence

- A production `createWhiteboardEditor` test passed a valid `ready` message
  created by a separate happy-dom window with `source: null`. No `init` reply was
  posted (`actual: undefined`, `expected: "init"`).
- Strict-ingress tests failed because inherited/polluted envelope fields and
  extra envelope, payload, academic-source, and acquisition fields were
  accepted.
- A hostile prototype proxy escaped the validator as an exception rather than
  being rejected as malformed input.

Each failure was observed before changing the corresponding production guard.

### Cross-realm GREEN evidence

- Focused protocol and production-bridge suites: 20 passed, 0 failed.
- Full `pnpm run test:unit`: 587 passed, 0 failed across 24 suites.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run lint:check`: Prettier and ESLint passed.
- `git diff --check`: passed.

### Cross-realm self-review

- Data records: ordinary records from local, VM, and happy-dom window realms
  are accepted without realm identity comparison. Arrays, null, functions,
  Date, Map, class/DOM instances, custom prototypes, accessors, symbols, and
  throwing proxy traps are rejected.
- Envelope ownership: source marker, channel, v2 version, type, and any payload
  used by an arm must be own data properties. Prototype-pollution tests restore
  every modified descriptor in `finally`.
- Closed shapes: every active message arm in both directions has a compile-time
  exhaustive positive sample. Envelopes and all academic library, source,
  acquisition, drop, result, candidate, and failure records use exact allowed
  key sets; user libraries cannot carry `groupID`, and academic values cannot
  carry integer IDs or raw MIME bags.
- Finite values: all request, acquisition, source-action, resolution,
  annotation, and drop failure codes are compile-time-exhaustive records.
  Commands, priorities, formats, states, indexes, generations, revisions, item
  IDs, pages, group IDs, positions, and counts are bounded to their protocol
  domains.
- Initialization: labels require every protocol-defined key and an exact plural
  record. Canvas snapshots pass the canonical parser with no repair issues and
  must retain exactly the parsed data shape, preventing silent field dropping.
- Source semantics: exact peer windows remain accepted; the Zotero-only null
  source exception is evaluated only after closed validation. Wrong non-null
  windows and malformed null-source messages remain inert.
- Scope: no Task 9 document or report was modified.

## Bridge regression follow-up: canonical snapshots and hostile ingress

This follow-up closes the remaining schema/bridge mismatch found during real
save verification. `flowToCanvasDocument` no longer materializes optional
connection `label` or `color` properties with `undefined` values. An ordinary
unlabelled React Flow edge therefore remains byte-for-byte compatible with the
canonical parser and the closed protocol validator. The production host test
now exercises the complete flow conversion, null-source `snapshot` reply,
`requestSnapshot` waiter, and `save` event. A correlated snapshot reply clears
its timeout immediately; destroy also clears and rejects all pending waiters.

Protocol ingress is now total over hostile input: every public validator and
event dispatcher has a full exception boundary, reflective record/array
helpers reject trap failures, and indexed arrays are inspected through own data
descriptors without invoking accessors, element getters, `length` getters, or
iterators. The host listener adds a final guard against a stateful value that
changes after validation. Genuine ordinary records from other realms and
null-prototype dictionaries remain supported, while a custom null-parent
prototype forged with an `Object` constructor is rejected by the realm-neutral
`constructor.prototype === prototype` invariant.

The canonical document parser now shares the protocol's positive safe-integer
domain for group library IDs. Annotation candidates accept the gateway's real
empty-string `sortIndex` fallback. Finally, production TypeScript owns closed
maps for every active message type in both directions and switches end in a
`never` assertion, so adding a union arm without validator classification fails
typechecking. Optional host-produced labels and diagnostics are omitted instead
of crossing as explicit `undefined`.

### Canonical/hostile RED evidence

- The first focused run reported 66 tests: 61 passed and 5 failed. The failures
  independently reproduced `label: undefined` persistence rejection, invalid
  group IDs accepted by the canonical parser, a custom-prototype record
  accepted as plain, a throwing nested-array `ownKeys` trap escaping validation,
  and a real gateway annotation with empty `sortIndex` rejected by the bridge.
- A dedicated snapshot-timer RED test passed the reply but failed because its
  eight-second timeout was not cancelled (`actual: 0`, `expected: 1` cleared
  timers); the process stayed alive for about 8.3 seconds.
- A production-init RED test showed an omitted labels option still crossed as
  an own `labels: undefined` property.
- Independent review then found two broader cases. New RED tests proved that
  node `style`/`extensions` and connection `extensions` could still cross as
  own `undefined` fields, and that a custom prototype with a self-consistent
  fake `function Object()` constructor could satisfy the first structural
  check. Both tests failed before recursive producer normalization and the
  native-constructor invariant were added.

All failures were observed before their corresponding production changes.

### Canonical/hostile GREEN evidence

- Focused protocol/document/gateway/production-bridge suites: 66 passed,
  0 failed.
- The focused snapshot test completes in about 0.28 seconds rather than waiting
  for the eight-second fallback timer.
- Full `pnpm run test:unit`: 590 passed, 0 failed across 24 suites.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm run lint:check`: Prettier and ESLint passed.
- `pnpm run whiteboard:build`: package typecheck and Vite production build
  passed.
- `pnpm run build`: Zotero plugin production build and root typecheck passed.
- `git diff --check`: passed.

### Canonical/hostile self-review

- Snapshot boundary: the producer removes stale optional connection fields
  before rebuilding them, then recursively omits undefined record fields from
  nodes, connections, styles, snapshots, and extensions. An existing
  `undefined` therefore cannot leak through a nested spread; null handles,
  array positions, and explicit boolean edge settings remain canonical.
- Waiter lifecycle: only the matching request clears/resolves its timeout;
  unrelated and stale replies remain inert, while destruction releases every
  remaining timer and waiter.
- Hostile safety: root and nested own-key, descriptor, getter, iterator,
  length, and element cases are covered. Data-descriptor reads avoid executing
  accessors; all remaining reflective operations are contained by a false-on-
  exception public boundary.
- Realm compatibility: VM/happy-dom ordinary records, local ordinary records,
  and null-prototype records are accepted. Arrays, browser objects, class
  instances, accessors, symbols, exotic prototypes, and custom-prototype
  forgeries remain rejected.
- Producer compatibility: the integration suite covers an unlabelled snapshot,
  empty annotation sort index, empty failure arrays, absent labels/diagnostics,
  and canonical group library references.
- Scope: no Task 9 document or report was modified.
- Independent re-review found no remaining Critical or Important issues after
  the broader undefined-shape and forged-prototype regressions were fixed.
