# Task 7 Report — Adopt Academic Host Persistence

## Result

The Zotero host now opens, saves, creates, and exchanges only canonical
`CanvasDocument` snapshots. Host file I/O accepts `.canvas` paths, returns
`ParsedCanvasFile` diagnostics, writes Bamboo schema version 2 atomically, and
contains no runtime format switch or `.board`/`.zmdboard` compatibility API.

The existing save lifecycle remains intact: autosave is still 800 ms, closing
clears pending autosave work and flushes before editor destruction, and plugin
shutdown still flushes every coordinator before closing sessions.

## TDD Record

### Primary host contract RED/GREEN

The first required six-suite run contained 16 tests: 9 passed and 7 failed.
The failures were the intended contract gaps:

- `.board` and `.zmdboard` were still detected as whiteboards;
- `readCanvasFile()` and `writeCanvasFile()` did not exist;
- the host snapshot module still exported the old schema authority;
- the protocol still imported `BoardDocument`, `BoardNodeData`, and
  `WhiteboardSnapshot` and exposed `noteID`;
- the tab still called the old read/write/parser APIs; and
- collection creation still stored a Zotero Note integer ID.

After the canonical re-export, file-I/O, protocol, creation, and tab changes,
the same suites passed 28 tests with no failures. The expanded total includes
the additional `.canvas` reader suffix guard and collection behavior coverage.

### Focused behavior cycles

- Basic picker coverage first failed 1 of 24 app-state tests because the
  parser still accepted a Note payload. GREEN removed Note from the picker
  union/parser/merge path while retaining typed `item`, `pdf`, and
  `attachment` payloads.
- Runtime contract coverage first failed 1 of 25 app-state tests because
  `applyDocument()` and `loadSnapshot()` still accepted `unknown`. GREEN types
  both operations and the app/bootstrap handoff as `CanvasDocument`.
- The `.board` direct-read regression first failed 1 of 6 file-I/O tests
  because the reader still opened that suffix. GREEN rejects it before the
  injected reader is called.
- The collection builder test first failed at module loading because
  `buildCollectionCanvas()` was not exported. GREEN exposes the pure builder
  for testing and proves a mocked Zotero Note becomes local plain text with no
  `noteID`.

## Implementation

- `readCanvasFile()` returns the canonical `{ document, issues }` result and
  preserves every recoverable issue for the host.
- The tab logs each issue separately with `code`, affected `objectId`, and
  message, then mounts `parsed.document`.
- `writeCanvasFile()` always serializes `CanvasDocument`, appends `.canvas`
  when needed, and writes with `tmpPath: "${target}.tmp"` and `flush: true`.
- New attachments serialize `emptyCanvasDocument()` by default.
- Collection canvases use canonical Basic nodes/connections. Zotero Note HTML
  is copied once into Academic Note plain-text `content`; no integer Note ID is
  persisted.
- Protocol snapshots, editor handles, runtime methods, save snapshots, and
  host entry-point re-exports now use canonical v2 types.
- Basic picker payloads have one explicit `BasicPickerPayload` union containing
  only `item`, `pdf`, and `attachment`.

## Removed Legacy Surface

The host no longer exports or consumes:

- `StoredCanvasFormat` or any `format: "legacy"` branch;
- `canvasFormatForPath()`;
- `readBoardFile()` / `writeBoardFile()` / `serializeBoardDocument()`;
- `ensureBoardExtension` or legacy picker filters;
- `parseBoardDocument()` / `emptyBoard()` / `demoBoard()`;
- `BoardDocument`, `BoardNodeData`, or `WhiteboardSnapshot`; or
- Note picker/drop/open payloads containing `noteID`.

Intentional legacy suffix strings remain only in negative tests that prove
`.board` and `.zmdboard` are rejected or receive a new `.canvas` suffix.

## Diagnostics

A broad `test/whiteboard-*.test.ts` probe passed 139 of 140 tests. Its single
failure is the planned Task 8 export fixture: `whiteboard-export.test.ts` still
constructs the old `BoardDocument` with `edges`, while the already-canonical
export implementation reads `CanvasDocument.connections`. Task 7 did not
modify export and did not add a compatibility schema to conceal this known
next-task boundary.

The affected-suite Vite SSR teardown printed `The build was canceled` while
closing its middleware server; the Node test runner still reported 60 passed,
0 failed and exited successfully.

## Verification

Fresh verification before the report:

- required six host suites: 28 passed, 0 failed;
- root `pnpm exec tsc --noEmit`: exited 0;
- affected app/bootstrap/codec/document/session/module/localization/toolbar
  suites: 60 passed, 0 failed;
- package `pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit`:
  exited 0;
- `pnpm lint:check`: exited 0 after a mechanical Prettier pass;
- `git diff --check`: exited 0.
