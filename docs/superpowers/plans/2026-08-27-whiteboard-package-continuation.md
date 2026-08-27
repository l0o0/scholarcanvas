# Whiteboard Package Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the in-progress standalone whiteboard package migration and keep every toolbar command reachable in narrow Zotero tabs.

**Architecture:** `packages/whiteboard` owns the React canvas, protocol, snapshot model, nodes, chrome, and standalone Vite entry. The Zotero plugin keeps thin compatibility re-exports under `src/whiteboard` and `src/modules/whiteboard`, while its esbuild entry points directly at the package bootstrap. Responsive toolbar behavior stays in the package stylesheet and is protected by a focused source-level CSS contract plus browser geometry checks.

**Tech Stack:** TypeScript 6, React 19, `@xyflow/react` 12, Vite 5, Node test runner through `tsx`, Zotero Plugin Scaffold.

**Spec:** `docs/superpowers/specs/2026-08-15-xyflow-board-design.md`

## Global Constraints

- Keep `@xyflow/react` as the MIT canvas engine and preserve the `whiteboard` Zotero tab type.
- Preserve `.board` document version `1`, engine `xyflow`, and legacy `.zmdboard` opening support.
- Keep Zotero APIs outside `packages/whiteboard`; communication crosses the versioned `postMessage` protocol.
- Preserve the current dirty worktree changes and avoid unrelated refactors.
- Every behavioral change follows red-green-refactor and must pass both standalone and plugin builds.

---

### Task 1: Validate the Package Boundary

**Files:**

- Verify: `packages/whiteboard/package.json`
- Verify: `packages/whiteboard/src/model/protocol.ts`
- Verify: `packages/whiteboard/src/model/snapshot.ts`
- Verify: `src/modules/whiteboard/protocol.ts`
- Verify: `src/modules/whiteboard/snapshot.ts`
- Verify: `src/whiteboard/*.tsx`
- Verify: `zotero-plugin.config.ts`

**Interfaces:**

- Consumes: `WhiteboardSnapshot`, `WhiteboardLabels`, and `ParentToWhiteboardMessage` from `packages/whiteboard/src/model`.
- Produces: unchanged host import paths and the plugin whiteboard bundle at `addon/content/whiteboard/whiteboard.js`.

- [x] **Step 1: Install the two-project pnpm workspace**

Run: `pnpm install`

Expected: pnpm reports two workspace projects and an up-to-date lockfile.

- [x] **Step 2: Run unit and type checks against the extracted sources**

Run: `pnpm test:unit && pnpm exec tsc --noEmit`

Expected: 109 tests pass and TypeScript exits with status 0.

- [x] **Step 3: Build both delivery targets**

Run: `pnpm whiteboard:build && pnpm build`

Expected: Vite emits the standalone app and Zotero Plugin Scaffold completes the plugin build.

### Task 2: Keep the Toolbar Reachable in Narrow Tabs

**Files:**

- Create: `test/whiteboard-toolbar.test.ts`
- Modify: `packages/whiteboard/src/whiteboard/board.css`
- Modify: `package.json`

**Interfaces:**

- Consumes: `.zmd-board-top-island`, `.zmd-board-top-group`, `.zmd-board-toolbar-sep`, and `.zmd-board-save-state` from `TopIsland.tsx`.
- Produces: a `@media (max-width: 640px)` layout where the toolbar stays within the viewport and wraps complete control groups onto additional rows.

- [x] **Step 1: Write the failing responsive CSS contract**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(
  new URL("../packages/whiteboard/src/whiteboard/board.css", import.meta.url),
  "utf8",
);

