# Final fixes report

Baseline: `634aa8c89fca3e111849dd98b106b08bc8d284ae`

## Review verification and implementation

- Verified JSON Canvas 1.0 against the official specification and sample. Standard canvases have no required `version`; `nodes` and `edges` are optional; the four node types are `text`, `file`, `link`, and `group`. Bamboo-authored files retain their existing version, schema, array, and metadata validation.
- Added an unmodified standard-format fixture covering all four node types. Standard `file` nodes use canonical Basic `attachment` nodes and standard `link` nodes use canonical Basic `text` nodes. Their original identity is stored in the explicit, namespaced `node.extensions.bamboo.jsonCanvas` envelope. Encoding restores `file`/`link` only when both the canonical kind and a valid envelope agree, so future `data.file`/`data.url` fields and invalid markers cannot collide. `file`, `url`, `subpath`, common geometry/identity, and unknown fields round-trip.
- Made extension merging own-property safe with `Object.defineProperty`, own-only lookups, a deep own-field input clone, and a null-prototype drag payload accumulator. Root, node, and nested own `__proto__` keys survive round-trip without changing any object prototype; inherited Bamboo envelopes and inherited nested payload fields are ignored/rejected. The reserved canonical `extensions.bamboo` namespace must be an object at root, node, edge, and direct-encoding boundaries, preventing accepted-then-dropped values.
- Added deterministic SVG line wrapping based on each node's usable width, explicit-line handling, long-token splitting, positioned `<tspan>` rows, top/middle/bottom block placement, height-based line limiting, and numeric per-node clip paths. XML 1.0-forbidden controls are replaced safely, paint IDs are stable numeric IDs rather than input-derived identifiers, and existing shapes, arrows, styles, and PNG conversion remain covered.
- Academic source, quote, local-text, and Frame renderers now consume canonical typography, text color/opacity/alignment, vertical alignment, and supported fill/stroke/width/dash/radius styles. Library/text CardShell users also consume the surface style already exposed by the selection UI. Basic shapes share the same canonical fill/stroke resolution, including `fillStyle`, `strokeOpacity`, and explicit `strokeStyle` precedence over the legacy `dashed` flag. Unsupported fill/radius controls are hidden by node kind. Edit commit -> canvas save/reopen -> SVG export retains the same non-default style.

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

## Browser verification

Chrome 152 was exercised through the real Vite application at two exact CDP viewports:

- `390 x 844`: PASS, exact `innerWidth`/`innerHeight`, no console/page errors, and no horizontal document overflow. The Academic note computed as a 4px dotted `#7c3aed` border, `#fef3c7` fill, 16px radius, and bottom-aligned Georgia 20px bold italic underlined right-aligned `#102030` text at 0.65 opacity. The Basic rectangle rendered a hatch fill and honored explicit solid `strokeStyle` over `dashed: true`.
- `1440 x 900`: PASS with the same computed styles and no overflow.
- At both sizes the generated SVG contained nine positioned tspans and four corresponding per-node clip paths. Browser PNG conversion produced a decoded 900 x 600 `data:image/png;base64,` result (99,354 characters). Visual inspection confirmed the wrapped Academic and Basic text remains inside its node in the live board, SVG preview, and PNG preview.

Evidence screenshots: `/tmp/bamboo-final-fixes-390.png` and `/tmp/bamboo-final-fixes-1440.png`.

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
