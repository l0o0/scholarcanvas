import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILTIN_NOTE_TEMPLATE_IDS,
  applyNoteTemplate,
  createBuiltinNoteTemplates,
  createCustomNoteTemplate,
  materializeNoteTemplate,
  parseNoteTemplate,
  parseNoteTemplateRegistry,
} from "../packages/whiteboard/src/model/note-template.ts";
import { createAcademicNode } from "../packages/whiteboard/src/model/academic.ts";

test("built-in Question and Claim templates remain ordinary Notes", () => {
  const templates = createBuiltinNoteTemplates({
    note: "笔记",
    question: "问题",
    claim: "观点",
  });
  assert.deepEqual(
    templates.map((template) => template.id),
    [
      BUILTIN_NOTE_TEMPLATE_IDS.note,
      BUILTIN_NOTE_TEMPLATE_IDS.question,
      BUILTIN_NOTE_TEMPLATE_IDS.claim,
    ],
  );

  const question = materializeNoteTemplate(
    templates[1]!,
    { x: 12, y: 24 },
    "note-1",
  );
  assert.equal(question.kind, "note");
  assert.equal(question.badge, "问题");
  assert.equal(question.content, "");
  assert.notEqual(question.style, templates[1]!.style);
});

test("template parsing allowlists style and rejects malformed identity", () => {
  assert.equal(
    parseNoteTemplate({ id: "", name: "Bad", style: {} }),
    undefined,
  );
  assert.equal(
    parseNoteTemplate({ id: "custom-1", name: "", style: {} }),
    undefined,
  );
  const parsed = parseNoteTemplate({
    id: "custom-1",
    name: "Hypothesis",
    badge: "H",
    initialContent: "If … then …",
    style: {
      fill: "#fff7d6",
      strokeWidth: 2,
      fontWeight: "bold",
      arbitraryCss: "position: fixed",
    },
    defaultSize: { width: 280, height: 140 },
    sortOrder: 2,
    updatedAt: "2026-09-06T00:00:00.000Z",
    script: "alert(1)",
  });

  assert.deepEqual(parsed, {
    id: "custom-1",
    name: "Hypothesis",
    badge: "H",
    initialContent: "If … then …",
    style: { fill: "#fff7d6", strokeWidth: 2, fontWeight: "bold" },
    defaultSize: { width: 280, height: 140 },
    sortOrder: 2,
    updatedAt: "2026-09-06T00:00:00.000Z",
  });
});

test("registry parsing keeps only valid custom templates", () => {
  const parsed = parseNoteTemplateRegistry([
    {
      id: "custom-1",
      name: "One",
      style: {},
      updatedAt: "2026-09-06T00:00:00.000Z",
    },
    { id: "", name: "Bad", style: {} },
    null,
  ]);
  assert.deepEqual(
    parsed.map((template) => template.id),
    ["custom-1"],
  );
});

test("materialization copies starter content, style, and dimensions", () => {
  const template = parseNoteTemplate({
    id: "custom-1",
    name: "Prompt",
    badge: "问题",
    initialContent: "Why?",
    style: { fill: "#fff7d6", textAlign: "center" },
    defaultSize: { width: 300, height: 180 },
    updatedAt: "2026-09-06T00:00:00.000Z",
  })!;
  const note = materializeNoteTemplate(template, { x: 3, y: 4 }, "note-1");

  assert.deepEqual(note, {
    id: "note-1",
    kind: "note",
    position: { x: 3, y: 4 },
    width: 300,
    height: 180,
    content: "Why?",
    badge: "问题",
    style: { fill: "#fff7d6", textAlign: "center" },
  });
});

test("applying a template preserves content, source, identity, and extensions", () => {
  const note = {
    ...createAcademicNode("note", { x: 10, y: 20 }, "note-1", {
      content: "My local text",
      badge: "旧",
      style: { fill: "#eeeeee" },
      width: 260,
      height: 152,
    }),
    frameId: "frame-1",
    source: {
      library: { type: "user" as const },
      noteKey: "NOTE1234",
      itemKey: "ITEM1234",
    },
    sourceSnapshot: { title: "Original" },
    extensions: { plugin: { value: 1 } },
  };
  const template = parseNoteTemplate({
    id: "custom-1",
    name: "Claim",
    badge: "观点",
    initialContent: "Must not replace",
    style: { fill: "#eef5ff", fontWeight: "bold" },
    defaultSize: { width: 300, height: 120 },
    updatedAt: "2026-09-06T00:00:00.000Z",
  })!;

  const next = applyNoteTemplate(note, template);
  assert.equal(next.content, "My local text");
  assert.deepEqual(next.source, note.source);
  assert.deepEqual(next.sourceSnapshot, note.sourceSnapshot);
  assert.deepEqual(next.extensions, note.extensions);
  assert.deepEqual(next.position, note.position);
  assert.equal(next.frameId, "frame-1");
  assert.equal(next.badge, "观点");
  assert.deepEqual(next.style, { fill: "#eef5ff", fontWeight: "bold" });
  assert.equal(next.width, 300);
  assert.equal(next.height, 120);
});

test("saving a Note captures only safe reusable values", () => {
  const note = {
    ...createAcademicNode("note", { x: 10, y: 20 }, "note-1", {
      content: "Reusable prompt",
      badge: "方法",
      style: { fill: "#f3f4f6", fontStyle: "italic" },
      width: 288,
      height: 144,
    }),
    source: { library: { type: "user" as const }, noteKey: "NOTE1234" },
    extensions: { private: true },
  };
  const template = createCustomNoteTemplate(note, {
    id: "custom-1",
    name: "Method",
    includeContent: true,
    updatedAt: "2026-09-06T00:00:00.000Z",
  });

  assert.deepEqual(template, {
    id: "custom-1",
    name: "Method",
    badge: "方法",
    initialContent: "Reusable prompt",
    style: { fill: "#f3f4f6", fontStyle: "italic" },
    defaultSize: { width: 288, height: 144 },
    updatedAt: "2026-09-06T00:00:00.000Z",
  });
});
