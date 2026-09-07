import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const hostKeys = [
  "whiteboard-add-item",
  "whiteboard-canvas",
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
  "whiteboard-note-empty",
  "whiteboard-badge",
  "whiteboard-apply-template",
  "whiteboard-choose-template",
  "whiteboard-save-as-template",
  "whiteboard-template-name",
  "whiteboard-include-template-content",
  "whiteboard-custom-templates",
  "whiteboard-no-custom-templates",
  "whiteboard-rename-template",
  "whiteboard-duplicate-template",
  "whiteboard-delete-template",
  "whiteboard-template-conflict-copy",
  "whiteboard-kind-frame",
  "whiteboard-annotation-color",
  "whiteboard-annotations",
  "whiteboard-source-status",
  "whiteboard-source-idle",
  "whiteboard-source-available",
  "whiteboard-source-loading",
  "whiteboard-source-missing",
  "whiteboard-acquisition-summary",
  "whiteboard-drop-malformed",
  "whiteboard-drop-unsupported",
  "whiteboard-acquisition-failed",
  "whiteboard-source-open-failed",
  "whiteboard-source-refresh-failed",
  "whiteboard-failure-library-missing",
  "whiteboard-failure-item-missing",
  "whiteboard-failure-wrong-kind",
  "whiteboard-failure-parent-mismatch",
  "whiteboard-failure-attachment-unavailable",
  "whiteboard-failure-annotation-unavailable",
  "whiteboard-failure-resolution-failed",
  "whiteboard-failure-open-failed",
  "whiteboard-failure-list-failed",
  "whiteboard-selection",
  "whiteboard-note-refresh-failed",
  "whiteboard-open-source",
  "whiteboard-refresh-source",
  "whiteboard-refresh-note",
  "whiteboard-view-annotations",
  "whiteboard-annotation-browser-title",
  "whiteboard-search-annotations",
  "whiteboard-annotations-loading",
  "whiteboard-annotations-empty",
  "whiteboard-annotations-unavailable",
  "whiteboard-annotations-partial-failure",
  "whiteboard-annotation-already-added",
  "whiteboard-focus-existing-annotation",
  "whiteboard-add-selected-annotations",
  "whiteboard-annotation-page",
  "whiteboard-note-overwrite-title",
  "whiteboard-note-overwrite-body",
  "whiteboard-confirm",
  "whiteboard-cancel",
  "whiteboard-shortcut-question",
  "whiteboard-shortcut-claim",
  "whiteboard-shortcut-frame",
];

const tutorialLabels = [
  ["title", "whiteboard-tutorial-title"],
  ["welcome", "whiteboard-tutorial-welcome"],
  ["welcomeBody", "whiteboard-tutorial-welcome-body"],
  ["sourceNotice", "whiteboard-tutorial-source-notice"],
  ["addLiterature", "whiteboard-tutorial-add-literature"],
  ["addLiteratureBody", "whiteboard-tutorial-add-literature-body"],
  ["browseQuotes", "whiteboard-tutorial-browse-quotes"],
  ["browseQuotesBody", "whiteboard-tutorial-browse-quotes-body"],
  ["writeNote", "whiteboard-tutorial-write-note"],
  ["writeNoteBody", "whiteboard-tutorial-write-note-body"],
  ["questionBadge", "whiteboard-tutorial-question-badge"],
  ["claimBadge", "whiteboard-tutorial-claim-badge"],
  ["organize", "whiteboard-tutorial-organize"],
  ["organizeBody", "whiteboard-tutorial-organize-body"],
  ["practice", "whiteboard-tutorial-practice"],
  ["practiceBody", "whiteboard-tutorial-practice-body"],
  ["supports", "whiteboard-tutorial-supports"],
] as const;

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

test("both host locales define the complete tutorial label set", () => {
  const expectedKeys = tutorialLabels.map(([, key]) => key).sort();
  for (const locale of ["en-US", "zh-CN"]) {
    const source = readFileSync(`addon/locale/${locale}/addon.ftl`, "utf8");
    const actualKeys = [
      ...source.matchAll(/^(whiteboard-tutorial-[\w-]+)\s*=/gm),
    ]
      .map((match) => match[1])
      .sort();
    assert.deepEqual(actualKeys, expectedKeys, locale);
    assert.match(
      source,
      /^whiteboard-tutorial-title\s*=\s*\S.*\.canvas$/m,
      `${locale}: localized title must be a .canvas filename`,
    );
  }
});

