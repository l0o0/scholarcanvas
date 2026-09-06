# Task 6 Report: Literature Annotation Browser

## Scope

Implemented the on-demand Literature annotation browser and selection UI on base
`ec3e590`. Quote batch acquisition and persistence remain explicitly deferred to
Task 7.

The implementation adds:

- a Literature-only **View annotations** action;
- a correlated protocol-v2 list request and typed success/failure replies;
- a host call to `gateway.listAnnotations()` only after the action is invoked;
- an accessible, localized annotation dialog with loading, empty, unavailable,
  and partial-failure states;
- gateway-order-preserving attachment grouping and case-insensitive search over
  excerpt, comment, and page label;
- checkbox multi-selection, document-wide duplicate disabling, **Already
  added**, and **Focus existing** behavior;
- Escape, close-button, and backdrop dismissal with focus restoration to the
  **View annotations** trigger;
- active `addon.ftl` English and Simplified Chinese messages and generated
  Fluent message-id typings.

No Zotero item or attachment integer ID was added to the annotation request,
reply, browser state, or document model. The new payloads use library and native
item/attachment/annotation keys only.

## RED

Tests were added before production code in
`test/whiteboard-annotation-browser.test.ts`, with supplemental bridge and
localization assertions in the existing focused tests.

Command:

```bash
pnpm exec tsx --test test/whiteboard-annotation-browser.test.ts test/whiteboard-bootstrap.test.ts test/whiteboard-localization.test.ts
```

Observed result: exit 1, 6 passed and 5 failed. The failures were the intended
missing-feature failures:

- `ERR_MODULE_NOT_FOUND` for `AnnotationBrowser.tsx`;
- no `listLiteratureAnnotations` bridge wiring;
- annotation list success/failure messages were not dispatched to the runtime;
- the new active-locale keys were absent;
- the new labels were not wired into the whiteboard initialization payload.

This established RED before any production implementation.

## GREEN and regression verification

Focused behavioral/render, bridge, localization, and node-registry tests:

```bash
pnpm exec tsx --test test/whiteboard-annotation-browser.test.ts test/whiteboard-bootstrap.test.ts test/whiteboard-localization.test.ts test/whiteboard-node-registry.test.ts
```

Result: exit 0, 64 passed, 0 failed.

TypeScript:

```bash
pnpm exec tsc --noEmit
```

Result: exit 0.

Full existing unit suite, run once after the focused suite was green:

```bash
pnpm test:unit
```

Result: exit 0, 515 passed, 0 failed.

Changed-file lint:

```bash
pnpm exec eslint packages/whiteboard/src/chrome/AnnotationBrowser.tsx packages/whiteboard/src/model/protocol.ts packages/whiteboard/src/bootstrapState.ts packages/whiteboard/src/bootstrap.tsx packages/whiteboard/src/chrome/PropertiesPanel.tsx packages/whiteboard/src/whiteboard/app.tsx src/modules/whiteboard/editor.ts src/modules/whiteboard/tab.ts test/whiteboard-annotation-browser.test.ts test/whiteboard-bootstrap.test.ts test/whiteboard-localization.test.ts
```

Result: exit 0.

Formatting and whitespace:

```bash
pnpm exec prettier --write packages/whiteboard/src/chrome/AnnotationBrowser.tsx test/whiteboard-annotation-browser.test.ts packages/whiteboard/src/model/protocol.ts packages/whiteboard/src/bootstrapState.ts packages/whiteboard/src/bootstrap.tsx packages/whiteboard/src/chrome/PropertiesPanel.tsx packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/whiteboard/board.css src/modules/whiteboard/editor.ts src/modules/whiteboard/tab.ts typings/i10n.d.ts test/whiteboard-bootstrap.test.ts test/whiteboard-localization.test.ts
git diff --check
```

Result: both exited 0. Fluent resources were inspected directly because
Prettier has no `.ftl` parser.

## Self-review

- Entry: the action renders only for the one node passed to the properties panel
  when that node is Literature.
- Laziness: rendering or selecting Literature performs no annotation lookup;
  the action callback creates one request, and a ref guard prevents a second
  request while the browser session is open.
- Correlation: replies carry request ID plus native-key Literature source;
  closed or stale request IDs cannot update the dialog.
- Typed errors: terminal list failure is a discriminated
  `annotationListFailed` payload with a finite failure-code union. Successful
  replies carry a typed failure array so the same UI can retain successful rows
  while reporting partial failure.
- Ordering/search: grouping retains each attachment's first gateway position and
  candidate order; filtering does not sort and searches only text, comment, and
  page label as specified.
- Duplicates: every Quote in the working document contributes its annotation
  key, irrespective of Literature origin. Existing rows have disabled
  checkboxes and a focus action that selects and fits the existing Quote.
- Accessibility: the overlay has `role="dialog"`, `aria-modal`, a labeled search
  input, live status content, native checkboxes/buttons, visible focus rings,
  Escape/backdrop/close dismissal, and trigger focus restoration.
- Presentation: viewport-safe sizing, scrollable results, existing light/dark
  variables, restrained color marks, and no decorative motion were used.
