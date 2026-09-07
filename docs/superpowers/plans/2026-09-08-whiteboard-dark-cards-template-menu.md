# Whiteboard Dark Cards and Template Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated tutorial sample cards theme-native and replace the visually inconsistent native Note-template select with a compact accessible toolbar menu.

**Architecture:** Keep card theming data-driven by deleting fixed light fill/text values from the tutorial's sample style. Keep template state in `TopIsland`, but render the existing template list as one mutually exclusive anchored menu using existing toolbar and More-menu conventions.

**Tech Stack:** TypeScript, React 19, CSS custom properties, Node test runner with `tsx`, happy-dom.

## Global Constraints

- Do not change the Canvas schema or persisted template records.
- Do not reinterpret explicit colors chosen by users.
- Do not migrate existing generated tutorial files.
- Add no dependency or general menu framework.
- Preserve pointer and keyboard access in light and dark themes.

---

### Task 1: Theme-native tutorial sample cards

**Files:**

- Modify: `test/whiteboard-tutorial-document.test.ts`
- Modify: `packages/whiteboard/src/model/tutorial.ts`

**Interfaces:**

- Consumes: `tutorialCanvasDocument(labels, sample)`.
- Produces: the same canonical document, with sample styles that retain `stroke`, `strokeWidth`, and `radius` but omit `fill` and `textColor`.

- [ ] **Step 1: Write the failing sample-style assertion**

In the enriched tutorial test, inspect every source-backed sample node:

```ts
for (const node of document.nodes.filter((value) => "source" in value)) {
  assert.equal(node.style?.fill, undefined);
  assert.equal(node.style?.textColor, undefined);
  assert.equal(node.style?.stroke, "#60a5fa");
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec tsx --test test/whiteboard-tutorial-document.test.ts
```

Expected: FAIL because `sampleStyle` persists `fill: "#eff6ff"` and `textColor: "#172554"`.

- [ ] **Step 3: Remove only the fixed sample fill and text color**

Keep the sample style as:

```ts
const sampleStyle = {
  stroke: "#60a5fa",
  strokeWidth: 2,
  radius: 12,
} as const;
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: all tutorial document tests pass.

### Task 2: Theme-aware Note-template menu

**Files:**

- Modify: `packages/whiteboard/src/chrome/TopIsland.tsx`
- Modify: `packages/whiteboard/src/whiteboard/icons.tsx`
- Modify: `packages/whiteboard/src/whiteboard/board.css`
- Modify: `test/whiteboard-toolbar.test.ts`
- Create: `test/whiteboard-toolbar-dom.test.ts`

**Interfaces:**

- Consumes: the existing `noteTemplates`, `activeNoteTemplateId`, `onSelectNoteTemplate`, and `onSelectTool` props.
- Produces: no new public prop or model API; only accessible toolbar/menu markup and interaction.

- [ ] **Step 1: Write failing markup and CSS tests**

Assert rendered toolbar markup contains a template trigger and menu semantics, but no native select:

```ts
assert.doesNotMatch(markup, /<select/);
assert.match(markup, /zmd-board-template-trigger/);
assert.match(markup, /aria-haspopup="menu"/);
```

Assert the CSS removes form-control styling and gives the trigger/menu theme-variable surfaces, visible focus, compact rows, and a current-item state.

- [ ] **Step 2: Write failing DOM interaction tests**

Mount `TopIsland` with happy-dom and verify:

- clicking the trigger opens the menu;
- the active template row has `aria-checked="true"`;
- choosing Question calls `onSelectNoteTemplate("bamboo.question")`, calls `onSelectTool("note")`, closes the menu, and restores trigger focus;
- Escape and outside pointerdown close the menu;
- opening More closes Templates and opening Templates closes More.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --test test/whiteboard-toolbar.test.ts test/whiteboard-toolbar-dom.test.ts
```

Expected: FAIL because the native select remains and the custom menu does not exist.

- [ ] **Step 4: Implement one mutually exclusive menu state**

Use:

```ts
const [openMenu, setOpenMenu] = useState<"templates" | "more" | null>(null);
```

Use the top island as the outside-click boundary. Render a labelled trigger with the active template name and a small chevron, followed by an anchored `role="menu"` containing `role="menuitemradio"` buttons. Close on selection, Escape, or outside pointerdown; focus the trigger after selection.

- [ ] **Step 5: Reuse the existing menu visual vocabulary**

Style the trigger as a compact toolbar action without a resting form border. Style the popup and rows with `--zmd-board-surface`, `--zmd-board-border`, `--zmd-board-hover`, `--zmd-board-text`, `--zmd-board-muted`, and `--zmd-board-accent-soft`. Add no literal light-only surface.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: all toolbar tests pass.

- [ ] **Step 7: Run the complete verification gate**

```bash
pnpm exec tsx --test test/whiteboard-*.test.ts
pnpm exec tsc --noEmit
pnpm lint:check
pnpm build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 8: Commit implementation**

```bash
git add packages/whiteboard/src/model/tutorial.ts packages/whiteboard/src/chrome/TopIsland.tsx packages/whiteboard/src/whiteboard/icons.tsx packages/whiteboard/src/whiteboard/board.css test/whiteboard-tutorial-document.test.ts test/whiteboard-toolbar.test.ts test/whiteboard-toolbar-dom.test.ts
git commit -m "fix(whiteboard): align tutorial cards and template menu"
```
