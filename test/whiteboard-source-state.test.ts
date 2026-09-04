import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CanvasDocument } from "../packages/whiteboard/src/model/document.ts";
import type { AcademicAcquisition } from "../packages/whiteboard/src/model/protocol.ts";
import {
  applySourceResolutionResults,
  CanvasDocumentHistory,
  canvasDocumentToFlow,
  flowToCanvasDocument,
} from "../packages/whiteboard/src/whiteboard/document.ts";
import { applySourceResolutionBatch } from "../packages/whiteboard/src/whiteboard/runtime.ts";
import {
  applyResolvedAcquisition,
  createSourceResolutionStates,
  prioritizedSourceRequests,
  sourceCacheKey,
  sourceDescriptor,
  sourceSnapshotChanged,
  updateSourceResolutionStates,
  visibleSourceNodeIds,
} from "../packages/whiteboard/src/whiteboard/sourceState.ts";

const appSource = readFileSync(
  new URL("../packages/whiteboard/src/whiteboard/app.tsx", import.meta.url),
  "utf8",
);

const DOCUMENT: CanvasDocument = {
  version: 2,
  nodes: [
    {
      id: "literature",
      kind: "literature",
      position: { x: 20, y: 30 },
      width: 280,
      height: 200,
      frameId: "frame",
      style: { stroke: "#123456", fontSize: 17 },
      source: { library: { type: "user" }, itemKey: "ITEMKEY" },
      snapshot: { title: "Persisted paper", year: "2024" },
    },
    {
      id: "quote",
      kind: "quote",
      position: { x: 450, y: 40 },
      width: 280,
      height: 192,
      source: {
        library: { type: "group", groupID: 42 },
        itemKey: "PARENT",
        attachmentKey: "PDFKEY",
        annotationKey: "ANNOKEY",
      },
      snapshot: { text: "Persisted excerpt", pageLabel: "3" },
    },
    {
      id: "sourced-note",
      kind: "note",
      position: { x: 40, y: 320 },
      width: 260,
      height: 152,
      source: {
        library: { type: "user" },
        noteKey: "NOTEKEY",
        itemKey: "ITEMKEY",
      },
      sourceSnapshot: { title: "Persisted note title" },
      content: "Locally edited note content",
    },
    {
      id: "local-note",
      kind: "note",
      position: { x: 900, y: 40 },
      width: 260,
      height: 152,
      content: "No Zotero source",
    },
    {
      id: "frame",
      kind: "frame",
      position: { x: 0, y: 0 },
      width: 360,
      height: 560,
      title: "Sources",
    },
  ],
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

test("describes only source-backed academic nodes with stable cache keys", () => {
  const [literature, quote, sourcedNote, localNote, frame] = DOCUMENT.nodes;

  assert.deepEqual(sourceDescriptor(literature), {
    kind: "literature",
    source: { library: { type: "user" }, itemKey: "ITEMKEY" },
  });
  assert.deepEqual(sourceDescriptor(quote), {
    kind: "quote",
    source: {
      library: { type: "group", groupID: 42 },
      itemKey: "PARENT",
      attachmentKey: "PDFKEY",
      annotationKey: "ANNOKEY",
    },
  });
  assert.deepEqual(sourceDescriptor(sourcedNote), {
    kind: "note",
    source: {
      library: { type: "user" },
      noteKey: "NOTEKEY",
      itemKey: "ITEMKEY",
    },
  });
  assert.equal(sourceDescriptor(localNote), undefined);
  assert.equal(sourceDescriptor(frame), undefined);

  assert.equal(
    sourceCacheKey(sourceDescriptor(literature)!),
    "literature:user:ITEMKEY",
  );
  assert.equal(
    sourceCacheKey(sourceDescriptor(quote)!),
    "quote:group:42:PARENT:PDFKEY:ANNOKEY",
  );
  assert.equal(
    sourceCacheKey(sourceDescriptor(sourcedNote)!),
    "note:user:ITEMKEY:NOTEKEY",
  );
});

test("the runtime applies background snapshots without changing history", () => {
  const flow = canvasDocumentToFlow(DOCUMENT);
  const literature = {
    ...flow.nodes[0],
    selected: true,
    dragging: true,
    className: "custom-class",
    measured: { width: 281, height: 201 },
  };
  const quote = { ...flow.nodes[1], selected: false };
  const changes: number[] = [];
  const history = new CanvasDocumentHistory((revision) =>
    changes.push(revision),
  );
  const beforeRevision = history.revision;
  const literatureAcquisition: AcademicAcquisition = {
    kind: "literature",
    source: { library: { type: "user" }, itemKey: "ITEMKEY" },
    snapshot: {
      title: "Current paper",
      creators: "Ada Lovelace",
      year: "2026",
    },
  };
  const quoteAcquisition: AcademicAcquisition = {
    kind: "quote",
    source: {
      library: { type: "group", groupID: 42 },
      itemKey: "PARENT",
      attachmentKey: "PDFKEY",
      annotationKey: "ANNOKEY",
    },
    snapshot: { text: "Current excerpt", pageLabel: "4" },
  };

  let runtimeNodes = [literature, quote, ...flow.nodes.slice(2)];
  applySourceResolutionBatch(
    (update) => {
      runtimeNodes =
        typeof update === "function" ? update(runtimeNodes) : update;
    },
    8,
    [
      {
        nodeId: "literature",
        generation: 8,
        status: "resolved",
        acquisition: literatureAcquisition,
      },
      {
        nodeId: "quote",
        generation: 8,
        status: "resolved",
        acquisition: quoteAcquisition,
      },
    ],
  );
  const [nextLiterature, nextQuote] = runtimeNodes;

  assert.deepEqual(nextLiterature.data.model.snapshot, {
    title: "Current paper",
    creators: "Ada Lovelace",
    year: "2026",
  });
  assert.equal(
    nextQuote.data.model.kind === "quote" && nextQuote.data.model.snapshot.text,
    "Current excerpt",
  );
  assert.deepEqual(
    {
      id: nextLiterature.id,
      position: nextLiterature.position,
      width: nextLiterature.width,
      height: nextLiterature.height,
      style: nextLiterature.data.model.style,
      frameId: nextLiterature.data.model.frameId,
      selected: nextLiterature.selected,
      dragging: nextLiterature.dragging,
      className: nextLiterature.className,
      measured: nextLiterature.measured,
    },
    {
      id: literature.id,
      position: literature.position,
      width: literature.width,
      height: literature.height,
      style: literature.data.model.style,
      frameId: literature.data.model.frameId,
      selected: literature.selected,
      dragging: literature.dragging,
      className: literature.className,
      measured: literature.measured,
    },
  );
  assert.equal(history.revision, beforeRevision);
  assert.deepEqual(changes, []);

  const saved = flowToCanvasDocument(
    [nextLiterature, nextQuote, ...flow.nodes.slice(2)],
    flow.edges,
    DOCUMENT.viewport!,
    flow.shell,
  );
  assert.equal(saved.nodes[0].kind, "literature");
  assert.equal(
    saved.nodes[0].kind === "literature" && saved.nodes[0].snapshot.title,
    "Current paper",
  );
});

test("background Note resolution updates only the source title", () => {
  const note = canvasDocumentToFlow(DOCUMENT).nodes[2];
  const acquisition: AcademicAcquisition = {
    kind: "note",
    source: {
      library: { type: "user" },
      noteKey: "NOTEKEY",
      itemKey: "ITEMKEY",
    },
    sourceSnapshot: { title: "Current Zotero title" },
    content: "Current Zotero body that must not overwrite local work",
  };

  const next = applyResolvedAcquisition(note, acquisition);

  assert.equal(
    next.data.model.kind === "note" && next.data.model.content,
    "Locally edited note content",
  );
  assert.deepEqual(
    next.data.model.kind === "note" && next.data.model.sourceSnapshot,
    { title: "Current Zotero title" },
  );
});

test("snapshot change detection requires the same full Quote source identity", () => {
  const quote = canvasDocumentToFlow(DOCUMENT).nodes[1];
  const source =
    quote.data.model.kind === "quote" ? quote.data.model.source : undefined;
  assert.ok(source);

  assert.equal(
    sourceSnapshotChanged(quote, {
      kind: "quote",
      source,
      snapshot: { text: "Current excerpt", pageLabel: "4" },
    }),
    true,
  );
  assert.equal(
    sourceSnapshotChanged(quote, {
      kind: "quote",
      source,
      snapshot: { text: "Persisted excerpt", pageLabel: "3" },
    }),
    false,
  );
  assert.equal(
    sourceSnapshotChanged(quote, {
      kind: "quote",
      source: { ...source, attachmentKey: "OTHER-PDF" },
      snapshot: { text: "Retargeted excerpt" },
    }),
    false,
  );
});

test("a source batch applies only results from the current generation", () => {
  const flow = canvasDocumentToFlow(DOCUMENT);

  const next = applySourceResolutionResults(flow.nodes, 8, [
    {
      nodeId: "literature",
      generation: 7,
      status: "resolved",
      acquisition: {
        kind: "literature",
        source: { library: { type: "user" }, itemKey: "ITEMKEY" },
        snapshot: { title: "Stale generation" },
      },
    },
    {
      nodeId: "quote",
      generation: 8,
      status: "resolved",
      acquisition: {
        kind: "quote",
        source: {
          library: { type: "group", groupID: 42 },
          itemKey: "PARENT",
          attachmentKey: "PDFKEY",
          annotationKey: "ANNOKEY",
        },
        snapshot: { text: "Current generation" },
      },
    },
    {
      nodeId: "sourced-note",
      generation: 8,
      status: "unavailable",
      code: "item-missing",
      message: "Missing",
    },
  ]);

  assert.equal(
    next[0].data.model.kind === "literature" &&
      next[0].data.model.snapshot.title,
    "Persisted paper",
  );
  assert.equal(
    next[1].data.model.kind === "quote" && next[1].data.model.snapshot.text,
    "Current generation",
  );
  assert.equal(next[2], flow.nodes[2]);
});

test("tracks source resolution state outside the persisted model", () => {
  const states = createSourceResolutionStates(DOCUMENT.nodes);
  assert.deepEqual(
    [...states.entries()],
    [
      ["literature", { status: "idle" }],
      ["quote", { status: "idle" }],
      ["sourced-note", { status: "idle" }],
    ],
  );

  const loading = updateSourceResolutionStates(states, [
    { nodeId: "literature", status: "loading" },
  ]);
  const unavailable = updateSourceResolutionStates(loading, [
    {
      nodeId: "quote",
      status: "unavailable",
      message: "The annotation is unavailable.",
    },
  ]);

  assert.deepEqual(unavailable.get("literature"), { status: "loading" });
  assert.deepEqual(unavailable.get("quote"), {
    status: "unavailable",
    message: "The annotation is unavailable.",
  });
  assert.equal(JSON.stringify(DOCUMENT).includes("unavailable"), false);

  const newlyAcquired = updateSourceResolutionStates(unavailable, [
    { nodeId: "new-literature", status: "loading" },
  ]);
  assert.deepEqual(newlyAcquired.get("new-literature"), {
    status: "loading",
  });
});

test("finds visible source nodes from viewport bounds without selecting local nodes", () => {
  const nodes = canvasDocumentToFlow(DOCUMENT).nodes;

  assert.deepEqual(
    visibleSourceNodeIds(
      nodes,
      { x: -10, y: -20, zoom: 2 },
      {
        width: 700,
        height: 500,
      },
    ),
    ["literature"],
  );
});

test("partitions selected, visible, and idle source requests", () => {
  const nodes = canvasDocumentToFlow(DOCUMENT).nodes.map((node) =>
    node.id === "quote" ? { ...node, selected: true } : node,
  );

  const requests = prioritizedSourceRequests(
    nodes,
    { x: -10, y: -20, zoom: 2 },
    { width: 700, height: 500 },
  );

  assert.deepEqual(
    requests.selected.map(({ nodeId }) => nodeId),
    ["quote"],
  );
  assert.deepEqual(
    requests.visible.map(({ nodeId }) => nodeId),
    ["literature"],
  );
  assert.deepEqual(
    requests.idle.map(({ nodeId }) => nodeId),
    ["sourced-note"],
  );
});

test("the app advances generations and defers remaining source requests", () => {
  assert.match(appSource, /sourceGenerationRef\.current \+= 1/);
  assert.match(appSource, /sourceGenerationAnnouncedRef/);
  assert.match(appSource, /onResolveAcademicSources/);
  assert.match(appSource, /requestIdleCallback/);
  assert.match(appSource, /setTimeout\([^,]+, 0\)/s);
  assert.match(appSource, /applySourceResolutionBatch/);
  assert.doesNotMatch(appSource, /sourceResolutionRequestId/);
});
