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
