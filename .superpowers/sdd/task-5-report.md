# Task 5 RED/GREEN Report

## Outcome

Implemented source-backed Zotero Note import and confirmed manual refresh. The
local Note toolbar still creates a local Note. Generic Zotero picker/drop
acquisition now accepts standalone and child Notes while continuing to reject
Attachments.

Confirmed refresh is correlated by request and node. It replaces `content` and
`sourceSnapshot` together, records exactly one history commit, advances the save
revision once, and is undoable. Cancellation, gateway failure, stale replies,
and source-identity mismatches do not commit or alter the document.

Background Note resolution retains local `content` and updates only the
source-title snapshot plus transient availability state.

## RED

Added failing coverage in:

- `test/whiteboard-app-state.test.ts`
  - standalone and child Note placeholder replacement;
  - background resolution preserving `Local edit`;
  - refresh visibility for source-backed Notes only;
  - localized warning invoked once;
  - cancel posting nothing;
  - confirmed request correlation;
  - atomic content/title overwrite, one revision, and undo;
  - source mismatch/failure preserving the original document.
- `test/whiteboard-localization.test.ts`
  - English/Simplified Chinese parity for every new protocol label;
  - host label wiring;
  - local Note toolbar remains local while the generic picker accepts Notes.
- `test/whiteboard-save-integration.test.ts`
  - Note acceptance, `gateway.refreshNote(source)`, and response application.

Initial RED command:

```text
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts
```

Result: exit 1, 13 passed and 5 failed. The failures were the expected missing
Note refresh module, absent locale keys/host wiring, Note filtering in generic
acquisition, and absent gateway refresh path.

## GREEN

Implementation details:

- generalized the academic acquisition placeholder to materialize a canonical
  Academic Note with `content`, `source`, and optional `sourceSnapshot`;
- allowed Regular Items or Notes in the generic Zotero picker/drop path without
  enabling Attachments or adding a Zotero Note toolbar action;
- added a pure confirmation/request transition and a source-identity-checked
  immutable refresh transition;
- completed `refreshZoteroNote` / `noteRefreshed` forwarding across bootstrap,
  iframe editor, host tab, and runtime;
- added `CanvasDocumentHistory.commit()` to bind the pre-edit snapshot and one
  revision notification;
- surfaced transient source availability and the Note-only refresh action in
  properties;
- wired active `addon.ftl` locale resources and refreshed generated Fluent ID
  typings.

Focused GREEN command:

```text
pnpm exec tsx --test test/whiteboard-app-state.test.ts test/whiteboard-localization.test.ts test/whiteboard-save-integration.test.ts test/whiteboard-source-gateway.test.ts test/whiteboard-bootstrap.test.ts
```

Result: exit 0, 75 passed, 0 failed.

Full unit command (run once):

```text
pnpm run test:unit
```

Result: exit 0, 512 passed, 0 failed.

TypeScript command:

```text
pnpm exec tsc --noEmit
```

Result: exit 0.

## Scope Notes

The task list named `mainWindow.ftl`, but whiteboard host strings are loaded by
`getString()` from the active `addon.ftl` Fluent resource. The implementation
therefore updates `addon/locale/en-US/addon.ftl` and
`addon/locale/zh-CN/addon.ftl`, plus `typings/i10n.d.ts`.

End-to-end Note refresh also required the already established protocol bridge
files (`bootstrap.tsx`, `bootstrapState.ts`, and the host `editor.ts`) and the
academic acquisition runtime. These additions remain within the v2 interfaces
declared before Task 5.

## Self-review

- No Zotero integer IDs are persisted.
- Note refresh compares the complete native source cache key before overwrite.
- Pending refresh state is cleared on document replacement.
- A failed refresh reports the host error but does not mutate nodes, history, or
  save revision.
- Background source updates remain outside undo/save history.
- No hard-coded CJK text was added to the isolated whiteboard package.
