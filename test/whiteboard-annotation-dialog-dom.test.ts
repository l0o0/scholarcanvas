import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Window } from "happy-dom";
import { act, createElement, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AnnotationBrowser,
  type AnnotationBrowserLabels,
} from "../packages/whiteboard/src/chrome/AnnotationBrowser.tsx";
import { quoteSourceIdentity } from "../packages/whiteboard/src/model/academic.ts";
import type { AnnotationCandidate } from "../packages/whiteboard/src/model/protocol.ts";
import { handleGlobalCanvasKeyDown } from "../packages/whiteboard/src/whiteboard/keyboard.ts";

const labels: AnnotationBrowserLabels = {
  title: "Annotations",
  search: "Search annotations",
  loading: "Loading",
  empty: "Empty",
  unavailable: "Unavailable",
  partialFailure: "Partial failure",
  alreadyAdded: "Already added",
  focusExisting: "Focus existing",
  addSelected: "Add selected",
  page: "Page",
  close: "Close",
};
const source = {
  library: { type: "user" as const },
  itemKey: "ITEM1234",
  attachmentKey: "PDF12345",
  annotationKey: "ANN12345",
};
const candidate: AnnotationCandidate = {
  attachmentTitle: "Paper.pdf",
  sortIndex: "0001",
  acquisition: {
    kind: "quote",
    source,
    snapshot: { text: "Evidence" },
  },
};

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

test("mounted dialog traps focus, inerts siblings, and restores trigger focus on Escape", async (t) => {
  const window = installDom(t);
  const container = window.document.createElement("div");
  window.document.body.append(container);

  function Harness() {
    const [open, setOpen] = useState(true);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    return createElement(
      "div",
      null,
      createElement("button", { ref: triggerRef, id: "trigger" }, "View"),
      createElement(
        "main",
        { id: "background" },
        createElement("button", { id: "background-action" }, "Canvas action"),
      ),
      open
        ? createElement(AnnotationBrowser, {
            labels,
            state: { status: "ready", candidates: [candidate], failures: [] },
            query: "",
            selectedKeys: new Set([quoteSourceIdentity(source)]),
            existingKeys: new Set(),
            returnFocusRef: triggerRef,
            onQueryChange: () => undefined,
            onToggle: () => undefined,
            onClose: () => setOpen(false),
            onFocusExisting: () => undefined,
            onAddSelected: () => undefined,
          })
        : null,
    );
  }

  const root = createRoot(container);
  await act(async () => root.render(createElement(Harness)));
  const search = window.document.querySelector<HTMLInputElement>(
    '[aria-label="Search annotations"]',
  );
  const background = window.document.querySelector<HTMLElement>("#background");
  assert.equal(window.document.activeElement, search);
  assert.equal(background?.inert, true);
  assert.equal(background?.getAttribute("aria-hidden"), "true");

  const dialog = window.document.querySelector<HTMLElement>('[role="dialog"]');
  const focusable = Array.from(
    dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  );
  focusable.at(-1)?.focus();
  window.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
  );
  assert.equal(window.document.activeElement, focusable[0]);
  focusable[0].focus();
  window.dispatchEvent(
    new window.KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
    }),
  );
  assert.equal(window.document.activeElement, focusable.at(-1));

  await act(async () =>
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  assert.equal(window.document.querySelector('[role="dialog"]'), null);
  assert.equal(background?.inert, false);
  assert.equal(background?.hasAttribute("aria-hidden"), false);
  assert.equal(window.document.activeElement?.id, "trigger");

  await act(async () => root.unmount());
});

