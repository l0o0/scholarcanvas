import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import {
  createDeferredLabels,
  forwardAcademicParentMessage,
} from "../packages/whiteboard/src/bootstrapState.ts";
import {
  WHITEBOARD_MESSAGE_SOURCE,
  WHITEBOARD_PROTOCOL_VERSION,
  type AcademicAcquisition,
  type AnnotationCandidate,
  type ParentToWhiteboardMessage,
} from "../packages/whiteboard/src/model/protocol.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";
import { createWhiteboardEditor } from "../src/modules/whiteboard/editor.ts";

const bootstrap = readFileSync(
  new URL("../packages/whiteboard/src/bootstrap.tsx", import.meta.url),
  "utf8",
);
const editor = readFileSync(
  new URL("../src/modules/whiteboard/editor.ts", import.meta.url),
  "utf8",
);

test("labels received before runtime readiness are replayed on attachment", () => {
  const initial = { canvas: "Localized canvas" } as WhiteboardLabels;
  const replacement = { canvas: "Updated canvas" } as WhiteboardLabels;
  const received: WhiteboardLabels[] = [];
  const deferred = createDeferredLabels();

  deferred.receive(initial);
  assert.deepEqual(received, []);
  deferred.attach({ setLabels: (labels) => received.push(labels) });
  assert.deepEqual(received, [initial]);

  deferred.receive(replacement);
  assert.deepEqual(received, [initial, replacement]);
});

