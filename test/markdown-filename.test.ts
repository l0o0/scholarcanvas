import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultMarkdownFilename,
  isMarkdownFilename,
  markdownAttachmentTitle,
  markdownDocumentTitle,
} from "../src/modules/markdown/detect";

const fixedTime = new Date(2026, 7, 13, 14, 35, 42);

test("builds a timestamped Note filename without spaces", () => {
  assert.equal(defaultMarkdownFilename(fixedTime), "Note-20260813-143542.md");
});

test("pads the local date and time including seconds", () => {
  assert.equal(
    defaultMarkdownFilename(new Date(2026, 0, 2, 3, 4, 5)),
    "Note-20260102-030405.md",
  );
});

test("uses the timestamped filename stem as the document title", () => {
  assert.equal(
    markdownDocumentTitle("Note-2026-08-13-14-35.md"),
    "Note-2026-08-13-14-35",
  );
  assert.equal(markdownDocumentTitle("Note.md"), "Note");
});

test("keeps the Markdown suffix on attachment titles without duplicating it", () => {
  assert.equal(markdownAttachmentTitle("Meeting notes"), "Meeting notes.md");
  assert.equal(markdownAttachmentTitle("Meeting notes.md"), "Meeting notes.md");
});

test("recognizes Markdown filenames and paths only", () => {
  for (const ok of [
    "note.md",
    "note.markdown",
    "note.mdown",
    "note.mkd",
    "note.mkdn",
    "Note.MD",
    "/vault/sub/note.md",
    "C:\\vault\\note.md",
  ]) {
    assert.equal(isMarkdownFilename(ok), true, ok);
  }
  for (const bad of [
    "",
    "note",
    "note.txt",
    "note.md.txt",
    "/etc/passwd",
    "assets/image.png",
    "note.md/",
  ]) {
    assert.equal(isMarkdownFilename(bad), false, bad);
  }
});
