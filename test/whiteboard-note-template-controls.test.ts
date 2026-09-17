import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteTemplateControls } from "../packages/whiteboard/src/chrome/NoteTemplateControls.tsx";
import { createAcademicNode } from "../packages/whiteboard/src/model/academic.ts";
import { createBuiltinNoteTemplates } from "../packages/whiteboard/src/model/note-template.ts";
import type { WhiteboardLabels } from "../packages/whiteboard/src/model/protocol.ts";

const labels = new Proxy({} as WhiteboardLabels, {
  get: (_target, property) => String(property),
});

test("selected Note controls expose badge, apply, save, and custom management", () => {
  const note = createAcademicNode("note", { x: 0, y: 0 }, "note-1", {
    badge: "问题",
  });
  const templates = [
    ...createBuiltinNoteTemplates({
      note: "Note",
      question: "Question",
      claim: "Claim",
      evidence: "Evidence",
      summary: "Summary",
    }),
    {
      id: "custom-1",
      name: "Hypothesis",
      badge: "H",
      style: {},
      updatedAt: "2026-09-06T00:00:00.000Z",
    },
  ];
  const markup = renderToStaticMarkup(
    createElement(NoteTemplateControls, {
      labels,
      note,
      templates,
      onBadgeChange: () => {},
      onTypeChange: () => {},
      onApply: () => {},
      onSave: () => {},
      onRename: () => {},
      onDuplicate: () => {},
      onDelete: () => {},
    }),
  );

  assert.match(markup, /badge/);
  assert.match(markup, /value="question" selected=""/);
  assert.match(markup, />addQuestion<\/option>/);
  assert.match(markup, />addEvidence<\/option>/);
  assert.match(markup, />addSummary<\/option>/);
  assert.match(markup, /<details[^>]*>[\s\S]*applyTemplate/);
  assert.match(markup, />Hypothesis<\/option>/);
  assert.match(markup, /saveAsTemplate/);
  assert.match(markup, /includeTemplateContent/);
  assert.match(markup, /duplicateTemplate/);
  assert.match(markup, /deleteTemplate/);
});