- Persistence boundary: `onAddSelected` is deliberately not connected to a
  document mutation or host acquisition message in Task 6. The button's enabled
  selection state is ready for Task 7.
- Localization: only the runtime-loaded `addon/locale/*/addon.ftl` resources and
  `typings/i10n.d.ts` were changed; `mainWindow.ftl` was not modified.

## Commit

Commit subject: `feat(canvas): browse Literature annotations`

The commit containing this report is the Task 6 implementation commit based on
`ec3e590`.

---

## Important-review corrections

The four Important findings raised after the initial Task 6 commit were fixed
in a separate follow-up change. This section supersedes the narrower identity,
correlation, partial-failure, and accessibility statements in the initial
self-review above.

### Corrected behavior

- Added deterministic source identity helpers covering library type, group ID
  when applicable, item key, attachment key, and annotation key. The complete
  Quote identity now backs `existingAnnotationKeys`, checkbox selection, React
  row keys, duplicate detection, and **Focus existing**. Attachment grouping is
  keyed by the same identity minus annotation key, so equal display titles do
  not merge distinct attachments; group and candidate ordering still follows
  the gateway result.
- Changed `listAnnotations()` to return a typed result containing both valid
  candidates and partial failures. Attachment read/parent failures and invalid
  annotation records are reported with stable codes and native keys where
  available; deliberately unsupported or empty annotation kinds remain
  exclusions. Terminal failures use `SourceGatewayError`, and the host branches
  on its code rather than parsing English messages. A real gateway -> host ->
  protocol -> runtime test proves both partial and terminal paths. No Zotero
  item or attachment integer ID enters these results.
- Centralized annotation-browser session transitions. Success and failure
  replies now require both the current request ID and the exact Literature
  source identity. Closing, reopening, and replacing the loaded document clear
  the prior session, leaving stale or source-mismatched replies inert.
- Replaced handler-only modal behavior with mounted DOM semantics: initial
  search focus, Tab/Shift+Tab wrapping, capture-phase window Escape handling,
  inert and `aria-hidden` background management with exact restoration, and
  trigger focus return after Escape, backdrop, and close-button dismissal.
  **Focus existing** suppresses trigger restoration and transfers focus to the
  selected React Flow node, falling back to the programmatically focusable
  canvas host.
- Added `happy-dom` as a test-only dependency and registered all annotation and
  source-gateway behavioral tests in `test:unit`. Quote batch persistence remains
  untouched and deferred to Task 7. No localization resource needed correction;
  the browser continues using the active `addon.ftl` messages.

### Follow-up RED evidence

The correction tests were written before correction production code.

```bash
pnpm exec tsx --test test/whiteboard-annotation-browser.test.ts test/whiteboard-annotation-dialog-dom.test.ts test/whiteboard-annotation-session.test.ts test/whiteboard-source-gateway.test.ts test/whiteboard-annotation-list-integration.test.ts test/whiteboard-bootstrap.test.ts
```

Initial result: exit 1. Four files failed to load because the complete identity
helpers, `SourceGatewayError`, exported host handler, and session-transition
module did not exist; the DOM test also failed through the missing identity
dependency. This established RED for all four review areas.

An additional invalid-record regression was then isolated:

```bash
pnpm exec tsx --test --test-name-pattern="typed partial failures" test/whiteboard-source-gateway.test.ts
```

Result before the fix: exit 1, 0 passed, 1 failed. The returned non-annotation
record was silently omitted instead of producing the expected typed
`annotation-unavailable` partial failure. After moving record validation into
the per-annotation failure boundary, the same command passed 1/1.

### Follow-up GREEN and regression verification

Focused browser, DOM, session, gateway, host/runtime integration, and bridge
suite:

```bash
pnpm exec tsx --test test/whiteboard-annotation-browser.test.ts test/whiteboard-annotation-dialog-dom.test.ts test/whiteboard-annotation-session.test.ts test/whiteboard-source-gateway.test.ts test/whiteboard-annotation-list-integration.test.ts test/whiteboard-bootstrap.test.ts
```

Final result: exit 0, 32 passed, 0 failed.

Full unit suite, including the newly registered annotation and gateway tests:

```bash
pnpm test:unit
```

Final result: exit 0, 543 passed, 0 failed.

TypeScript:

```bash
pnpm exec tsc --noEmit
```

Final result: exit 0.

Changed-file lint:

```bash
pnpm exec eslint packages/whiteboard/src/chrome/AnnotationBrowser.tsx packages/whiteboard/src/model/academic.ts packages/whiteboard/src/model/protocol.ts packages/whiteboard/src/whiteboard/annotationBrowserState.ts packages/whiteboard/src/whiteboard/app.tsx src/modules/whiteboard/source-gateway.ts src/modules/whiteboard/tab.ts test/whiteboard-annotation-browser.test.ts test/whiteboard-annotation-dialog-dom.test.ts test/whiteboard-annotation-list-integration.test.ts test/whiteboard-annotation-session.test.ts test/whiteboard-source-gateway.test.ts
```

Final result: exit 0.

