import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(path, "utf8");

test("uses Scholar Canvas branding with stable Bamboo compatibility identifiers", async () => {
  const pkg = JSON.parse(await read("package.json"));

  assert.equal(pkg.name, "scholarcanvas");
  assert.equal(pkg.config.addonName, "Scholar Canvas");
  assert.equal(pkg.config.addonID, "bamboo@@linxzh.com");
  assert.equal(pkg.config.addonRef, "bamboo");
  assert.equal(pkg.config.addonInstance, "scholarcanvas");
  assert.equal(pkg.config.prefsPrefix, "extensions.zotero.bamboo");
  assert.equal(pkg.repository.url, "git+https://github.com/l0o0/bamboo.git");
  assert.equal(pkg.bugs.url, "https://github.com/l0o0/bamboo/issues");
  assert.equal(pkg.homepage, "https://github.com/l0o0/bamboo#readme");
});

test("uses packaged branding icons and a theme-aware Markdown sidebar icon", async () => {
  const [manifestText, ...sources] = await Promise.all([
    read("addon/manifest.json"),
    read("src/hooks.ts"),
    read("src/modules/markdown/menu.ts"),
    read("src/modules/whiteboard/menu.ts"),
    read("src/utils/ztoolkit.ts"),
  ]);
  await access("addon/content/icons/favicon.png");
  const manifest = JSON.parse(manifestText);
  const combined = [manifestText, ...sources].join("\n");

  assert.equal(manifest.name, "__addonName__ — Markdown & Whiteboard");
  assert.equal(manifest.icons["48"], "content/icons/favicon.png");
  assert.equal(manifest.icons["96"], "content/icons/favicon.png");
  for (const source of sources) assert.match(source, /favicon\.png/);
  assert.doesNotMatch(combined, /favicon(?:\.svg|@0\.5x\.png)/);
  const sidebar = await read("src/modules/markdown/sidebar.ts");
  assert.match(sidebar, /sidebar-markdown/);
  await access("addon/content/icons/sidebar-markdown.svg");
  await access("addon/content/icons/sidebar-markdown-dark.svg");
});

test("does not register or document the legacy runtime namespace", async () => {
  const sources = await Promise.all([
    read("src/index.ts"),
    read("src/hooks.ts"),
    read("src/utils/locale.ts"),
    read("src/modules/markdown/api.ts"),
  ]);

  assert.doesNotMatch(sources.join("\n"), /ZoteroMarkdown/);
});

test("packaged chrome pages use the Bamboo content namespace", async () => {
  const pages = await Promise.all([
    read("addon/content/editor/index.html"),
    read("addon/content/whiteboard/index.html"),
  ]);
  const combined = pages.join("\n");

  assert.match(combined, /chrome:\/\/bamboo\/content\//);
  assert.doesNotMatch(combined, /chrome:\/\/zoteromarkdown\/content\//);
});

test("uses a versioned Scholar Canvas XPI name in build and CI", async () => {
  const scaffold = await read("zotero-plugin.config.ts");
  const [ci, release] = await Promise.all([
    read(".github/workflows/ci.yml"),
    read(".github/workflows/release.yml"),
  ]);

  assert.match(scaffold, /xpiName:\s*`scholarcanvas-v\$\{pkg\.version\}`/);
  for (const workflow of [ci, release]) {
    assert.match(workflow, /id:\s*package/);
    assert.match(
      workflow,
      /name:\s*scholarcanvas-v\$\{\{ steps\.package\.outputs\.version \}\}\.xpi/,
    );
    assert.match(
      workflow,
      /\.scaffold\/build\/scholarcanvas-v\$\{\{ steps\.package\.outputs\.version \}\}\.xpi/,
    );
    assert.doesNotMatch(workflow, /zotero-markdown-xpi/);
    assert.doesNotMatch(workflow, /name:\s*build-result/);
  }
});

test("documents repository and Scholar Canvas public API", async () => {
  const readmes = await Promise.all([
    read("README.md"),
    read("doc/README-zhCN.md"),
  ]);
  const combined = readmes.join("\n");

  assert.match(combined, /github\.com\/l0o0\/bamboo\/releases/);
  assert.match(combined, /Zotero\.scholarcanvas\.api\.markdown/);
  assert.match(combined, /Zotero\.scholarcanvas\.api\.version/);
  assert.doesNotMatch(combined, /github\.com\/l0o0\/zotero-markdown/);
  assert.doesNotMatch(combined, /Zotero\.ZoteroMarkdown/);
});

test("current architecture docs describe Scholar Canvas with the stable chrome namespace", async () => {
  const docs = await Promise.all([
    read("docs/architecture.md"),
    read("docs/editor/codemirror-iframe-plan.md"),
  ]);
  const combined = docs.join("\n");

  assert.match(combined, /Scholar Canvas/);
  assert.doesNotMatch(combined, /chrome:\/\/zoteromarkdown/);
  assert.doesNotMatch(combined, /content\/scripts\/zoteromarkdown\.js/);
});
