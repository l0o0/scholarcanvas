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
