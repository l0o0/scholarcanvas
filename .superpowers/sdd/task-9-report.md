# Task 9 Report: Remove the Experimental Board Schema

## Scope and deletion decision

- Added the three planned tests to the root `test:unit` command:
  `whiteboard-academic-model`, `whiteboard-academic-document`, and
  `whiteboard-frame`.
- Deleted `packages/whiteboard/src/model/snapshot.ts` (441 lines) and removed
  its package-model barrel export.
- Kept the canonical schema modules as the only model authority: `core`,
  `basic`, `academic`, `connection`, `document`, `canvas-file`, and `protocol`.
- Kept `src/modules/whiteboard/snapshot.ts` as the existing four-line host
  facade over `document`, `basic`, `academic`, and `connection`; it contains no
  schema or parser implementation of its own.
- Renamed implementation-domain symbols from Board to Canvas, including the
  node registry, generated filename, session ID, asset helpers, protocol
  parameter, toolbar label, Fluent key, item-menu DOM ID, and local attachment
  variable. The `Whiteboard*` product/module name and the established
  `zmd-board-*` CSS classes and `board.css` filename remain intentionally
  stable.
- Confirmed that `src/modules/whiteboard/index.ts` already exposes
  `CanvasDocument`, `CanvasNode`, `CanvasConnection`, and the canonical
  factories, so it needed no additional diff. Added an SSR entrypoint test for
  the package-level registry and factories. Added a real TypeScript consumer
  fixture, included by root `tsc`, which imports and compares the three public
  types from both the package and host barrels.

## Entropy consumer proof

Before deletion, exact symbol and path searches established the following:

- `BoardDocument`, `BoardNodeData`, `BoardNodeKind`, `BoardEdge`,
  `BOARD_ENGINE`, `parseBoardDocument`, and the other old-format symbols were
  defined only by the retired package `model/snapshot.ts` and referenced by its
  own tests/history assertions.
- The sole production exposure was `export * from "./snapshot"` in the package
  model barrel (and therefore transitively the package root barrel). No source
  file directly imported the retired package path.
- Searches across package sources, host sources, package manifests, entrypoints,
  dynamic imports, and registries found no lazy import, `require`, string-based
  loader, or alternate entrypoint for that file.
- Protocol messages already type snapshots as `CanvasDocument` from
  `model/document.ts`.
- Persistence already flows through `readCanvasFile` / `writeCanvasFile` and
  `parseStoredCanvas` / `serializeCanvasDocument`. The host tab normalizes
  runtime snapshots with `parseCanvasDocument`.
- Git history shows the functional consumers moved during the canonical-model
  and persistence cutover, most recently in `27d016c` (`adopt academic
  persistence`); the deleted module remained as an unused experimental API.

The final prescribed residual search has no production matches. Its only
matches are the intentional rejection cases for `review.board` and
`review.zmdboard` in `whiteboard-detect.test.ts` and `whiteboard-file-io.test.ts`.

### Compatibility tradeoff

This removes the experimental xyflow v1 public types/functions and does not
open `.board` or `.zmdboard` files. There is deliberately no compatibility shim
or converter. This is acceptable because the product has not shipped and the
task explicitly authorizes incompatibility with the experimental format. The
canonical `.canvas` JSON Canvas/Bamboo v2 boundary and current exported
capabilities remain available.

## TDD and smoke-discovered fix

The cleanup tests were changed before implementation. The focused RED run
failed for the expected missing Canvas names, missing `whiteboard-canvas`
localization, still-present retired schema file, and missing canonical package
entrypoint exports. The corresponding focused GREEN run passed 48/48.

The initial real 390x844 browser smoke exposed a separate narrow-canvas defect:
React Flow's default `minZoom=0.5` prevented Fit View from fitting all six
objects. A focused source assertion was added first and failed; setting
`minZoom={0.1}` made it pass and the repeated browser smoke fitted the fixture at
zoom `0.322772` with no node clipping.