test("Focus existing unmounts without restoring the trigger and transfers focus", async (t) => {
  const window = installDom(t);
  const container = window.document.createElement("div");
  window.document.body.append(container);

  function Harness() {
    const [open, setOpen] = useState(true);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const focusExisting = () => {
      setOpen(false);
      window.requestAnimationFrame(() =>
        window.document.querySelector<HTMLElement>("#existing-node")?.focus(),
      );
    };
    return createElement(
      "div",
      null,
      createElement("button", { ref: triggerRef, id: "trigger" }, "View"),
      createElement(
        "main",
        { id: "background" },
        createElement("button", { id: "existing-node" }, "Existing Quote"),
      ),
      open
        ? createElement(AnnotationBrowser, {
            labels,
            state: { status: "ready", candidates: [candidate], failures: [] },
            query: "",
            selectedKeys: new Set(),
            existingKeys: new Set([quoteSourceIdentity(source)]),
            returnFocusRef: triggerRef,
            onQueryChange: () => undefined,
            onToggle: () => undefined,
            onClose: () => setOpen(false),
            onFocusExisting: focusExisting,
            onAddSelected: () => undefined,
          })
        : null,
    );
  }

  const root = createRoot(container);
  await act(async () => root.render(createElement(Harness)));
  const focus = window.document.querySelector<HTMLButtonElement>(
    ".zmd-board-annotation-focus",
  );
  await act(async () => focus?.click());
  await window.happyDOM.waitUntilComplete();
  assert.equal(window.document.querySelector('[role="dialog"]'), null);
  assert.equal(window.document.activeElement?.id, "existing-node");
  assert.notEqual(window.document.activeElement?.id, "trigger");
  await act(async () => root.unmount());
});

test("close button and backdrop both restore trigger focus after real unmount", async (t) => {
  const window = installDom(t);

  for (const method of ["button", "backdrop"] as const) {
    const container = window.document.createElement("div");
    window.document.body.append(container);
    function Harness() {
      const [open, setOpen] = useState(true);
      const triggerRef = useRef<HTMLButtonElement | null>(null);
      return createElement(
        "div",
        null,
        createElement(
          "button",
          { ref: triggerRef, id: `trigger-${method}` },
          "View",
        ),
        createElement("main", { id: `background-${method}` }, "Canvas"),
        open
          ? createElement(AnnotationBrowser, {
              labels,
              state: { status: "loading" },
              query: "",
              selectedKeys: new Set(),
              existingKeys: new Set(),
              returnFocusRef: triggerRef,
              onQueryChange: () => undefined,
              onToggle: () => undefined,
              onClose: () => setOpen(false),
              onFocusExisting: () => undefined,
              onAddSelected: () => undefined,
            })
          : null,
      );
    }

    const root = createRoot(container);
    await act(async () => root.render(createElement(Harness)));
    if (method === "button") {
      await act(async () =>
        window.document
          .querySelector<HTMLButtonElement>(".zmd-board-annotation-close")
          ?.click(),
      );
    } else {
      await act(async () =>
        window.document
          .querySelector<HTMLElement>(".zmd-board-annotation-backdrop")
          ?.dispatchEvent(
            new window.MouseEvent("mousedown", { bubbles: true }),
          ),
      );
    }
    assert.equal(window.document.querySelector('[role="dialog"]'), null);
    assert.equal(window.document.activeElement?.id, `trigger-${method}`);
    assert.equal(
      window.document
        .querySelector<HTMLElement>(`#background-${method}`)
        ?.hasAttribute("aria-hidden"),
      false,
    );
    await act(async () => root.unmount());
    container.remove();
  }
});

test("checkbox interaction emits the full source identity", async (t) => {
  const window = installDom(t);
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const toggled: Array<[string, boolean]> = [];
  const returnFocusRef = { current: null };
  const root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(AnnotationBrowser, {
        labels,
        state: { status: "ready", candidates: [candidate], failures: [] },
        query: "",
        selectedKeys: new Set(),
        existingKeys: new Set(),
        returnFocusRef,
        onQueryChange: () => undefined,
        onToggle: (identity, checked) => toggled.push([identity, checked]),
        onClose: () => undefined,
        onFocusExisting: () => undefined,
        onAddSelected: () => undefined,
      }),
    ),
  );
  const checkbox = window.document.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  await act(async () => checkbox?.click());
  assert.deepEqual(toggled, [[quoteSourceIdentity(source), true]]);
  await act(async () => root.unmount());
});

