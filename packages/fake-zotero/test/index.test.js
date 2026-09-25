import assert from "node:assert/strict";
import test from "node:test";
import { createFakeZotero } from "../dist/index.js";

test("instances are isolated and reset restores a deep fixture snapshot", async () => {
  const first = createFakeZotero({
    prefs: { "extensions.zotero.demo.enabled": true },
    items: [
      { id: 1, key: "same", itemType: "journalArticle" },
      { id: 2, key: "child", itemType: "note", parentID: 1, note: "old" },
    ],
  });
  const second = createFakeZotero({
    items: [{ id: 9, key: "same", itemType: "book", libraryID: 2 }],
  });

  assert.equal(first.Zotero.Items.getByLibraryAndKey(1, "same").id, 1);
  assert.equal(second.Zotero.Items.getByLibraryAndKey(1, "same"), false);
  assert.equal(first.Zotero.Items.get(2).parentItem.id, 1);
  first.Zotero.Items.get(2).setNote("new");
  await first.Zotero.Items.get(2).saveTx();
  assert.equal(first.Zotero.Items.get(2).getNote(), "new");
  assert.equal(first.calls.at(-1).method, "item.saveTx");
  assert.equal(first.snapshot().items[1].note, "new");
  first.reset();
  assert.equal(first.Zotero.Items.get(2).getNote(), "old");
  assert.deepEqual(first.calls, []);
});

test("Prefs preserve the Zotero namespace and global flag", () => {
  const fake = createFakeZotero({
    prefs: { "extensions.zotero.demo.n": 1, "demo.global": false },
  });
  assert.equal(fake.Zotero.Prefs.get("demo.n"), 1);
  fake.Zotero.Prefs.set("demo.n", 2);
  assert.equal(fake.Zotero.Prefs.get("extensions.zotero.demo.n", true), 2);
  assert.equal(fake.Zotero.Prefs.get("demo.global", true), false);
  fake.Zotero.Prefs.clear("demo.n");
  assert.equal(fake.Zotero.Prefs.get("demo.n"), undefined);
});

test("install refuses existing values and restore protects replacements", () => {
  const fake = createFakeZotero();
  const target = {};
  const restore = fake.install(target);
  assert.equal(target.Zotero, fake.Zotero);
  target.Zotero = { replacement: true };
  restore();
  assert.deepEqual(target.Zotero, { replacement: true });
  assert.throws(() => fake.install(target), /overwrite/);
  delete target.Zotero;
  const restoreAgain = fake.install(target);
  restoreAgain();
  assert.equal("Zotero" in target, false);
});