test("the Chinese tutorial uses the UI term for Claim", () => {
  const source = readFileSync("addon/locale/zh-CN/addon.ftl", "utf8");
  assert.match(source, /^whiteboard-tutorial-claim-badge = 主张$/m);
  assert.match(
    source,
    /^whiteboard-tutorial-write-note-body = 从问题或主张模板开始，然后继续编辑。$/m,
  );
  assert.doesNotMatch(source, /^whiteboard-tutorial-.*论点/m);
});

test("host maps every tutorial label directly through typed localization", () => {
  const source = readFileSync("src/modules/whiteboard/tutorial.ts", "utf8");
  for (const [field, key] of tutorialLabels) {
    assert.match(
      source,
      new RegExp(`${field}:\\s*getString\\("${key}"\\)`),
      `${field}: ${key}`,
    );
  }
  assert.doesNotMatch(source, /FluentMessageId/);
});

test("library acquisition uses the Literature label in both host locales", () => {
  for (const [locale, expected] of [
    ["en-US", "Add literature"],
    ["zh-CN", "添加文献"],
  ]) {
    const source = readFileSync(`addon/locale/${locale}/addon.ftl`, "utf8");
    assert.match(
      source,
      new RegExp(`^whiteboard-add-item = ${expected}$`, "m"),
    );
  }
});

