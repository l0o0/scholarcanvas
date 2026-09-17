import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTE_TYPES,
  createAcademicNode,
  getNoteType,
  getNoteTitle,
  canvasNodeUiSurfaceDefaults,
} from "../packages/whiteboard/src/model/academic.ts";
import {
  BUILTIN_NOTE_TEMPLATES,
  changeNoteType,
  createCustomNoteTemplate,
  materializeNoteTemplate,
  parseNoteTemplate,
} from "../packages/whiteboard/src/model/note-template.ts";
import {
  canvasDocumentToFile,
  canvasFileToDocument,
} from "../packages/whiteboard/src/model/canvas-file.ts";
import { parseCanvasDocument } from "../packages/whiteboard/src/model/document.ts";

test("all five card types survive file save/reopen and custom template reuse", () => {
  const nodes = BUILTIN_NOTE_TEMPLATES.map((template, index) =>
    materializeNoteTemplate(
      template,
      { x: index * 300, y: 0 },
      `note-${index}`,
    ),
  );
  assert.deepEqual(nodes.map(getNoteType), NOTE_TYPES);
  const { document, issues } = canvasFileToDocument(
    canvasDocumentToFile({ version: 2, nodes, connections: [] }),
  );
  assert.deepEqual(issues, []);
  assert.deepEqual(document.nodes, nodes);
  for (const note of nodes) {
    assert.equal(
      note.content,
      "",
      "writing prompts are not stored as body text",
    );
    const template = createCustomNoteTemplate(note, {
      id: `custom-${note.id}`,
      name: "Reusable card",
      includeContent: true,
      updatedAt: "2026-09-16T00:00:00.000Z",
    });
    const copy = materializeNoteTemplate(
      parseNoteTemplate(template)!,
      { x: 0, y: 0 },
      "copy",
    );
    assert.equal(getNoteType(copy), getNoteType(note));
  }
});

test("changing type preserves the user's title, body, style, source, and geometry", () => {
  const note = {
    ...createAcademicNode("note", { x: 20, y: 30 }, "note-1", {
      noteType: "claim",
      badge: "My idea",
      content: "My reasoning",
      width: 310,
      height: 190,
      style: { fill: "#f4eadb", radius: 22 },
    }),
    source: { library: { type: "user" as const }, noteKey: "NOTE1234" },
    frameId: "frame-1",
    extensions: { custom: true },
  };
  for (const type of NOTE_TYPES) {
    assert.deepEqual(changeNoteType(note, type), { ...note, noteType: type });
  }
  assert.equal(note.noteType, "claim");
});

test("legacy roles display as types while custom titles and explicit choices win", () => {
  for (const badge of ["主张", "观点", "Claim", "Viewpoint"]) {
    const note = createAcademicNode("note", { x: 0, y: 0 }, "old", {
      badge,
      content: "Keep this",
    });
    assert.equal(getNoteType(note), "claim");
    assert.equal(getNoteTitle(note), undefined);
    const next = changeNoteType(note, "summary");
    assert.equal(next.badge, undefined);
    assert.equal(next.content, "Keep this");
    assert.equal(note.badge, badge);
  }
  const titled = createAcademicNode("note", { x: 0, y: 0 }, "new", {
    badge: "Question",
    noteType: "evidence",
  });
  assert.equal(getNoteType(titled), "evidence");
  assert.equal(getNoteTitle(titled), "Question");
  assert.equal(
    getNoteType({ ...titled, noteType: undefined, badge: "constructor" }),
    "note",
  );
});

test("malformed types are rejected at document and template boundaries", () => {
  const note = createAcademicNode("note", { x: 0, y: 0 }, "bad");
  const parsed = parseCanvasDocument({
    version: 2,
    nodes: [{ ...note, noteType: "unknown" }],
    connections: [],
  });
  assert.deepEqual(parsed.document.nodes, []);
  assert.equal(parsed.issues[0]?.code, "malformed-node");
  assert.equal(
    parseNoteTemplate({ ...BUILTIN_NOTE_TEMPLATES[0], noteType: "unknown" }),
    undefined,
  );
});

test("typed surfaces have distinct shapes/colors and equivalent dark geometry", () => {
  const light = NOTE_TYPES.map((type) =>
    canvasNodeUiSurfaceDefaults("note", "light", type),
  );
  assert.equal(new Set(light.map((style) => style.fill)).size, 5);
  for (const type of NOTE_TYPES) {
    const day = canvasNodeUiSurfaceDefaults("note", "light", type);
    const night = canvasNodeUiSurfaceDefaults("note", "dark", type);
    assert.notEqual(day.fill, night.fill);
    assert.equal(day.radius, night.radius);
    assert.equal(day.strokeStyle, night.strokeStyle);
  }
  assert.equal(light[1].strokeStyle, "dashed");
  assert.equal(light[2].strokeWidth, 2);
  assert.equal(light[3].radius, 4);
});