## Standalone visual smoke

The smoke used the repository dev server at `http://127.0.0.1:5173/` and the
installed Google Chrome in headless CDP mode. No dependency was installed or
added. The script mounted the real `WhiteboardApp` with a Chinese six-object
fixture and drove real DOM/pointer/keyboard controls. The server and browser
were stopped afterward.

### 900x840

- Toolbar rectangle: left `225`, right `675`, width `450`; no toolbar button or
  toolbar edge was clipped.
- Literature, Quote, Note, Question, Claim, and Frame were all present,
  distinct, and readable. Visible type labels and content were Chinese, and no
  internal kind key was visible.
- The Frame computed at z-index 0 and its members at z-index 1.
- A real Frame drag moved both Frame and direct member by exactly
  `{x: 43, y: 27}`, demonstrating a single shared snapped delta.
- Edge path existed; keyboard focus plus Enter selected the connection.
- Note, Question, Claim, and Frame were created through their toolbar actions
  and edited to Chinese content.
- Undo changed the last Frame title edit and Redo restored it; node count stayed
  stable, proving edit history rather than accidentally deleting an object.
- Save invoked the real callback and the Chinese saving-state indicator became
  visible.
- Dark mode applied the dark host theme (`rgb(18, 20, 26)`). Fit View changed
  the viewport transform/zoom.

### 390x844

- Toolbar rectangle: left `1`, right `389`, width `388`; no toolbar button was
  clipped.
- Fit View put all six objects in the viewport without node clipping; viewport
  transform was
  `translate(26.5446px, 334.851px) scale(0.322772)`.
- Fit View at that whole-document scale is an overview, not the readability
  check. At practical interaction zoom `1.0`, two vertically panned captures
  showed Frame/Literature/Quote/Note and Note/Question/Claim respectively.
  Every kind label and content line was readable Chinese with no internal kind
  key. DOM geometry confirmed Literature, Quote, and Note were fully below the
  toolbar in the upper capture, and Note, Question, and Claim in the lower
  capture. Computed text sizes were `10px` for kind labels, `12px` for body
  copy, and `13px` for card and Frame titles, with no transform downscaling.
- The runtime captured no browser exceptions at either viewport.

Screenshots were visually inspected from `/tmp/bamboo-task9-wide.png`,
`/tmp/bamboo-task9-mobile.png`,
`/tmp/bamboo-task9-mobile-readable-upper.png`, and
`/tmp/bamboo-task9-mobile-readable-lower.png`. Together they show the responsive
toolbar, full-document overview, all six readable Chinese objects at interaction
zoom, the Frame behind its members, and the visible connection.

## Independent review

The first read-only review reported no Critical issues, one Important evidence
gap, and two Minor verification/test gaps:

- The mobile Fit View screenshot was incorrectly described as proving text
  readability. The report now separates unclipped overview evidence from the
  two real zoom-1/panned readability captures above; no extra product UI was
  introduced.
- Type-only imports in a `tsx` runtime test would be erased and were not covered
  by the existing `tsc` includes. They were replaced with
  `test/whiteboard-public-api.typecheck.ts`, a semantic consumer included by the
  root TypeScript configuration.
- The full gates were rerun after the menu ID, consumer fixture, and report
  corrections.

The final read-only re-review found no Critical, Important, or Minor issues and
assessed the cleanup as ready to merge.

## Verification

- Prescribed Prettier check — passed.
- Prescribed ESLint check — passed.
- `pnpm test:unit` — 423/423 passed.
- `pnpm whiteboard:build` — passed; TypeScript and Vite production build, 224
  modules transformed.
- `pnpm build` — passed; Zotero plugin production package and root TypeScript.
- `pnpm exec tsc --noEmit` — passed independently.
- `git diff --check` — passed.
- Generated `packages/whiteboard/dist` was moved out of the checkout after
  verification; it is absent from status and the final scope.