Formatting and whitespace:

```bash
pnpm exec prettier --check package.json packages/whiteboard/src/chrome/AnnotationBrowser.tsx packages/whiteboard/src/model/academic.ts packages/whiteboard/src/model/protocol.ts packages/whiteboard/src/whiteboard/annotationBrowserState.ts packages/whiteboard/src/whiteboard/app.tsx src/modules/whiteboard/source-gateway.ts src/modules/whiteboard/tab.ts test/whiteboard-annotation-browser.test.ts test/whiteboard-annotation-dialog-dom.test.ts test/whiteboard-annotation-list-integration.test.ts test/whiteboard-annotation-session.test.ts test/whiteboard-source-gateway.test.ts
git diff --check
```

Final result: both exited 0.

### Follow-up self-review

- Identity strings are serialized fixed-order tuples, not delimiter-concatenated
  strings, so native keys cannot collide by containing a separator. User and
  group libraries cannot collide, and group identity includes `groupID`.
- Partial failures are data in a successful result, while terminal failures are
  exceptions with a finite code union. The host contains no message-substring
  classification.
- Source correlation compares the full Literature tuple rather than object
  identity, and both successful and failed replies use the same guard.
- Modal cleanup restores each sibling's prior `inert` value and prior
  `aria-hidden` attribute rather than assuming the background began enabled.
  Real DOM tests assert focus and unmount behavior instead of invoking JSX
  handlers directly.
- The Add action remains a deliberate no-op in Task 6; no Quote creation,
  mutation, history entry, save, or persistence path was added.

### Follow-up commit

Commit subject: `fix(canvas): harden annotation browser sessions`

This follow-up is a separate commit on top of `ef05527`.

---

## Global keyboard isolation correction

A final Important review finding identified that the production App-level
`window.keydown` listener could still interpret annotation-search keystrokes as
canvas commands. The modal listener and canvas listener both live on `window`,
so event propagation alone was not a sufficient ownership boundary.

### RED

An integrated happy-dom test was added using the real `AnnotationBrowser` and
the same global keyboard handler used by `WhiteboardApp`:

```bash
pnpm exec tsx --test --test-name-pattern="production canvas keyboard" test/whiteboard-annotation-dialog-dom.test.ts
```

Initial result: exit 1. The test module could not import
`handleGlobalCanvasKeyDown`, proving that production had no shared keyboard
ownership boundary to exercise.

The editable-target guard was also mutation-checked by temporarily removing it
after expanding the test to a non-modal input. The same command exited 1 with
`true !== false`: the `e` shortcut was prevented and consumed from that input.
Restoring the guard returned the test to GREEN. These RED runs were performed
before the final implementation state recorded below.

### Implementation and self-review

- `handleGlobalCanvasKeyDown` is now the single production policy for App-level
  Escape, unmodified tool shortcuts, Delete/Backspace, and Arrow-key nudging.
- The first guard rejects every canvas command while an annotation-browser
  session is live. Therefore modal Escape owns dismissal through `onClose`, the
  session is invalidated by the established close path, and the dialog cleanup
  restores focus to **View annotations**.
- The same first guard ignores input, select, textarea, and contenteditable
  targets outside the modal. It is shared with Arrow-key capture rather than
  duplicating a second editable-target definition.
- The integrated test dispatches e/r/a/t, Backspace, Delete, and ArrowRight at
  the real search input and asserts that none is prevented, no tool changes, no
  nudge occurs, and the selected Literature is not deleted. It then dispatches
  Escape and asserts real dialog unmount plus trigger focus restoration.
- After the modal closes, the same production listener is exercised against an
  ordinary canvas target: `e`, Delete, and ArrowRight still select Eraser,
  delete the selection, and nudge respectively. A separate non-modal input
  remains untouched.
- Existing Frame-drag and unified-deletion tests retain their behavioral checks;
  only their App wiring assertions were updated from the previous inline
  key-branch location to the shared handler actions.

### GREEN and verification

Focused annotation and App-state suite:

```bash
pnpm exec tsx --test test/whiteboard-annotation-dialog-dom.test.ts test/whiteboard-app-state.test.ts test/whiteboard-annotation-browser.test.ts test/whiteboard-annotation-session.test.ts
```

Result: exit 0, 62 passed, 0 failed.

Full unit suite:

```bash
pnpm test:unit
```

Result: exit 0, 544 passed, 0 failed.

TypeScript, targeted production/new-test lint, formatting, and whitespace
checks:

```bash
pnpm exec tsc --noEmit
pnpm exec eslint packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/whiteboard/keyboard.ts test/whiteboard-annotation-dialog-dom.test.ts
pnpm exec prettier --check .superpowers/sdd/task-6-report.md packages/whiteboard/src/whiteboard/app.tsx packages/whiteboard/src/whiteboard/keyboard.ts test/whiteboard-annotation-dialog-dom.test.ts test/whiteboard-app-state.test.ts
git diff --check
```

Final result: all commands exited 0.

### Commit

Commit subject: `fix(canvas): isolate modal keyboard input`

This is a separate correction commit on top of `beb6a23`.
