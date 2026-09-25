import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { EdgeStyleBar } from "../packages/whiteboard/src/chrome/EdgeStyleBar.tsx";
import type { CanvasFlowEdge } from "../packages/whiteboard/src/whiteboard/document.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";

const labels = new Proxy({} as WhiteboardLabels, {
  get: (_target, property) => String(property),
});

function installDom(t: TestContext) {
  const window = new Window({ url: "https://example.test" });
  const previous = new Map<PropertyKey, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window,
    self: window,
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

function edge(): CanvasFlowEdge {
  return {
    id: "edge-1",
    source: "a",
    target: "b",
    data: { connection: {} as never },
    style: { stroke: "#123456", strokeDasharray: "6 4" },
    markerEnd: { type: "arrowclosed", width: 16, height: 16 },
    markerStart: { type: "arrowclosed", width: 16, height: 16 },
  };
}

test("edge style bar exposes current line and arrow state and edits it", async (t) => {
  const window = installDom(t);
  const changes: unknown[] = [];
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(EdgeStyleBar, {
        edge: edge(),
        labels,
        theme: "light",
        anchor: { x: 240, y: 180, width: 0, height: 0 },
        onChange: (patch) => changes.push(patch),
        onEdit: () => {},
      }),
    ),
  );

  const bar = window.document.querySelector<HTMLElement>(
    ".zmd-board-style-bar.is-edge",
  );
  assert.ok(bar);
  assert.equal(bar.getAttribute("role"), "toolbar");
  assert.equal(bar.getAttribute("aria-label"), "edgeSelection");
  assert.equal(bar.textContent?.trim(), "", "collapsed toolbar is icon-only");
  for (const button of bar.querySelectorAll("button")) {
    assert.ok(button.title, "every icon has a hover hint");
    assert.ok(button.getAttribute("aria-label"));
  }
  const style = bar.querySelector<HTMLButtonElement>(
    'button[aria-label="edgeStyle"]',
  )!;
  const arrows = bar.querySelector<HTMLButtonElement>(
    'button[aria-label="edgeArrows"]',
  )!;
  await act(async () => style.click());
  assert.equal(
    bar.querySelector('[aria-label="dashed"]')?.getAttribute("aria-pressed"),
    "true",
  );
  await act(async () =>
    bar.querySelector<HTMLButtonElement>('[aria-label="solid"]')!.click(),
  );
  assert.equal(window.document.activeElement, style);
  await act(async () => arrows.click());
  assert.equal(
    bar.querySelector('[aria-label="arrowBoth"]')?.getAttribute("aria-pressed"),
    "true",
  );
  await act(async () =>
    bar
      .querySelector<HTMLButtonElement>('[aria-label="arrowReverse"]')!
      .click(),
  );
  assert.deepEqual(changes, [
    { dashed: false },
    { arrow: false, startArrow: true },
  ]);

  const color = bar.querySelector<HTMLButtonElement>(
    '[data-color-target="color"]',
  )!;
  await act(async () => color.click());
  assert.ok(window.document.querySelector(".zmd-board-color-picker"));
  await act(async () =>
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  assert.equal(window.document.querySelector(".zmd-board-color-picker"), null);
  assert.equal(window.document.activeElement, color);
  await act(async () => root.unmount());
});

test("floating edge toolbar avoids the main toolbar even when the edge is above the viewport", async (t) => {
  const window = installDom(t);
  const container = window.document.createElement("div");
  const island = window.document.createElement("div");
  island.className = "zmd-board-top-island";
  container.append(island);
  window.document.body.append(container);
  const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains("zmd-board-top-island"))
      return new window.DOMRect(100, 16, 600, 46);
    if (this.classList.contains("zmd-board-style-bar"))
      return new window.DOMRect(0, 0, 420, 40);
    return new window.DOMRect(0, 0, 1024, 768);
  };
  const mount = window.document.createElement("div");
  container.append(mount);
  const root = createRoot(mount);
  try {
    for (const y of [80, -100]) {
      await act(async () =>
        root.render(
          createElement(EdgeStyleBar, {
            edge: edge(),
            labels,
            theme: "light",
            anchor: { x: 400, y, width: 0, height: 0 },
            onChange: () => {},
            onEdit: () => {},
          }),
        ),
      );
      const bar = mount.querySelector<HTMLElement>(".is-edge")!;
      assert.ok(parseFloat(bar.style.top) >= 62 + 8);
      assert.ok(parseFloat(bar.style.top) + 40 <= window.innerHeight - 8);
    }
  } finally {
    await act(async () => root.unmount());
    window.HTMLElement.prototype.getBoundingClientRect = originalRect;
  }
});