test("protocol-v2 academic acquisition is forwarded across both bridge sides", () => {
  assert.match(bootstrap, /forwardAcademicParentMessage\(runtime, data\)/);
  assert.match(bootstrap, /type: "pickAcademicSource"/);
  assert.match(bootstrap, /type: "dropAcademicSources"/);

  assert.match(editor, /resolveAcademicAcquisition\(/);
  assert.match(editor, /type: "academicSourceAcquired"/);
  assert.match(editor, /type: "academicSourcesAcquired"/);
  assert.match(editor, /rejectAcademicRequest\(/);
  assert.match(editor, /type: "academicRequestFailed"/);
  assert.match(editor, /case "pickAcademicSource"/);
  assert.match(editor, /case "dropAcademicSources"/);
  assert.match(bootstrap, /onResolveAcademicSources/);
  assert.match(
    bootstrap,
    /onResolveAcademicSources=\{\(requestId, generation, priority, sources\)/,
  );
  assert.match(
    bootstrap,
    /payload: \{ requestId, generation, priority, sources \}/,
  );
  assert.match(editor, /case "resolveAcademicSources"/);
  assert.match(editor, /data\.payload\.priority/);
  assert.match(editor, /applySourceResolutionBatch/);
  assert.match(editor, /type: "sourceResolutionBatch"/);
  assert.match(bootstrap, /type: "refreshZoteroNote"/);
  assert.match(editor, /case "refreshZoteroNote"/);
  assert.match(editor, /type: "noteRefreshed"/);
  assert.match(bootstrap, /type: "listLiteratureAnnotations"/);
  assert.match(editor, /case "listLiteratureAnnotations"/);
  assert.match(editor, /type: "annotationsListed"/);
  assert.match(editor, /type: "annotationListFailed"/);
  assert.match(editor, /type: "sourceActionFailed"/);
});

test("academic bridge dispatch invokes the correlated runtime methods", () => {
  const acquisition: AcademicAcquisition = {
    kind: "literature",
    source: { library: { type: "user" }, itemKey: "ABCD2345" },
    snapshot: { title: "A paper" },
  };
  const calls: unknown[] = [];
  const runtime = {
    resolveAcademicAcquisition: (...args: unknown[]) =>
      calls.push(["resolve", ...args]),
    resolveAcademicAcquisitionBatch: (...args: unknown[]) =>
      calls.push(["resolve-batch", ...args]),
    rejectAcademicRequest: (...args: unknown[]) =>
      calls.push(["reject", ...args]),
    rejectSourceAction: (...args: unknown[]) =>
      calls.push(["source-action-failure", ...args]),
    acceptSourceAction: (...args: unknown[]) =>
      calls.push(["source-action-success", ...args]),
    applySourceResolutionBatch: (...args: unknown[]) =>
      calls.push(["resolution", ...args]),
    applyNoteRefresh: (...args: unknown[]) =>
      calls.push(["note-refresh", ...args]),
    applyAnnotationCandidates: (...args: unknown[]) =>
      calls.push(["annotations", ...args]),
    rejectAnnotationList: (...args: unknown[]) =>
      calls.push(["annotation-failure", ...args]),
  };
  const acquired: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "academicSourceAcquired",
    payload: { requestId: "pick-1", nodeId: "node-1", acquisition },
  };
  const rejected: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "academicRequestFailed",
    payload: {
      requestId: "pick-2",
      nodeId: "node-2",
      code: "picker-cancelled",
    },
  };
  const acquiredBatch: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "academicSourcesAcquired",
    payload: {
      requestId: "drop-1",
      nodeId: "drop-node",
      successes: [{ index: 0, acquisition }],
      failures: [
        {
          index: 1,
          code: "unsupported-attachment",
          message: "Unsupported attachment",
        },
      ],
    },
  };
  const sourceActionFailed: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "sourceActionFailed",
    payload: {
      requestId: "open-1",
      nodeId: "node-1",
      source: { kind: "literature", source: acquisition.source },
      failure: { code: "open-failed", message: "Could not open" },
    },
  };
  const sourceActionSucceeded: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "sourceActionSucceeded",
    payload: {
      requestId: "open-2",
      nodeId: "node-1",
      action: "open",
      source: { kind: "literature", source: acquisition.source },
    },
  };
  const resolution: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "sourceResolutionBatch",
    payload: {
      requestId: "resolution-1",
      generation: 4,
      results: [
        {
          nodeId: "node-3",
          generation: 4,
          status: "unavailable",
          code: "item-missing",
          message: "Missing",
        },
      ],
    },
  };
  const noteRefresh: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "noteRefreshed",
    payload: {
      requestId: "refresh-1",
      nodeId: "node-4",
      acquisition: {
        kind: "note",
        source: { library: { type: "user" }, noteKey: "NOTE1234" },
        content: "Current Zotero text",
      },
    },
  };
  const annotation: AnnotationCandidate = {
    attachmentTitle: "Paper.pdf",
    sortIndex: "00001",
    acquisition: {
      kind: "quote",
      source: {
        library: { type: "user" },
        itemKey: "ITEM1234",
        attachmentKey: "PDF12345",
        annotationKey: "ANN12345",
      },
      snapshot: { text: "Evidence", pageLabel: "8" },
    },
  };
  const annotationsListed: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "annotationsListed",
    payload: {
      requestId: "annotations-1",
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      candidates: [annotation],
      failures: [],
    },
  };
  const annotationListFailed: ParentToWhiteboardMessage = {
    source: WHITEBOARD_MESSAGE_SOURCE,
    channel: "canvas-1",
    v: WHITEBOARD_PROTOCOL_VERSION,
    type: "annotationListFailed",
    payload: {
      requestId: "annotations-2",
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      failure: { code: "item-missing", message: "Missing" },
    },
  };

  assert.equal(forwardAcademicParentMessage(runtime, acquired), true);
  assert.equal(forwardAcademicParentMessage(runtime, acquiredBatch), true);
  assert.equal(forwardAcademicParentMessage(runtime, rejected), true);
  assert.equal(forwardAcademicParentMessage(runtime, sourceActionFailed), true);
  assert.equal(
    forwardAcademicParentMessage(runtime, sourceActionSucceeded),
    true,
  );
  assert.equal(forwardAcademicParentMessage(runtime, resolution), true);
  assert.equal(forwardAcademicParentMessage(runtime, noteRefresh), true);
  assert.equal(forwardAcademicParentMessage(runtime, annotationsListed), true);
  assert.equal(
    forwardAcademicParentMessage(runtime, annotationListFailed),
    true,
  );
  assert.deepEqual(calls, [
    ["resolve", "pick-1", "node-1", acquisition],
    [
      "resolve-batch",
      "drop-1",
      "drop-node",
      acquiredBatch.payload.successes,
      acquiredBatch.payload.failures,
    ],
    ["reject", "pick-2", "node-2", "picker-cancelled"],
    [
      "source-action-failure",
      "open-1",
      "node-1",
      sourceActionFailed.payload.source,
      sourceActionFailed.payload.failure,
    ],
    [
      "source-action-success",
      "open-2",
      "node-1",
      "open",
      sourceActionSucceeded.payload.source,
    ],
    ["resolution", 4, resolution.payload.results],
    ["note-refresh", "refresh-1", "node-4", noteRefresh.payload.acquisition],
    [
      "annotations",
      "annotations-1",
      annotationsListed.payload.source,
      [annotation],
      [],
    ],
    [
      "annotation-failure",
      "annotations-2",
      annotationListFailed.payload.source,
      annotationListFailed.payload.failure,
    ],
  ]);
  assert.equal(JSON.stringify(annotationsListed).includes('"itemID"'), false);
  assert.equal(
    JSON.stringify(annotationsListed).includes('"attachmentID"'),
    false,
  );
});

