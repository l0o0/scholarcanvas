import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const hostKeys = [
  "whiteboard-board",
  "whiteboard-select",
  "whiteboard-hand",
  "whiteboard-more",
  "whiteboard-shortcuts-title",
  "whiteboard-close",
  "whiteboard-stroke",
  "whiteboard-background",
  "whiteboard-style",
  "whiteboard-solid",
  "whiteboard-dashed",
  "whiteboard-corners",
  "whiteboard-format",
  "whiteboard-color",
  "whiteboard-size",
  "whiteboard-alignment",
  "whiteboard-text-alignment",
  "whiteboard-vertical-alignment",
  "whiteboard-font-system",
  "whiteboard-font-georgia",
  "whiteboard-font-times",
  "whiteboard-font-inter",
  "whiteboard-font-menlo",
  "whiteboard-font-serif-sc",
  "whiteboard-weight-regular",
  "whiteboard-weight-bold",
  "whiteboard-colors-common",
  "whiteboard-colors-recent",
  "whiteboard-shortcut-select",
  "whiteboard-shortcut-hand",
  "whiteboard-shortcut-rect",
  "whiteboard-shortcut-ellipse",
  "whiteboard-shortcut-arrow",
  "whiteboard-shortcut-line",
  "whiteboard-shortcut-text",
  "whiteboard-shortcut-eraser",
  "whiteboard-shortcut-constrain",
  "whiteboard-shortcut-cancel",
  "whiteboard-shortcut-delete",
  "whiteboard-shortcut-undo",
  "whiteboard-shortcut-redo",
  "whiteboard-add-question",
  "whiteboard-add-claim",
  "whiteboard-add-frame",
  "whiteboard-kind-literature",
  "whiteboard-kind-quote",
  "whiteboard-kind-note",
  "whiteboard-kind-question",
  "whiteboard-kind-claim",
  "whiteboard-kind-frame",
  "whiteboard-annotations",
  "whiteboard-shortcut-question",
  "whiteboard-shortcut-claim",
  "whiteboard-shortcut-frame",
];

test("both host locales define every whiteboard chrome label", () => {
  for (const locale of ["en-US", "zh-CN"]) {
    const source = readFileSync(`addon/locale/${locale}/addon.ftl`, "utf8");
    for (const key of hostKeys) {
      assert.match(
        source,
        new RegExp(`^${key}\\s*=`, "m"),
        `${locale}: ${key}`,
      );
    }
  }
});

test("host wires every academic label into the whiteboard protocol", () => {
  const source = readFileSync("src/modules/whiteboard/tab.ts", "utf8");
  for (const [field, key] of [
    ["addQuestion", "whiteboard-add-question"],
    ["addClaim", "whiteboard-add-claim"],
    ["addFrame", "whiteboard-add-frame"],
    ["kindLiterature", "whiteboard-kind-literature"],
    ["kindQuote", "whiteboard-kind-quote"],
    ["kindNote", "whiteboard-kind-note"],
    ["kindQuestion", "whiteboard-kind-question"],
    ["kindClaim", "whiteboard-kind-claim"],
    ["kindFrame", "whiteboard-kind-frame"],
    ["annotations", "whiteboard-annotations"],
    ["shortcutQuestion", "whiteboard-shortcut-question"],
    ["shortcutClaim", "whiteboard-shortcut-claim"],
    ["shortcutFrame", "whiteboard-shortcut-frame"],
  ]) {
    assert.match(
      source,
      new RegExp(`${field}: getString\\("${key}"\\)`),
      `${field}: ${key}`,
    );
  }
});

test("host picker protocol excludes local academic notes", () => {
  const protocol = readFileSync(
    "packages/whiteboard/src/model/protocol.ts",
    "utf8",
  );
  const editor = readFileSync("src/modules/whiteboard/editor.ts", "utf8");
  const tab = readFileSync("src/modules/whiteboard/tab.ts", "utf8");
  assert.doesNotMatch(protocol, /"item" \| "pdf" \| "note" \| "attachment"/);
  assert.doesNotMatch(editor, /"item" \| "pdf" \| "note" \| "attachment"/);
  assert.doesNotMatch(tab, /if \(kind === "note"\)/);
});

test("isolated whiteboard package contains no hard-coded CJK text", () => {
  const root = "packages/whiteboard/src";
  const files = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `${root}/${file}`);
  const offenders = files.filter((file) =>
    /[\u3400-\u9fff]/u.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(offenders, []);
});
