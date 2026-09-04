import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TopIsland } from "../packages/whiteboard/src/chrome/TopIsland.tsx";
import { libraryTools } from "../packages/whiteboard/src/chrome/tools.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";

const css = readFileSync(
  new URL("../packages/whiteboard/src/whiteboard/board.css", import.meta.url),
  "utf8",
);

const labels = new Proxy({} as WhiteboardLabels, {
  get: (_target, property) => String(property),
});

function renderToolbar(selectedNodeCount: number, selectedEdgeCount: number) {
  return renderToStaticMarkup(
    createElement(TopIsland, {
      labels,
      activeTool: "select",
      onSelectTool: () => {},
      saveState: "saved",
      selectedNodeCount,
      selectedEdgeCount,
      onUndo: () => {},
      onRedo: () => {},
      onSave: () => {},
      onFitView: () => {},
      onAutoLayout: () => {},
      onAlign: () => {},
      onDistribute: () => {},
      onEdgeColor: () => {},
      onEdgeDash: () => {},
      onEdgeArrow: () => {},
      onOpenShortcuts: () => {},
    }),
  );
}

function commandGroup(markup: string, command: string) {
  return markup
    .match(/<div class="zmd-board-top-group">[\s\S]*?<\/div>/g)
    ?.find((group) => group.includes(`title="${command}"`));
}

test("toolbar keeps conditional command sets together and wraps when constrained", () => {
  const base = css.match(/\.zmd-board-top-island\s*\{([^}]*)\}/)?.[1];
  assert.ok(base, "missing base toolbar rule");
  assert.match(base, /flex-wrap:\s*wrap/);

  const compact = css.match(
    /@media \(max-width: 640px\) \{([\s\S]+)\}\s*$/,
  )?.[1];
  assert.ok(compact, "missing narrow-toolbar media query");
  assert.match(
    compact,
    /\.zmd-board-top-island\s*\{[^}]*width:\s*calc\(100% - 16px\)/s,
  );
  assert.match(compact, /\.zmd-board-top-island\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(compact, /\.zmd-board-top-group\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(compact, /\.zmd-board-properties\s*\{[^}]*top:\s*138px/s);
  assert.match(
    compact,
    /\.zmd-board-properties\s*\{[^}]*left:\s*8px[^}]*right:\s*8px/s,
  );
  assert.match(
    compact,
    /\.zmd-board-properties\s*\{[^}]*width:\s*auto[^}]*max-height:\s*calc\(100% - 146px\)[^}]*overflow-y:\s*auto/s,
  );

  const nodeGroup = commandGroup(renderToolbar(3, 0), "alignLeft");
  assert.ok(nodeGroup, "selected-node controls need one toolbar group");
  for (const title of [
    "alignRight",
    "alignTop",
    "alignBottom",
    "alignHorizontal",
    "alignVertical",
    "distributeHorizontal",
    "distributeVertical",
  ]) {
    assert.match(nodeGroup, new RegExp(`title="${title}"`));
  }

  const edgeGroup = commandGroup(renderToolbar(0, 1), "edgeColor");
  assert.ok(edgeGroup, "selected-edge controls need one toolbar group");
  for (const title of ["edgeDash", "edgeArrow"]) {
    assert.match(edgeGroup, new RegExp(`title="${title}"`));
  }
});

test("toolbar exposes one local academic creation group only", () => {
  const markup = renderToolbar(0, 0);
  const academicGroup = commandGroup(markup, "addNote");
  assert.ok(academicGroup, "local academic tools need one toolbar group");
  for (const title of ["addQuestion (Q)", "addClaim (C)", "addFrame (F)"]) {
    assert.ok(academicGroup.includes(`title="${title}"`));
  }
  assert.doesNotMatch(markup, /kindLiterature|kindQuote/);
});

test("toolbar exposes Literature as its only library acquisition tool", () => {
  const renderedToolbar = renderToStaticMarkup(
    createElement(TopIsland, {
      ...{
        labels: new Proxy({} as WhiteboardLabels, {
          get: (_target, property) =>
            property === "addItem"
              ? "Add literature"
              : property === "addPdf"
                ? "Add PDF"
                : property === "addFile"
                  ? "Add file"
                  : String(property),
        }),
      },
      activeTool: "select",
      onSelectTool: () => {},
      saveState: "saved",
      selectedNodeCount: 0,
      selectedEdgeCount: 0,
      onUndo: () => {},
      onRedo: () => {},
      onSave: () => {},
      onFitView: () => {},
      onAutoLayout: () => {},
      onAlign: () => {},
      onDistribute: () => {},
      onEdgeColor: () => {},
      onEdgeDash: () => {},
      onEdgeArrow: () => {},
      onOpenShortcuts: () => {},
    }),
  );
  assert.deepEqual(libraryTools(), ["literature"]);
  assert.match(renderedToolbar, /Add literature/);
  assert.doesNotMatch(renderedToolbar, /Add PDF|Add file/);
});