test("both bridge listeners require the exact peer window and protocol channel", () => {
  assert.match(bootstrap, /event\.source !== window\.parent/);
  assert.match(
    bootstrap,
    /isWhiteboardProtocolMessageForChannel\(event\.data, channel\)/,
  );
  assert.match(editor, /event\.source !== iframe\.contentWindow/);
  assert.match(
    editor,
    /isWhiteboardProtocolMessageForChannel\(event\.data, channel\)/,
  );
  assert.match(bootstrap, /reactRoot\?\.unmount\(\)/);
});

test("host-owned iframe drop capture emits native refs and cleans up listeners", async () => {
  const module =
    (await import("../src/modules/whiteboard/editor.ts")) as typeof import("../src/modules/whiteboard/editor.ts") & {
      attachNativeAcademicDropListeners?: (
        target: {
          addEventListener(
            type: string,
            listener: (event: DragEvent) => void,
          ): void;
          removeEventListener(
            type: string,
            listener: (event: DragEvent) => void,
          ): void;
        },
        resolve: () => {
          status: "accepted";
          sources: Array<{
            library: { type: "user" };
            itemKey: string;
          }>;
        },
        emit: (drop: unknown) => void,
      ) => () => void;
    };
  assert.equal(typeof module.attachNativeAcademicDropListeners, "function");
  const listeners = new Map<string, (event: DragEvent) => void>();
  const removed: string[] = [];
  const target = {
    addEventListener(type: string, listener: (event: DragEvent) => void) {
      listeners.set(type, listener);
    },
    removeEventListener(type: string) {
      removed.push(type);
      listeners.delete(type);
    },
  };
  const emitted: unknown[] = [];
  const sources = [{ library: { type: "user" as const }, itemKey: "ITEM1234" }];
  const cleanup = module.attachNativeAcademicDropListeners!(
    target,
    () => ({ status: "accepted", sources }),
    (drop) => emitted.push(drop),
  );
  let prevented = 0;
  let stopped = 0;
  const event = {
    dataTransfer: { types: ["zotero/item"], dropEffect: "none" },
    clientX: 40,
    clientY: 70,
    preventDefault: () => prevented++,
    stopPropagation: () => stopped++,
  } as unknown as DragEvent;
  listeners.get("dragover")?.(event);
  listeners.get("drop")?.(event);
  assert.deepEqual(emitted, [{ position: { x: 40, y: 70 }, sources }]);
  assert.equal(prevented, 2);
  assert.equal(stopped, 1);
  cleanup();
  assert.deepEqual(removed.sort(), ["dragover", "drop"]);
});

