import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTE_TEMPLATE_SETTING,
  createNoteTemplateRepository,
  mergeTemplateRegistries,
  type SyncedSettingsPort,
} from "../src/modules/whiteboard/template-repository.ts";
import type { NoteTemplate } from "../packages/whiteboard/src/model/note-template.ts";

function template(id: string, name: string, updatedAt: string): NoteTemplate {
  return { id, name, style: {}, updatedAt };
}

function fakeSettings(initial: unknown = null) {
  let value = initial;
  let listener:
    | ((oldValue: unknown, newValue: unknown, conflict: boolean) => void)
    | undefined;
  const writes: unknown[] = [];
  const port: SyncedSettingsPort = {
    get: () => value,
    async set(_libraryID, _setting, next) {
      value = next;
      writes.push(next);
      return true;
    },
    onSyncDownload: {
      addListener(_libraryID, _setting, next) {
        listener = next;
      },
    },
  };
  return {
    port,
    writes,
    trigger(oldValue: unknown, newValue: unknown, conflict: boolean) {
      value = newValue;
      return listener?.(oldValue, newValue, conflict);
    },
  };
}

test("repository saves, lists, and tombstones custom templates", async () => {
  const settings = fakeSettings();
  const repository = createNoteTemplateRepository({
    libraryID: 1,
    settings: settings.port,
    now: () => "2026-09-06T03:00:00.000Z",
  });
  await repository.save(
    template("custom-1", "Question", "2026-09-06T01:00:00.000Z"),
  );
  assert.deepEqual(
    repository.list().map((item) => item.id),
    ["custom-1"],
  );

  await repository.remove("custom-1");
  assert.deepEqual(repository.list(), []);
  assert.equal(settings.writes.length, 2);
  assert.match(JSON.stringify(settings.writes[1]), /deletedAt/);
  assert.equal(NOTE_TEMPLATE_SETTING, "bamboo.noteTemplates.v1");
});

test("repository ignores malformed synchronized records", () => {
  const settings = fakeSettings({
    version: 1,
    records: {
      good: {
        template: template("good", "Good", "2026-09-06T01:00:00.000Z"),
      },
      bad: { template: { id: "", name: "Bad", style: {} } },
    },
  });
  const repository = createNoteTemplateRepository({
    libraryID: 1,
    settings: settings.port,
  });
  assert.deepEqual(
    repository.list().map((item) => item.id),
    ["good"],
  );
});

test("registry merge keeps independent IDs and the newer same-ID record", () => {
  const merged = mergeTemplateRegistries(
    {
      version: 1,
      records: {
        one: {
          template: template("one", "Old", "2026-09-06T01:00:00.000Z"),
        },
        local: {
          template: template("local", "Local", "2026-09-06T01:00:00.000Z"),
        },
      },
    },
    {
      version: 1,
      records: {
        one: {
          template: template("one", "New", "2026-09-06T02:00:00.000Z"),
        },
        remote: {
          template: template("remote", "Remote", "2026-09-06T01:00:00.000Z"),
        },
      },
    },
  );

  assert.equal(merged.records.one?.template?.name, "New");
  assert.ok(merged.records.local);
  assert.ok(merged.records.remote);
});

test("equal-time divergent edits preserve a deterministic conflict copy", () => {
  const at = "2026-09-06T02:00:00.000Z";
  const merged = mergeTemplateRegistries(
    {
      version: 1,
      records: { one: { template: template("one", "Local", at) } },
    },
    {
      version: 1,
      records: { one: { template: template("one", "Remote", at) } },
    },
    "Conflict copy",
  );
  const templates = Object.values(merged.records)
    .map((record) => record.template)
    .filter(Boolean);
  assert.equal(templates.length, 2);
  assert.ok(templates.some((item) => item?.name === "Remote"));
  assert.ok(templates.some((item) => item?.name === "Local (Conflict copy)"));
});

test("sync download notifies subscribers and merges an actual conflict", async () => {
  const local = {
    version: 1 as const,
    records: {
      local: {
        template: template("local", "Local", "2026-09-06T01:00:00.000Z"),
      },
    },
  };
  const remote = {
    version: 1 as const,
    records: {
      remote: {
        template: template("remote", "Remote", "2026-09-06T01:00:00.000Z"),
      },
    },
  };
  const settings = fakeSettings(local);
  const repository = createNoteTemplateRepository({
    libraryID: 1,
    settings: settings.port,
  });
  let notifications = 0;
  repository.subscribe(() => notifications++);

  await settings.trigger(local, remote, true);

  assert.deepEqual(
    repository.list().map((item) => item.id),
    ["local", "remote"],
  );
  assert.equal(notifications, 1);
  assert.equal(settings.writes.length, 1);
});
