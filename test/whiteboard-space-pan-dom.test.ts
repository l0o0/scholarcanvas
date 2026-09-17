import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createServer } from "../packages/whiteboard/node_modules/vite/dist/node/index.js";
import type { WhiteboardApp } from "../packages/whiteboard/src/whiteboard/app.tsx";

test("Space temporarily pans instead of manipulating cards and preserves text input", async () => {
  const window = new Window({ url: "https://example.test" });
  const style = window.document.createElement("style");
  style.textContent =
    readFileSync("node_modules/@xyflow/react/dist/style.css", "utf8") +
    readFileSync("packages/whiteboard/src/whiteboard/board.css", "utf8");
  window.document.head.append(style);
  const previous = new Map<PropertyKey, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window,
    self: window,
    document: window.document,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    ResizeObserver: window.ResizeObserver,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const server = await createServer({
    root: "packages/whiteboard",
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
  });
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  try {
    const app = (await server.ssrLoadModule("/src/whiteboard/app.tsx")) as {
      WhiteboardApp: typeof WhiteboardApp;
    };
    const noop = () => {};
    await act(async () => {
      root.render(
        createElement(app.WhiteboardApp, {
          theme: "light",
          initialSnapshot: {
            version: 2,
            nodes: [
              {
                id: "note",
                kind: "note",
                content: "A note",
                position: { x: 200, y: 200 },
                width: 240,
                height: 140,
              },
            ],
            connections: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
          onReady: noop,
          onChange: noop,
          onSave: noop,
          onPickAcademicSource: noop,
          onOpenItem: noop,
          onDropAcademicSources: noop,
          onRefreshZoteroNote: noop,
          onExportFile: noop,
        }),
      );
    });
    const host = container.querySelector(".zmd-board-host")!;
    const card = () => container.querySelector(".react-flow__node")!;
    const key = async (
      type: "keydown" | "keyup",
      key: string,
      code: string,
      target = window.document.body,
      shiftKey = false,
    ) => {
      await act(async () => {
        target.dispatchEvent(
          new window.KeyboardEvent(type, {
            key,
            code,
            shiftKey,
            bubbles: true,
          }),
        );
      });
    };
    assert.ok(card().classList.contains("draggable"));
    await key("keydown", " ", "Space");
    assert.ok(host.classList.contains("is-hand"));
    assert.ok(!card().classList.contains("draggable"));
    assert.ok(!card().classList.contains("selectable"));
    assert.equal(window.getComputedStyle(card()).pointerEvents, "none");
    const selection = window.document.createElement("div");
    selection.className = "react-flow__nodesselection-rect";
    host.append(selection);
    assert.equal(window.getComputedStyle(selection).pointerEvents, "none");
    await key("keyup", " ", "Space");
    assert.ok(!host.classList.contains("is-hand"));
    assert.ok(card().classList.contains("draggable"));
    assert.notEqual(window.getComputedStyle(card()).pointerEvents, "none");
    assert.notEqual(window.getComputedStyle(selection).pointerEvents, "none");

    await key("keydown", "r", "KeyR");
    await key("keyup", "r", "KeyR");
    assert.ok(host.classList.contains("is-draw"));
    await key("keydown", " ", "Space");
    assert.ok(host.classList.contains("is-hand"));
    assert.ok(!host.classList.contains("is-draw"));
    await act(async () => window.dispatchEvent(new window.Event("blur")));
    assert.ok(!host.classList.contains("is-hand"));
    assert.ok(host.classList.contains("is-draw"));
    await key("keyup", " ", "Space");

    const input = window.document.createElement("textarea");
    container.append(input);
    input.focus();
    for (const shiftKey of [false, true]) {
      await key("keydown", " ", "Space", input, shiftKey);
      assert.ok(!host.classList.contains("is-hand"));
      await key("keyup", " ", "Space", input, shiftKey);
    }
  } finally {
    await act(async () => root.unmount());
    await server.close();
    window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
