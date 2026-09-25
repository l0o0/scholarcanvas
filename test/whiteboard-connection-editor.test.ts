import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  connectionDisplayLabel,
  ConnectionEditor,
} from "../packages/whiteboard/src/chrome/ConnectionEditor.tsx";
import { createAcademicConnection } from "../packages/whiteboard/src/model/connection.ts";
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

test("edge editor commits text only and supports clearing the label", async (t) => {
  const window = installDom(t);
  const commits: string[] = [];
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);

  await act(async () =>
    root.render(
      createElement(ConnectionEditor, {
        labels,
        value: "renamed label",
        left: 240,
        top: 180,
        onCommit: (value) => commits.push(value),
        onCancel: () => {},
      }),
    ),
  );

  assert.equal(container.querySelectorAll("textarea").length, 1);
  assert.equal(container.querySelector("select"), null);
  await act(async () =>
    container
      .querySelector("textarea")!
      .dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
        }),
      ),
  );
  assert.deepEqual(commits, [], "Shift+Enter keeps multiline editing open");
  assert.equal(container.querySelector("button"), null);
  assert.equal(container.querySelector("form"), null);
  await act(async () =>
    container
      .querySelector("textarea")!
      .dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
  );
  assert.deepEqual(commits, ["renamed label"]);

  await act(async () => root.unmount());

  const clearContainer = window.document.createElement("div");
  window.document.body.append(clearContainer);
  const clearRoot = createRoot(clearContainer);
  await act(async () =>
    clearRoot.render(
      createElement(ConnectionEditor, {
        labels,
        value: "",
        left: 240,
        top: 180,
        onCommit: (value) => commits.push(value),
        onCancel: () => {},
      }),
    ),
  );
  await act(async () => clearContainer.querySelector("textarea")!.blur());
  assert.deepEqual(commits, ["renamed label", ""]);

  await act(async () => clearRoot.unmount());
});

test("an explicit empty academic label stays empty instead of using relation text", () => {
  const connection = {
    ...createAcademicConnection("edge", "source", "target", "supports"),
    label: "",
  };
  assert.equal(connectionDisplayLabel(connection, labels), "");
});

test("Escape cancels once without saving on blur", async (t) => {
  const window = installDom(t);
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  const commits: string[] = [];
  let cancelled = 0;
  await act(async () =>
    root.render(
      createElement(ConnectionEditor, {
        labels,
        value: "original",
        left: 100,
        top: 100,
        onCommit: (value) => commits.push(value),
        onCancel: () => cancelled++,
      }),
    ),
  );
  const input = container.querySelector("textarea")!;
  await act(async () => {
    input.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    input.blur();
  });
  assert.equal(cancelled, 1);
  assert.deepEqual(commits, []);
  await act(async () => root.unmount());
});
