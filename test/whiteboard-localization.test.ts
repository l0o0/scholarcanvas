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