test("native drop capture converts resolver exceptions into typed diagnostics", async () => {
  const module = await import("../src/modules/whiteboard/editor.ts");
  const listeners = new Map<string, (event: DragEvent) => void>();
  const emitted: unknown[] = [];
  const cleanup = module.attachNativeAcademicDropListeners(
    {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type) {
        listeners.delete(type);
      },
    },
    () => {
      throw new Error("native resolver exploded");
    },
    (drop) => emitted.push(drop),
  );
  listeners.get("drop")?.({
    dataTransfer: { types: ["zotero/item"] },
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as DragEvent);
  assert.deepEqual(emitted, [
    {
      code: "drop-malformed",
      diagnostic: "native resolver exploded",
    },
  ]);
  cleanup();
});

test("production editor rebinds native drop ownership on iframe reload and releases it on destroy", (t) => {
  const window = new Window({ url: "https://example.test" });
  const globalKeys = [
    "addon",
    "ztoolkit",
    "__zoteroMarkdownDOMGlobalsInjected",
    "window",
    "self",
    "document",
    "HTMLElement",
    "HTMLDivElement",
    "HTMLSpanElement",
    "HTMLButtonElement",
    "HTMLInputElement",
    "Element",
    "Node",
    "Text",
    "DocumentFragment",
    "DOMParser",
    "Range",
    "Selection",
    "NodeFilter",
    "MutationObserver",
    "ResizeObserver",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "getSelection",
    "CSS",
    "CSSStyleSheet",
    "CustomEvent",
    "Event",
    "KeyboardEvent",
    "MouseEvent",
    "FocusEvent",
    "InputEvent",
  ];
  const previous = new Map(
    globalKeys.map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  Object.defineProperty(globalThis, "addon", {
    configurable: true,
    value: { data: { config: { addonRef: "bamboo" } } },
  });
  Object.defineProperty(globalThis, "ztoolkit", {
    configurable: true,
    value: { log: () => undefined },
  });
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    window.close();
  });
  const parent = window.document.createElement("div");
  window.document.body.append(parent);
  let resolveCount = 0;
  const rejected: Array<[string, string, string | undefined]> = [];
  const handle = createWhiteboardEditor(parent as unknown as HTMLElement, {
    win: window as unknown as globalThis.Window,
    channel: "tab-1:canvas-1",
    resolveNativeAcademicDrop: () => {
      resolveCount += 1;
      return resolveCount === 1
        ? {
            status: "accepted" as const,
            sources: [
              { library: { type: "user" as const }, itemKey: "ITEM1234" },
            ],
          }
        : {
            status: "rejected" as const,
            code: "drop-malformed" as const,
            diagnostic: "native transfer exception",
          };
    },
    onNativeAcademicDropRejected: (requestId, code, diagnostic) =>
      rejected.push([requestId, code, diagnostic]),
  });
  const iframe = parent.querySelector("iframe")!;
  const contentDocument = iframe.contentDocument!;
  const dispatchDrop = () => {
    const event = new window.Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      dataTransfer: {
        value: { types: ["zotero/item"], dropEffect: "none" },
      },
      clientX: { value: 20 },
      clientY: { value: 30 },
    });
    contentDocument.dispatchEvent(event);
  };

  iframe.dispatchEvent(new window.Event("load"));
  dispatchDrop();
  assert.equal(resolveCount, 1);
  iframe.dispatchEvent(new window.Event("load"));
  dispatchDrop();
  assert.equal(resolveCount, 2, "reload must not duplicate drop listeners");
  assert.equal(rejected.length, 1);
  assert.match(rejected[0][0], /^drop-/);
  assert.deepEqual(rejected[0].slice(1), [
    "drop-malformed",
    "native transfer exception",
  ]);

  handle.destroy();
  dispatchDrop();
  assert.equal(resolveCount, 2, "destroy must detach the active document");
  assert.equal(parent.childElementCount, 0);
});
