import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnnotationBrowser,
  existingAnnotationKeys,
  filterAnnotationCandidates,
  groupAnnotationCandidates,
  toggleAnnotationSelection,
  type AnnotationBrowserLabels,
} from "../packages/whiteboard/src/chrome/AnnotationBrowser.tsx";
import { PropertiesPanel } from "../packages/whiteboard/src/chrome/PropertiesPanel.tsx";
import type { CanvasDocument } from "../packages/whiteboard/src/model/document.ts";
import type {
  AnnotationCandidate,
  AnnotationListFailure,
  WhiteboardLabels,
} from "../packages/whiteboard/src/model/protocol.ts";
import { canvasDocumentToFlow } from "../packages/whiteboard/src/whiteboard/document.ts";

const browserLabels: AnnotationBrowserLabels = {
  title: "Annotations",
  search: "Search annotations",
  loading: "Loading annotations…",
  empty: "No supported annotations",
  unavailable: "Annotations unavailable",
  partialFailure: "Some annotations could not be loaded",
  alreadyAdded: "Already added",
  focusExisting: "Focus existing",
  addSelected: "Add selected",
  page: "Page",
  close: "Close",
};

function candidate(
  annotationKey: string,
  attachmentTitle: string,
  text: string,
  options: { comment?: string; pageLabel?: string; color?: string } = {},
): AnnotationCandidate {
  return {
    attachmentTitle,
    sortIndex: annotationKey,
    acquisition: {
      kind: "quote",
      source: {
        library: { type: "user" },
        itemKey: "ITEM1234",
        attachmentKey: `PDF-${attachmentTitle}`,
        annotationKey,
      },
      snapshot: { text, ...options },
    },
  };
}

const candidates = [
  candidate("ANN1", "Methods.pdf", "Prior evidence", {
    comment: "Background",
    pageLabel: "4",
    color: "#ffd400",
  }),
  candidate("ANN2", "Results.pdf", "Strong result", {
    comment: "Method implication",
    pageLabel: "12",
  }),
  candidate("ANN3", "Methods.pdf", "Later excerpt", { pageLabel: "19" }),
];

const document: CanvasDocument = {
  version: 2,
  nodes: [
    {
      id: "literature",
      kind: "literature",
      position: { x: 0, y: 0 },
      width: 280,
      height: 200,
      source: { library: { type: "user" }, itemKey: "ITEM1234" },
      snapshot: { title: "Paper" },
    },
    {
      id: "quote-one",
      kind: "quote",
      position: { x: 320, y: 0 },
      width: 280,
      height: 192,
      source: {
        library: { type: "user" },
        itemKey: "OTHER",
        attachmentKey: "OTHER-PDF",
        annotationKey: "ANN1",
      },
      snapshot: { text: "Already here" },
    },
  ],
  connections: [],
};

function browser(
  overrides: Partial<Parameters<typeof AnnotationBrowser>[0]> = {},
) {
  return createElement(AnnotationBrowser, {
    labels: browserLabels,
    state: { status: "ready", candidates, failures: [] },
    query: "",
    selectedKeys: new Set<string>(),
    existingKeys: existingAnnotationKeys(document),
    returnFocusRef: { current: null },
    onQueryChange: () => undefined,
    onToggle: () => undefined,
    onClose: () => undefined,
    onFocusExisting: () => undefined,
    onAddSelected: () => undefined,
    ...overrides,
  });
}

function visit(
  node: ReactNode,
  consume: (element: ReactElement) => void,
): void {
  if (Array.isArray(node)) {
    for (const child of node) visit(child, consume);
    return;
  }
  if (!node || typeof node !== "object" || !("props" in node)) return;
  const element = node as ReactElement<{ children?: ReactNode }>;
  consume(element);
  visit(element.props.children, consume);
}

test("filters text, comment, and page label case-insensitively", () => {
  assert.deepEqual(
    filterAnnotationCandidates(candidates, "METHOD").map(
      (item) => item.acquisition.source.annotationKey,
    ),
    ["ANN2"],
  );
  assert.deepEqual(
    filterAnnotationCandidates(candidates, "prior").map(
      (item) => item.acquisition.source.annotationKey,
    ),
    ["ANN1"],
  );
  assert.deepEqual(
    filterAnnotationCandidates(candidates, "19").map(
      (item) => item.acquisition.source.annotationKey,
    ),
    ["ANN3"],
  );
});

test("groups by attachment title without changing gateway order", () => {
  assert.deepEqual(
    groupAnnotationCandidates(candidates).map((group) => ({
      title: group.attachmentTitle,
      keys: group.candidates.map(
        (item) => item.acquisition.source.annotationKey,
      ),
    })),
    [
      { title: "Methods.pdf", keys: ["ANN1", "ANN3"] },
      { title: "Results.pdf", keys: ["ANN2"] },
    ],
  );
});

test("finds annotation keys already acquired anywhere in the document", () => {
  assert.deepEqual(existingAnnotationKeys(document), new Set(["ANN1"]));
});

