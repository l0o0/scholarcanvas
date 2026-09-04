# Final fixes report

Baseline: `634aa8c89fca3e111849dd98b106b08bc8d284ae`

## Review verification and implementation

- Verified JSON Canvas 1.0 against the official specification and sample. Standard canvases have no required `version`; `nodes` and `edges` are optional; the four node types are `text`, `file`, `link`, and `group`. Bamboo-authored files retain their existing version, schema, array, and metadata validation.
- Added an unmodified standard-format fixture covering all four node types. Standard `file` nodes use canonical Basic `attachment` nodes and standard `link` nodes use canonical Basic `text` nodes. Their original identity is stored in the explicit, namespaced `node.extensions.bamboo.jsonCanvas` envelope. Encoding restores `file`/`link` only when both the canonical kind and a valid envelope agree, so future `data.file`/`data.url` fields and invalid markers cannot collide. `file`, `url`, `subpath`, common geometry/identity, and unknown fields round-trip.
- Made extension merging own-property safe with `Object.defineProperty`, own-only lookups, a deep own-field input clone, and a null-prototype drag payload accumulator. Root, node, and nested own `__proto__` keys survive round-trip without changing any object prototype; inherited Bamboo envelopes and inherited nested payload fields are ignored/rejected. The reserved canonical `extensions.bamboo` namespace must be an object at root, node, edge, and direct-encoding boundaries, preventing accepted-then-dropped values.
- Added deterministic SVG line wrapping based on each node's usable width, explicit-line handling, long-token splitting, positioned `<tspan>` rows, top/middle/bottom block placement, height-based line limiting, and numeric per-node clip paths. XML 1.0-forbidden controls are replaced safely, paint IDs are stable numeric IDs rather than input-derived identifiers, and existing shapes, arrows, styles, and PNG conversion remain covered.
- Academic source, quote, local-text, and Frame renderers now consume canonical typography, text color/opacity/alignment, vertical alignment, and supported fill/stroke/width/dash/radius styles. Library/text CardShell users also consume the surface style already exposed by the selection UI. Basic shapes share the same canonical fill/stroke resolution, including `fillStyle`, `strokeOpacity`, and explicit `strokeStyle` precedence over the legacy `dashed` flag. Unsupported fill/radius controls are hidden by node kind. Edit commit -> canvas save/reopen -> SVG export retains the same non-default style.

## Reverification follow-up

- Hardened the exported `parseCanvasDocument(unknown)` boundary itself. Before any field lookup, arrays and own enumerable object properties are recursively cloned while inherited values are removed at every depth. The validation copy uses null-prototype records; accepted extension JSON is copied back to ordinary own-property-safe objects with `Object.defineProperty`. Direct calls now reject inherited root fields, node geometry/content, Academic source/library/key fields, and connection fields. Sparse array slots are materialized as own `undefined`, preventing either a custom array prototype or global `Array.prototype[index]` from supplying data; the JSON Canvas codec applies the same rule. Own root, node, nested, and array-contained `__proto__` values remain data and cannot mutate a prototype.
- Kept `canvasNodeSurfaceDefaults` and `effectiveCanvasNodeTextStyle` as deterministic persistence/export defaults, and added separate theme-aware UI surface defaults plus a display-only text-style resolver. Omitted renderer/editor colors continue through CSS variables, while StyleBar and TextStyleBar resolve their active display values from the current light/dark palette. Merely rendering, editing, or opening controls does not persist `textColor`, `fill`, or `stroke`; explicit user selection still does.
- Routed the Ctrl/Cmd+B editing transition through the effective text style. Item, PDF, Attachment, Literature, and Frame therefore toggle from their implicit bold default to explicit normal on the first press, then back to bold on the second.

Official references:

- https://github.com/obsidianmd/jsoncanvas/blob/main/spec/1.0.md
- https://github.com/obsidianmd/jsoncanvas/blob/main/sample.canvas

## TDD evidence