test("host wires every academic label into the whiteboard protocol", () => {
  const source = readFileSync("src/modules/whiteboard/tab.ts", "utf8");
  for (const [field, key] of [
    ["canvas", "whiteboard-canvas"],
    ["selection", "whiteboard-selection"],
    ["addQuestion", "whiteboard-add-question"],
    ["addClaim", "whiteboard-add-claim"],
    ["addFrame", "whiteboard-add-frame"],
    ["kindLiterature", "whiteboard-kind-literature"],
    ["kindQuote", "whiteboard-kind-quote"],
    ["kindNote", "whiteboard-kind-note"],
    ["emptyNote", "whiteboard-note-empty"],
    ["badge", "whiteboard-badge"],
    ["applyTemplate", "whiteboard-apply-template"],
    ["chooseTemplate", "whiteboard-choose-template"],
    ["saveAsTemplate", "whiteboard-save-as-template"],
    ["templateName", "whiteboard-template-name"],
    ["includeTemplateContent", "whiteboard-include-template-content"],
    ["customTemplates", "whiteboard-custom-templates"],
    ["noCustomTemplates", "whiteboard-no-custom-templates"],
    ["renameTemplate", "whiteboard-rename-template"],
    ["duplicateTemplate", "whiteboard-duplicate-template"],
    ["deleteTemplate", "whiteboard-delete-template"],
    ["kindFrame", "whiteboard-kind-frame"],
    ["annotationColor", "whiteboard-annotation-color"],
    ["sourceStatus", "whiteboard-source-status"],
    ["sourceIdle", "whiteboard-source-idle"],
    ["sourceAvailable", "whiteboard-source-available"],
    ["sourceLoading", "whiteboard-source-loading"],
    ["sourceMissing", "whiteboard-source-missing"],
    ["dropMalformed", "whiteboard-drop-malformed"],
    ["dropUnsupported", "whiteboard-drop-unsupported"],
    ["acquisitionFailed", "whiteboard-acquisition-failed"],
    ["sourceOpenFailed", "whiteboard-source-open-failed"],
    ["sourceRefreshFailed", "whiteboard-source-refresh-failed"],
    ["noteRefreshFailed", "whiteboard-note-refresh-failed"],
    ["failureLibraryMissing", "whiteboard-failure-library-missing"],
    ["failureItemMissing", "whiteboard-failure-item-missing"],
    ["failureWrongKind", "whiteboard-failure-wrong-kind"],
    ["failureParentMismatch", "whiteboard-failure-parent-mismatch"],
    [
      "failureAttachmentUnavailable",
      "whiteboard-failure-attachment-unavailable",
    ],
    [
      "failureAnnotationUnavailable",
      "whiteboard-failure-annotation-unavailable",
    ],
    ["failureResolutionFailed", "whiteboard-failure-resolution-failed"],
    ["failureOpenFailed", "whiteboard-failure-open-failed"],
    ["failureListFailed", "whiteboard-failure-list-failed"],
    ["openSource", "whiteboard-open-source"],
    ["refreshSource", "whiteboard-refresh-source"],
    ["refreshNote", "whiteboard-refresh-note"],
    ["viewAnnotations", "whiteboard-view-annotations"],
    ["annotationBrowserTitle", "whiteboard-annotation-browser-title"],
    ["searchAnnotations", "whiteboard-search-annotations"],
    ["annotationsLoading", "whiteboard-annotations-loading"],
    ["annotationsEmpty", "whiteboard-annotations-empty"],
    ["annotationsUnavailable", "whiteboard-annotations-unavailable"],
    ["annotationsPartialFailure", "whiteboard-annotations-partial-failure"],
    ["annotationAlreadyAdded", "whiteboard-annotation-already-added"],
    ["focusExistingAnnotation", "whiteboard-focus-existing-annotation"],
    ["addSelectedAnnotations", "whiteboard-add-selected-annotations"],
    ["annotationPage", "whiteboard-annotation-page"],
    ["noteOverwriteTitle", "whiteboard-note-overwrite-title"],
    ["noteOverwriteBody", "whiteboard-note-overwrite-body"],
    ["confirm", "whiteboard-confirm"],
    ["cancel", "whiteboard-cancel"],
    ["shortcutQuestion", "whiteboard-shortcut-question"],
    ["shortcutClaim", "whiteboard-shortcut-claim"],
    ["shortcutFrame", "whiteboard-shortcut-frame"],
  ]) {
    assert.match(
      source,
      new RegExp(`${field}:\\s*getString\\(\\s*"${key}"\\s*,?\\s*\\)`),
      `${field}: ${key}`,
    );
  }
  assert.match(
    source,
    /annotations:\s*\{[\s\S]*one:\s*getString\("whiteboard-annotations",\s*\{[\s\S]*count:\s*1[\s\S]*other:\s*getString\("whiteboard-annotations",\s*\{[\s\S]*count:\s*2/s,
  );
  assert.match(
    source,
    /acquisitionSummary:\s*getString\("whiteboard-acquisition-summary"/,
  );
});

test("multi-source summary is localized with both outcome counts", () => {
  for (const locale of ["en-US", "zh-CN"]) {
    const source = readFileSync(`addon/locale/${locale}/addon.ftl`, "utf8");
    const message = source.match(
      /^whiteboard-acquisition-summary\s*=([^\n]*(?:\n[ \t]+[^\n]*)*)/m,
    )?.[1];
    assert.ok(message, `${locale}: missing acquisition summary`);
    assert.match(message, /\$successCount/);
    assert.match(message, /\$failureCount/);
  }
});

test("annotation labels use Fluent plural selection", () => {
  for (const locale of ["en-US", "zh-CN"]) {
    const source = readFileSync(`addon/locale/${locale}/addon.ftl`, "utf8");
    const message = source.match(
      /^whiteboard-annotations\s*=([^\n]*(?:\n[ \t]+[^\n]*)*)/m,
    )?.[1];
    assert.ok(message, `${locale}: missing annotation selector`);
    assert.match(message, /\{\s*\$count\s*->/);
    assert.match(message, /\[one\]/);
    assert.match(message, /\*\[other\]/);
  }
});

test("host picker protocol keeps the Note toolbar local while accepting Zotero Notes generically", () => {
  const protocol = readFileSync(
    "packages/whiteboard/src/model/protocol.ts",
    "utf8",
  );
  const editor = readFileSync("src/modules/whiteboard/editor.ts", "utf8");
  const tab = readFileSync("src/modules/whiteboard/tab.ts", "utf8");
  assert.doesNotMatch(protocol, /"item" \| "pdf" \| "note" \| "attachment"/);
  assert.doesNotMatch(editor, /"item" \| "pdf" \| "note" \| "attachment"/);
  assert.match(tab, /item\.isRegularItem\(\) \|\| item\.isNote\(\)/);
  assert.doesNotMatch(protocol, /kind: "literature" \| "note"/);
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
