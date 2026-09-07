import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { TopIsland } from "../packages/whiteboard/src/chrome/TopIsland.tsx";
import { createBuiltinNoteTemplates } from "../packages/whiteboard/src/model/note-template.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";

const labels = new Proxy({} as WhiteboardLabels, {
  get: (_target, property) => String(property),
});

function installDom(t: TestContext) {
  const window = new Window({ url: "https://example.test" });
  const previous = new Map<PropertyKey, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window,
    document: window.document,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    Event: window.Event,
    KeyboardEvent: window.KeyboardEvent,
    MouseEvent: window.MouseEvent,
    PointerEvent: window.PointerEvent,
    getComputedStyle: window.getComputedStyle.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    window.close();
  });
  return window;
}

function toolbarProps(
  onSelectNoteTemplate: (templateId: string) => void = () => {},
  onSelectTool: (tool: string) => void = () => {},
) {
  return {
    labels,
    activeTool: "select" as const,
    onSelectTool,
    noteTemplates: createBuiltinNoteTemplates({
      note: "Note",
      question: "Question",
      claim: "Claim",
    }),
    activeNoteTemplateId: "bamboo.note",
    onSelectNoteTemplate,
    saveState: "saved" as const,
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
  };
}

function menuItem(window: Window, name: string) {
  return Array.from(
    window.document.querySelectorAll<HTMLButtonElement>(
      '[role="menuitemradio"]',
    ),
  ).find((button) => button.textContent?.includes(name));
}

test("template menu selects a Note template and restores trigger focus", async (t) => {
  const window = installDom(t);
  const selected: string[] = [];
  const tools: string[] = [];
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(
        TopIsland,
        toolbarProps(
          (templateId) => selected.push(templateId),
          (tool) => tools.push(tool),
        ),
      ),
    ),
  );

  const trigger = window.document.querySelector<HTMLButtonElement>(
    ".zmd-board-template-trigger",
  );
  await act(async () => trigger?.click());
  assert.equal(trigger?.getAttribute("aria-expanded"), "true");
  assert.equal(menuItem(window, "Note")?.getAttribute("aria-checked"), "true");

  await act(async () => menuItem(window, "Question")?.click());
  assert.deepEqual(selected, ["bamboo.question"]);
  assert.deepEqual(tools, ["note"]);
  assert.equal(window.document.querySelector(".zmd-board-template-menu"), null);
  assert.equal(window.document.activeElement, trigger);
  await act(async () => root.unmount());
});

test("template menu closes on Escape, outside press, and More opening", async (t) => {
  const window = installDom(t);
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(createElement(TopIsland, toolbarProps())));
  const trigger = window.document.querySelector<HTMLButtonElement>(
    ".zmd-board-template-trigger",
  );
  const more = window.document.querySelector<HTMLButtonElement>(
    'button[title="more"]',
  );

  await act(async () => trigger?.click());
  await act(async () =>
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  assert.equal(window.document.querySelector(".zmd-board-template-menu"), null);
  assert.equal(window.document.activeElement, trigger);

  await act(async () => trigger?.click());
  await act(async () =>
    window.document.body.dispatchEvent(
      new window.PointerEvent("pointerdown", { bubbles: true }),
    ),
  );
  assert.equal(window.document.querySelector(".zmd-board-template-menu"), null);

  await act(async () => trigger?.click());
  await act(async () => more?.click());
  assert.equal(window.document.querySelector(".zmd-board-template-menu"), null);
  assert.ok(window.document.querySelector(".zmd-board-more-menu"));

  await act(async () => trigger?.click());
  assert.equal(window.document.querySelector(".zmd-board-more-menu"), null);
  assert.ok(window.document.querySelector(".zmd-board-template-menu"));
  await act(async () => root.unmount());
});