test("narrow whiteboard tabs wrap the complete top toolbar inside the viewport", () => {
  const compact = css.match(/@media \(max-width: 640px\) \{([\s\S]+)\}\s*$/)?.[1];
  assert.ok(compact, "missing narrow-toolbar media query");
  assert.match(compact, /\.zmd-board-top-island\s*\{[^}]*width:\s*calc\(100% - 16px\)/s);
  assert.match(compact, /\.zmd-board-top-island\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(compact, /\.zmd-board-top-group\s*\{[^}]*flex:\s*0 0 auto/s);
}
```

- [x] **Step 2: Run the focused test and verify red**

Run: `pnpm exec tsx --test test/whiteboard-toolbar.test.ts`

Expected: FAIL with `missing narrow-toolbar media query`.

- [x] **Step 3: Implement the compact wrapped layout**

Append this responsive rule to `board.css`:

```css
@media (max-width: 640px) {
  .zmd-board-top-island {
    top: 8px;
    width: calc(100% - 16px);
    max-width: none;
    flex-wrap: wrap;
    justify-content: center;
  }

  .zmd-board-top-group {
    flex: 0 0 auto;
  }

  .zmd-board-top-group + .zmd-board-top-group {
    margin-left: 0;
  }

  .zmd-board-save-state {
    padding: 0 4px;
  }
}
```

- [x] **Step 4: Add the test to the unit suite and verify green**

Add `test/whiteboard-toolbar.test.ts` to `test:unit`, then run:

`pnpm exec tsx --test test/whiteboard-toolbar.test.ts && pnpm test:unit`

Expected: the focused test and full unit suite pass.

### Task 3: Verify the Finished Whiteboard

**Files:**

- Verify: all modified and untracked whiteboard files
- Update: this plan's checkbox status

**Interfaces:**

- Consumes: the package app at `http://127.0.0.1:5173/` and Zotero bundle configuration.
- Produces: test, build, lint, and visual evidence suitable for branch handoff.

- [x] **Step 1: Run formatting and lint checks**

Run: `pnpm exec prettier --check packages/whiteboard src/whiteboard src/modules/whiteboard test/whiteboard-*.test.ts docs/superpowers/plans/2026-08-27-whiteboard-package-continuation.md && pnpm exec eslint packages/whiteboard/src src/whiteboard src/modules/whiteboard test/whiteboard-*.test.ts`

Expected before the fix: Prettier reports 13 migrated files and ESLint reports
three `no-useless-assignment` errors for the initial `r`, `g`, and `b` values
in `hsvToHex`.

- [x] **Step 2: Remove the useless RGB initialization and format the migration**

Replace the mutable initialization and branch assignments in
`packages/whiteboard/src/chrome/color.ts` with a single exhaustive tuple:

```ts
const [r, g, b] =
  hue < 60
    ? [c, x, 0]
    : hue < 120
      ? [x, c, 0]
      : hue < 180
        ? [0, c, x]
        : hue < 240
          ? [0, x, c]
          : hue < 300
            ? [x, 0, c]
            : [c, 0, x];
```

Run: `pnpm exec prettier --write packages/whiteboard src/whiteboard src/modules/whiteboard test/whiteboard-*.test.ts docs/superpowers/plans/2026-08-27-whiteboard-package-continuation.md`

Then run the Step 1 checks again.

Expected after the fix: both commands exit with status 0.

- [x] **Step 3: Run all tests and both builds from fresh command invocations**

Run: `pnpm test:unit && pnpm whiteboard:build && pnpm build && pnpm exec tsc --noEmit`

Expected: all commands exit with status 0 and the unit count includes the new toolbar test.

- [x] **Step 4: Verify desktop and narrow browser geometry**

Run: `pnpm whiteboard:dev -- --host 127.0.0.1`, then inspect `http://127.0.0.1:5173/` at `900x840` and `390x844`.

Expected: the canvas is nonblank; at both widths every toolbar button is inside the viewport; at `390x844` the toolbar wraps without horizontal clipping; zoom controls and cards do not overlap the toolbar incoherently.

- [x] **Step 5: Check the final diff for scope and generated output**

Run: `git status --short && git diff --check && git diff --stat`

Expected: no whitespace errors, `packages/whiteboard/dist` remains ignored, and changes are limited to the whiteboard package migration, its compatibility shims, tests, workspace configuration, and this plan.