- Baseline focused characterization: 61/61 passed.
- Codec RED: the official no-version fixture, optional arrays, and `__proto__` round-trip failed at the old mandatory-version gate. Later adversarial RED cases exposed stale file markers, mismatched Bamboo projections, inherited nested required fields, and a non-object reserved namespace. Codec GREEN includes official four-kind import/re-encode, malformed standard nodes, optional/malformed arrays, strict Bamboo validation, unknown fields, explicit-marker collision cases, current file/subpath authority, projection checks, and deep own-property safety.
- SVG RED: multiline/long-text structure tests failed because the export emitted one text node with no tspans or clipping. Later RED cases covered forbidden XML controls, colliding sanitized paint IDs, Frame defaults, and `strokeStyle` precedence. SVG GREEN covers deterministic wrapping, positioned tspans, vertical ordering, line limiting, clip geometry, XML/id safety, shapes, semantic edges, and PNG conversion.
- Renderer RED: new Academic and Frame SSR tests found no canonical surface/text styles. Follow-up RED cases covered reading-card defaults, partial Frame styles, non-positive font sizes, and Basic-shape stroke/fill/opacity parity. Renderer GREEN covers non-default and partial card/Frame output, actual CSS variable consumers, Basic shapes, vertical layout, UI control gating, validation, and edit/reopen/export consistency.
- Final focused set: 101/101 passed.
- Independent read-only review after the hardening pass found no remaining Critical or Important issues.
- Reverification parser RED: four direct-boundary cases accepted inherited root, geometry/content, Academic source/library/key, and connection fields. Follow-up adversarial RED cases showed sparse slots could still materialize values from custom and global array prototypes at both parser and codec entrances. GREEN: own-only normalization now covers records and every array index, including holes, while retaining the own `__proto__` deep round-trip invariant.
- Reverification dark-theme RED: Basic Text emitted inline `#111827`, `labelTextStyle({})` materialized a light color, and dark StyleBar/TextStyleBar did not expose active theme values. GREEN: the combined parser, renderer/control SSR, editor-style, and shortcut set passed 75/75.
- Reverification shortcut RED: the new transition behavior was unavailable and the app read raw persisted `fontWeight`. GREEN: the shared behavior is used by the actual key handler and all five implicit-bold kinds pass normal -> bold two-step assertions.
- Independent follow-up review found and closed two integration gaps before completion: light-mode Frame/rect/line control defaults now remain identical to their canonical DOM/export defaults, while only dark mode receives palette overrides; sparse array holes can no longer fall through to global `Array.prototype`. Its final read-only assessment reported no remaining Critical or Important issue.

## Browser verification

Chrome 152 was exercised through the real Vite application at two exact CDP viewports:

- `390 x 844`: PASS, exact `innerWidth`/`innerHeight`, no console/page errors, and no horizontal document overflow. The Academic note computed as a 4px dotted `#7c3aed` border, `#fef3c7` fill, 16px radius, and bottom-aligned Georgia 20px bold italic underlined right-aligned `#102030` text at 0.65 opacity. The Basic rectangle rendered a hatch fill and honored explicit solid `strokeStyle` over `dashed: true`.
- `1440 x 900`: PASS with the same computed styles and no overflow.
- At both sizes the generated SVG contained nine positioned tspans and four corresponding per-node clip paths. Browser PNG conversion produced a decoded 900 x 600 `data:image/png;base64,` result (99,354 characters). Visual inspection confirmed the wrapped Academic and Basic text remains inside its node in the live board, SVG preview, and PNG preview.
- Follow-up dark interaction, Chrome 152 at `1440 x 900`: PASS with no console/page errors or overflow. Unstyled Basic Text, Academic Note, and Frame computed to `rgb(232, 234, 237)` text, `rgb(26, 29, 36)` card fill, and `rgb(61, 68, 82)` card/Frame boundary; Frame remained transparent. On edit entry, textarea text/caret matched the dark text token, its fill stayed transparent over the card, and TextStyleBar showed the same color. Note StyleBar marked `#3d4452` stroke and `#1a1d24` fill active without writing either value to the snapshot. A real Ctrl+B sequence on the implicit-bold Frame produced `bold -> normal -> bold`, with only `fontWeight` persisted.
- Follow-up dark interaction, Chrome 152 at `390 x 844`: PASS with exact viewport dimensions, no overflow or browser errors, and matching dark renderer, textarea, caret, and TextStyleBar computed colors. Opening edit left the Basic Text node's canonical `style` omitted.

Evidence screenshots: `/tmp/bamboo-final-fixes-390.png`, `/tmp/bamboo-final-fixes-1440.png`, `/tmp/bamboo-dark-mobile.png`, and `/tmp/bamboo-dark-desktop.png`.

## Verification gates