test("production canvas keyboard handling leaves modal search input and dismissal intact", async (t) => {
  const window = installDom(t);
  const container = window.document.createElement("div");
  window.document.body.append(container);
  let activeTool = "select";
  let deletions = 0;
  let nudges = 0;

  function Harness() {
    const [open, setOpen] = useState(true);
    const [query, setQuery] = useState("");
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) =>
        handleGlobalCanvasKeyDown(
          event,
          {
            annotationBrowserOpen: open,
            editing: false,
            drawing: false,
            selectedNodeIds: ["literature-1"],
            selectedEdgeIds: [],
          },
          {
            endFrameDrag: () => undefined,
            cancelDraw: () => undefined,
            dismissTransientUi: () => undefined,
            setActiveTool: (tool) => {
              activeTool = tool;
            },
            deleteSelection: () => {
              deletions += 1;
            },
            nudgeSelected: () => {
              nudges += 1;
              return true;
            },
          },
        );
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [open]);
    return createElement(
      "div",
      null,
      createElement("button", { ref: triggerRef, id: "trigger" }, "View"),
      createElement(
        "main",
        null,
        "Selected Literature",
        createElement("input", { id: "outside-input", "aria-label": "Title" }),
      ),
      open
        ? createElement(AnnotationBrowser, {
            labels,
            state: { status: "ready", candidates: [candidate], failures: [] },
            query,
            selectedKeys: new Set(),
            existingKeys: new Set(),
            returnFocusRef: triggerRef,
            onQueryChange: setQuery,
            onToggle: () => undefined,
            onClose: () => setOpen(false),
            onFocusExisting: () => undefined,
            onAddSelected: () => undefined,
          })
        : null,
    );
  }

  const root = createRoot(container);
  await act(async () => root.render(createElement(Harness)));
  const search = window.document.querySelector<HTMLInputElement>(
    '[aria-label="Search annotations"]',
  );
  assert.ok(search);

  for (const key of ["e", "r", "a", "t", "Backspace", "Delete", "ArrowRight"]) {
    const event = new window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    search.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false, `${key} must remain editable`);
  }
  assert.equal(activeTool, "select");
  assert.equal(deletions, 0);
  assert.equal(nudges, 0);
  assert.equal(
    window.document.querySelector("main")?.textContent,
    "Selected Literature",
  );

  await act(async () =>
    search.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(window.document.querySelector('[role="dialog"]'), null);
  assert.equal(window.document.activeElement?.id, "trigger");

  const outsideInput =
    window.document.querySelector<HTMLInputElement>("#outside-input");
  for (const key of ["e", "Backspace", "Delete", "ArrowRight"]) {
    const editableEvent = new window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
    });
    outsideInput?.dispatchEvent(editableEvent);
    assert.equal(editableEvent.defaultPrevented, false);
  }
  assert.equal(activeTool, "select");
  assert.equal(deletions, 0);
  assert.equal(nudges, 0);

  const shortcut = new window.KeyboardEvent("keydown", {
    key: "e",
    bubbles: true,
    cancelable: true,
  });
  window.document.querySelector("main")?.dispatchEvent(shortcut);
  assert.equal(shortcut.defaultPrevented, true);
  assert.equal(activeTool, "eraser");

  const deletion = new window.KeyboardEvent("keydown", {
    key: "Delete",
    bubbles: true,
    cancelable: true,
  });
  window.document.querySelector("main")?.dispatchEvent(deletion);
  assert.equal(deletion.defaultPrevented, true);
  assert.equal(deletions, 1);

  const arrow = new window.KeyboardEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    cancelable: true,
  });
  window.document.querySelector("main")?.dispatchEvent(arrow);
  assert.equal(arrow.defaultPrevented, true);
  assert.equal(nudges, 1);
  await act(async () => root.unmount());
});
