# Task 8 Report: Academic Canvas Export

## Scope

- Replaced the legacy export fixture with a schema-v2 `CanvasDocument` fixture
  containing all six Academic node kinds, retained Basic shapes, Basic
  Connections, and Academic Connections.
- Renamed the public builders to `buildCanvasSvg()` and
  `buildCanvasMarkdown()` and updated both the package app and root re-export.
- Kept `svgToPngDataUrl()` and `containGeometry()` behavior unchanged.

## TDD evidence

### RED

Command:

```text
pnpm exec tsx --test test/whiteboard-export.test.ts
```

The new test module failed with exit code 1 because
`buildCanvasMarkdown` was not exported by the old implementation. This was the
expected API-cutover failure.

During GREEN review, a new layering assertion was added for Frame export. It
failed with exit code 1 because connections were emitted before the Frame, so a
filled Frame could cover them. The SVG order was then corrected.

### GREEN

The focused export command passes 5/5 tests after implementation. Coverage
includes every canonical node kind, both connection kinds, Academic relation
metadata, Frame layering, XML escaping, multiline content, shape and endpoint
geometry, text and edge styles, aspect-ratio containment, and the browser PNG
conversion path.

## Export format conventions

### SVG

- Uses canonical absolute `position`, `width`, `height`, `style`, and line
  endpoint data.
- Paint order is background, Frames, connections, then ordinary nodes.
- Only Academic Connections receive a `data-relation` attribute.
- Text and attribute values continue through XML escaping. Node Markdown is
  exported as text and is not rendered to HTML.

### Markdown

- Starts with `# Academic Canvas`.
- Academic objects use fixed kind order: Literature, Quote, Note, Question,
  Claim, then Frame. Objects within a kind sort by readable text and ID.
- Each Academic object starts with `## <Kind>: <single-line summary>`; Quote
  text is also emitted as a Markdown block quote, and multiline local content
  is preserved verbatim.
- Basic objects sort by kind, readable text, and ID under the final object
  category `## Other objects`.
- `## Relationships` uses the exact Academic `relation`; Basic Connections use
  their label or `connects`. Endpoint text is whitespace-normalized for a
  readable one-line relationship.
- Duplicate endpoint text gains `[node-id]` disambiguation. Missing endpoints
  use `[missing: node-id]` rather than disappearing.
- Sorting uses code-point comparison, so output does not depend on the input
  node or connection array order or the process locale.

## Verification

- `pnpm exec tsx --test test/whiteboard-export.test.ts` — 5/5 passed.
- `pnpm exec tsx --test test/whiteboard-export.test.ts test/whiteboard-app-state.test.ts` — 30/30 passed.
- `pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit` — passed.
- `pnpm exec tsc --noEmit` — passed after updating the root export facade.
- `pnpm exec tsx --test test/whiteboard-*.test.ts` — 146/146 passed.
- `pnpm lint:check` — Prettier and ESLint passed for the repository.
- `git diff --check` — passed.
- Independent code review — no Critical, Important, or Minor findings;
  approved.