- `pnpm exec tsx --test test/whiteboard-academic-document.test.ts test/whiteboard-canvas-file.test.ts test/whiteboard-export.test.ts test/whiteboard-node-registry.test.ts test/whiteboard-app-state.test.ts`: 101/101 passed.
- `pnpm test:unit`: 450/450 passed.
- `(cd packages/whiteboard && pnpm exec tsc --noEmit)`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm whiteboard:build`: passed (224 modules transformed).
- `pnpm build`: passed (plugin build plus root TypeScript).
- `pnpm lint:check`: passed (Prettier and ESLint).
- `git diff --check`: passed.
- Generated `packages/whiteboard/dist` output was moved outside the worktree after verification; no distribution artifacts are included.

Follow-up verification to the original review:

- `pnpm exec tsx --test test/whiteboard-academic-document.test.ts test/whiteboard-node-registry.test.ts test/whiteboard-app-state.test.ts`: 78/78 passed.
- `pnpm exec tsx --test test/whiteboard-academic-document.test.ts test/whiteboard-canvas-file.test.ts test/whiteboard-export.test.ts test/whiteboard-node-registry.test.ts test/whiteboard-app-state.test.ts`: 112/112 passed.
- `pnpm test:unit`: 461/461 passed.
- Whiteboard package and root `tsc --noEmit`: passed.
- `pnpm whiteboard:build`: passed (224 modules transformed).
- `pnpm build`: passed (plugin build plus root TypeScript).
- `pnpm lint:check` and `git diff --check`: passed.
- Chrome 152 dark-theme interaction smoke at `1440 x 900` and `390 x 844`: passed.
- The final generated `packages/whiteboard/dist` was moved to `/tmp/bamboo-whiteboard-final-build.kPeofO/dist`; no distribution artifact remains in the worktree.

## Shape-label color follow-up

- RED: Rect, Ellipse, Line, and Arrow labels with an explicit red stroke and omitted `textColor` inherited the stroke from their containing shape. The same RED also showed that Line and Arrow labels were absent from deterministic SVG export. The new behavior tests failed at the renderer/style helper and export boundaries before production changes.
- GREEN: `labelTextStyle` now supplies the display-only `var(--zmd-board-text, #111827)` fallback whenever `textColor` is omitted. Rect/Ellipse containers no longer set their text `color` from the border, and Line/Arrow apply `currentColor` only on their SVG element. The model remains unchanged until the user explicitly chooses a text color. Line/Arrow labels now use the same positioned, wrapped, clipped text export path as the other two Basic shapes, with deterministic export color `#111827`.
- SSR/behavior coverage exercises all four kinds with an explicit stroke in both light and dark control themes, checks the renderer container/label/SVG separation, compares the editor-effective style and TextStyleBar display value, and confirms `style.textColor` remains absent. Export coverage checks all four labels rather than a source-code pattern.
- The independent review caught one integration boundary before completion: the newly exported Line/Arrow labels initially reused the 12px vertical card padding, leaving only an 8px clip at their default 32px height and a zero-height clip at 24px. A second RED captured both actual geometries. The shared export layout now mirrors the DOM's stroke-label padding: 12px horizontally and zero vertically, for both wrapping/baselines and the clip rectangle; other node kinds retain 12px on both axes.
- Chrome 152 at `1440 x 900`: PASS in both light and dark themes. Rect/Ellipse borders and Line/Arrow SVG strokes computed to `rgb(220, 38, 38)`, while every label and shape parent computed to `rgb(17, 24, 39)` in light and `rgb(232, 234, 237)` in dark. Real edit entry on Rect and Ellipse produced matching textarea, caret, and TextStyleBar colors with transparent editor fill; the snapshot still omitted `textColor`. There was no overflow and no console or page error. Visual inspection also confirmed the four labels stayed readable independently of their red strokes.
- Evidence screenshots: `/tmp/bamboo-shape-colors-light.png` and `/tmp/bamboo-shape-colors-dark.png`.

Final shape-label verification:

- `pnpm exec tsx --test test/whiteboard-academic-document.test.ts test/whiteboard-canvas-file.test.ts test/whiteboard-export.test.ts test/whiteboard-node-registry.test.ts test/whiteboard-app-state.test.ts`: 119/119 passed.
- `pnpm test:unit`: 468/468 passed.
- Whiteboard package and root `tsc --noEmit`: passed.
- `pnpm whiteboard:build`: passed (224 modules transformed).
- `pnpm build`: passed (plugin build plus root TypeScript).
- `pnpm lint:check` and `git diff --check`: passed.
- The second independent read-only review reported 0 Critical, 0 Important, and 0 Minor issues after checking default/compact and top/middle/bottom Line/Arrow label geometry, unchanged card clipping, color inheritance, marker ordering, and non-persistence.
- The final generated `packages/whiteboard/dist` was moved to `/tmp/bamboo-shape-label-final-build.43eDGY/dist`; no distribution artifact remains in the worktree.

## Stroke-label alignment follow-up

- Verified the review finding in Chrome before changing production code. A 160px flex label with 12px horizontal padding placed the anonymous text item at an identical 12px offset for left, center, and right `text-align`; computed `justify-content` remained `normal`. The automated RED likewise failed for Line and Arrow at default, left, center, and right alignment.
- The first GREEN maps the effective/default horizontal alignment on the stroke-label flex container: left to `flex-start`, center or omission to `center`, and right to `flex-end`. The internal review then found a second concrete failure in the same anonymous flex item: a long unbroken title escaped the node horizontally, while `A\nB` collapsed to one line in the live canvas. The second automated RED failed for both Line and Arrow before production changed.
- The completed GREEN gives the label an intrinsic-width inner span, preserves explicit lines with `pre-wrap`, permits deterministic long-token wrapping with `overflow-wrap: anywhere`, and clips both the inner text and outer node boundary. Its maximum height uses the same complete-line capacity as SVG—`max(1, floor(height / (fontSize × 1.25))) × fontSize × 1.25`—so overflow retains the leading lines before top/middle/bottom placement. This closed two issues found by independent review: `max-height: 100%` made all three vertical alignments identical, while clipping only at the outer boundary made bottom alignment show the text tail although SVG retained the head. Persisted style, stroke/color behavior, and export geometry remain unchanged.
- Automated coverage checks both Line and Arrow across omission/left/center/right, their editor-effective style, the constrained multiline DOM contract, and deterministic SVG `x`/`text-anchor` output for both kinds across all three explicit alignments. It also characterizes SVG long-token and explicit-line clipping; existing default 32px and compact 24px SVG clip tests remain green.
- Chrome 152 at `1440 x 900`, light and dark: PASS. For six live Line/Arrow nodes, the measured text-range offset matched the expected padded left, mathematical center, or padded right position with a maximum error of 0.008px. Paired short-text top/middle/bottom bounds stayed within the 32px node height. A 160 × 32 long-token label wrapped to three native lines but capped its visible leading block to 20px; top/middle/bottom placed that block at `0/6/12px`, stayed inside the padded horizontal bounds, and kept its 60px scroll content clipped. A 160 × 32 bottom-aligned `A\nB` likewise retained two source lines but displayed only leading `A` in its 20px block at 12px, matching SVG line selection and placement. Label text retained the theme color, SVG strokes retained the explicit red, and `textColor` remained omitted. Entering edit on the right-aligned Line produced a right-aligned dark textarea; TextStyleBar marked its right-alignment control active. There was no ellipsis, document overflow, or console/page error.
- Evidence screenshots: `/tmp/bamboo-align-light.png` and `/tmp/bamboo-align-dark.png`.

Final stroke-label alignment verification:

- `pnpm exec tsx --test test/whiteboard-academic-document.test.ts test/whiteboard-canvas-file.test.ts test/whiteboard-export.test.ts test/whiteboard-node-registry.test.ts test/whiteboard-app-state.test.ts`: 133/133 passed.
- `pnpm test:unit`: 482/482 passed.
- Whiteboard package and root `tsc --noEmit`: passed.
- `pnpm whiteboard:build`: passed (224 modules transformed).
- `pnpm build`: passed (plugin build plus root TypeScript).
- `pnpm lint:check` and `git diff --check`: passed.
- The final independent read-only review reported 0 Critical, 0 Important, and 0 Minor issues after checking horizontal and vertical geometry, complete-line overflow capacity, leading-line selection, 24/32px clipping, theme/stroke separation, editing, controls, and model non-persistence.
- The final generated `packages/whiteboard/dist` was moved to `/tmp/bamboo-stroke-align-final-build.IpHTAJ/dist`; no distribution artifact remains in the worktree.

## Academic source lifecycle follow-up

Baseline: `eaf193052bc35bb151c214c105580cc44fd109c0`

- Replaced every colon-concatenated Academic source identity with a tagged JSON
  tuple. Literature, Note, Quote, attachment grouping, scheduler cache keys,
  resolution guards, and annotation deduplication now use the same structural
  identity helpers. Parser-valid keys containing delimiters cannot collide,
  while genuinely identical descriptors still coalesce.
- Note resolution now validates the current Zotero parent chain but returns the
  exact requested source descriptor. A Note acquired while standalone therefore
  remains resolvable and refreshable after it gains a regular parent; a persisted
  child descriptor still rejects a changed parent. Defensive reply mismatches and
  refresh failures now produce the localized canvas failure notice instead of a
  silent no-op.
- Literature and Quote source-owned snapshot changes are rebased across both
  undo and redo documents without creating history entries. Background changes
  remain non-dirty; an explicit multi-node refresh dirties once when at least one
  accepted snapshot changed. Geometry history stays independent, and confirmed
  Note content refresh retains its existing historical/undoable path.
- Ordinary Literature resolution preserves a persisted `annotationCount` when
  the gateway response omits it. An accepted annotation-list response updates
  only its originating Literature placement to the number of valid candidates,
  including partial responses. Rejected or stale terminal replies do not update
  it. Count updates are non-history and non-dirty but are rebased through both
  history directions so a later save, undo, or redo keeps the newest count.
- Empty Zotero Notes now persist exact empty content; the renderer supplies a
  localized display-only empty state. Retired v1 picker/drop protocol arms and
  their unused parser/merge helpers were removed while the canonical Basic node
  models remain. Architecture wording now limits the no-local-ID guarantee to
  Academic descriptors/protocol payloads, and source-backed context menus use
  the localized **Open source** label.

### Academic source TDD evidence

- Identity RED: two parser-valid Quote descriptors (`PARENT` + `PDF:SECTION`
  versus `PARENT:PDF` + `SECTION`) produced the same old cache key, causing one
  scheduler run and allowing `applyResolvedAcquisition` to update the wrong
  node. GREEN: the scheduler runs each distinct source once, fans out only an
  identical third placement, and the acquisition guard leaves the colliding
  node untouched. A corresponding group-Note delimiter case is also distinct.
- Note RED: a key-only Note that had since gained a parent was returned with a
  parent-enriched identity, so both background resolution and confirmed refresh
  were rejected; the runtime error binding was a no-op. GREEN: gateway-to-runtime
  tests preserve local content during background resolution, overwrite only on
  confirmed refresh, reject a changed persisted parent, and surface the node's
  localized failure notice on a defensive mismatch.
- History RED: source refresh changed only the live document; undo and an
  already-populated redo stack restored stale Literature/Quote snapshots, and a
  multi-result explicit refresh incremented dirty revision once per node. GREEN:
  real `CanvasDocumentHistory` runtime tests cover edit -> background refresh ->
  undo/redo, refresh while the redo stack exists, multiple nodes, explicit
  refresh, geometry preservation, one dirty revision, and unchanged Note refresh
  semantics.
- Annotation-count RED: ordinary Literature resolution erased an existing count,
  and accepted annotation listings had no non-history count update path. GREEN:
  gateway/browser/runtime coverage preserves omitted counts, records all valid
  candidates on success or partial success, ignores rejection, updates only the
  originating placement, and retains the count through undo/redo without a dirty
  revision.
- Minor RED/GREEN covers exact empty Note persistence plus localized SSR display,
  exhaustive v2 protocol unions with no retired arms, narrowed architecture
  wording, and source-aware context-menu copy.

### Academic source verification

- Focused merged behavior suite: 236/236 passed.
- `pnpm test:unit`: 598/598 passed.
- `pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit`: passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm whiteboard:build`: passed (228 modules transformed).
- `pnpm build`: passed (plugin build plus root TypeScript).
- `pnpm lint:check` and `git diff --check`: passed.
- The generated `packages/whiteboard/dist` directory was removed after build
  verification; no distribution artifact is included. Per the task boundary, no
  real Zotero instance was run; the parent controller owns the targeted smoke.

## Background Note history overlay follow-up

- Review verification found that live background Note resolution already used
  the safe Note branch of `applyResolvedAcquisitionToCanvasNode`, which updates
  only `sourceSnapshot` and deliberately ignores acquisition `content`. The
  history overlay nevertheless excluded Note results in two separate filters,
  so undo restored a stale source title.
- RED: after a geometry edit and background title update, the new real runtime /
  `CanvasDocumentHistory` test observed `Old target title` after undo instead of
  `Current target title`.
- GREEN: all accepted resolved acquisitions now pass through the same
  source-identity-guarded history overlay. Undo restores the old geometry while
  retaining the current Note title and local content. A second title update while
  the redo stack exists is retained by redo. Another Note receiving a result with
  a mismatched source remains unchanged in live, undo, and redo documents, and
  neither remote body is copied into canonical content.
- Confirmed Note refresh remains on its separate historical path: its existing
  behavior test still verifies one dirty revision, remote-content replacement,
  and undo restoration of the prior local content.

Verification:

- Focused Note/source/history suite: 97/97 passed.
- `pnpm test:unit`: 599/599 passed.
- Whiteboard package and root `tsc --noEmit`: passed.
- `pnpm lint:check` and `git diff --check`: passed.