test("supports checkbox multi-selection without selecting duplicate keys", () => {
  const first = toggleAnnotationSelection(new Set<string>(), "ANN2", true);
  const second = toggleAnnotationSelection(first, "ANN3", true);
  const removed = toggleAnnotationSelection(second, "ANN2", false);
  assert.deepEqual(second, new Set(["ANN2", "ANN3"]));
  assert.deepEqual(removed, new Set(["ANN3"]));

  const toggled: Array<[string, boolean]> = [];
  const tree = AnnotationBrowser({
    ...(browser().props as Parameters<typeof AnnotationBrowser>[0]),
    selectedKeys: second,
    onToggle: (key, checked) => toggled.push([key, checked]),
  });
  const checkboxes: ReactElement<Record<string, unknown>>[] = [];
  visit(tree, (element) => {
    if (element.type === "input" && element.props.type === "checkbox") {
      checkboxes.push(element as ReactElement<Record<string, unknown>>);
    }
  });
  assert.equal(checkboxes.length, 3);
  assert.equal(checkboxes[0].props.disabled, true);
  assert.equal(checkboxes[1].props.checked, true);
  (checkboxes[1].props.onChange as (event: unknown) => void)({
    currentTarget: { checked: false },
  });
  assert.deepEqual(toggled, [["ANN3", false]]);
});

test("renders an accessible dialog and duplicate focus action", () => {
  const markup = renderToStaticMarkup(browser());
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /aria-label="Search annotations"/);
  assert.match(markup, /type="checkbox"[^>]*disabled/);
  assert.match(markup, /Already added/);
  assert.match(markup, />Focus existing</);
  assert.match(
    markup,
    /Methods\.pdf[\s\S]*ANN1|Methods\.pdf[\s\S]*Prior evidence/,
  );
  assert.match(markup, /Results\.pdf/);
});

test("renders loading, empty, unavailable, and partial-failure states", () => {
  assert.match(
    renderToStaticMarkup(browser({ state: { status: "loading" } })),
    /Loading annotations/,
  );
  assert.match(
    renderToStaticMarkup(
      browser({ state: { status: "ready", candidates: [], failures: [] } }),
    ),
    /No supported annotations/,
  );
  const unavailable: AnnotationListFailure = {
    code: "item-missing",
    message: "The Zotero item is unavailable.",
  };
  assert.match(
    renderToStaticMarkup(
      browser({ state: { status: "unavailable", failure: unavailable } }),
    ),
    /Annotations unavailable/,
  );
  assert.match(
    renderToStaticMarkup(
      browser({
        state: {
          status: "ready",
          candidates: [candidates[1]],
          failures: [{ code: "list-failed", message: "One PDF failed" }],
        },
      }),
    ),
    /Some annotations could not be loaded[\s\S]*Strong result/,
  );
});

test("Add selected is disabled only when no eligible annotation is selected", () => {
  const none = renderToStaticMarkup(browser());
  const selected = renderToStaticMarkup(
    browser({ selectedKeys: new Set(["ANN2", "ANN3"]) }),
  );
  assert.match(none, /<button[^>]*disabled=""[^>]*>Add selected<\/button>/);
  assert.doesNotMatch(
    selected,
    /<button[^>]*disabled=""[^>]*>Add selected<\/button>/,
  );
});

test("Escape and backdrop dismiss the dialog and restore focus", () => {
  let closes = 0;
  let focuses = 0;
  const target = {};
  const tree = AnnotationBrowser({
    ...(browser().props as Parameters<typeof AnnotationBrowser>[0]),
    returnFocusRef: { current: { focus: () => focuses++ } },
    onClose: () => closes++,
  });
  (tree.props.onKeyDown as (event: unknown) => void)({
    key: "Escape",
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  });
  assert.deepEqual([closes, focuses], [1, 1]);

  (tree.props.onMouseDown as (event: unknown) => void)({
    currentTarget: target,
    target,
  });
  assert.deepEqual([closes, focuses], [2, 2]);
  (tree.props.onMouseDown as (event: unknown) => void)({
    currentTarget: target,
    target: {},
  });
  assert.deepEqual([closes, focuses], [2, 2]);
});

test("only a selected Literature exposes the lazy annotation action", () => {
  const literature = canvasDocumentToFlow(document).nodes[0];
  const quote = canvasDocumentToFlow(document).nodes[1];
  const labels = {
    ...({} as WhiteboardLabels),
    kindLiterature: "Literature",
    kindQuote: "Quote",
    sourceStatus: "Source status",
    sourceAvailable: "Available",
    sourceLoading: "Loading",
    sourceMissing: "Unavailable",
    editText: "Edit",
    viewAnnotations: "View annotations",
    copy: "Copy",
    delete: "Delete",
  };
  let requests = 0;
  const renderPanel = (node: typeof literature) =>
    PropertiesPanel({
      labels,
      node,
      sourceState: { status: "resolved" },
      onEdit: () => undefined,
      onOpen: () => undefined,
      onRefreshSource: () => undefined,
      onViewAnnotations: () => requests++,
      onCopy: () => undefined,
      onDelete: () => undefined,
    });
  const literaturePanel = renderPanel(literature);
  const quotePanel = renderPanel(quote);
  assert.equal(requests, 0, "rendering must not request annotations");
  assert.match(renderToStaticMarkup(literaturePanel), /View annotations/);
  assert.doesNotMatch(renderToStaticMarkup(quotePanel), /View annotations/);

  let action: ReactElement<Record<string, unknown>> | undefined;
  visit(literaturePanel, (element) => {
    const markup = renderToStaticMarkup(element);
    if (element.type === "button" && markup.includes("View annotations")) {
      action = element as ReactElement<Record<string, unknown>>;
    }
  });
  assert.ok(action);
  (action.props.onClick as () => void)();
  assert.equal(requests, 1, "one click issues one on-demand request");
});
