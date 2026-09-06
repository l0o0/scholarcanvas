import {
  BUILTIN_NOTE_TEMPLATE_IDS,
  parseNoteTemplate,
  type NoteTemplate,
} from "../../../packages/whiteboard/src/model/note-template";

export const NOTE_TEMPLATE_SETTING = "bamboo.noteTemplates.v1";

export interface TemplateRegistryRecord {
  template?: NoteTemplate;
  deletedAt?: string;
}

export interface TemplateRegistry {
  version: 1;
  records: Record<string, TemplateRegistryRecord>;
}

export interface SyncedSettingsPort {
  get(libraryID: number, setting: string): unknown;
  set(
    libraryID: number,
    setting: string,
    value: unknown,
  ): Promise<boolean | void>;
  onSyncDownload: {
    addListener(
      libraryID: number,
      setting: string,
      listener: (
        oldValue: unknown,
        newValue: unknown,
        conflict: boolean,
      ) => void | Promise<void>,
    ): void;
  };
}

export interface NoteTemplateRepository {
  list(): NoteTemplate[];
  save(template: NoteTemplate): Promise<void>;
  remove(templateId: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export function createNoteTemplateRepository(options: {
  libraryID: number;
  settings: SyncedSettingsPort;
  setting?: string;
  now?: () => string;
  conflictCopyLabel?: string;
}): NoteTemplateRepository {
  const setting = options.setting ?? NOTE_TEMPLATE_SETTING;
  const now = options.now ?? (() => new Date().toISOString());
  const listeners = new Set<() => void>();
  const read = () =>
    parseTemplateRegistry(options.settings.get(options.libraryID, setting));
  const notify = () => listeners.forEach((listener) => listener());

  options.settings.onSyncDownload.addListener(
    options.libraryID,
    setting,
    async (oldValue, newValue, conflict) => {
      if (conflict) {
        const merged = mergeTemplateRegistries(
          oldValue,
          newValue,
          options.conflictCopyLabel,
        );
        if (!sameJson(merged, parseTemplateRegistry(newValue))) {
          await options.settings.set(options.libraryID, setting, merged);
        }
      }
      notify();
    },
  );

  return {
    list() {
      return Object.values(read().records)
        .map((record) => record.template)
        .filter((template): template is NoteTemplate => Boolean(template))
        .sort(
          (a, b) =>
            (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
              (b.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
            a.name.localeCompare(b.name) ||
            a.id.localeCompare(b.id),
        );
    },
    async save(value) {
      const template = parseNoteTemplate(value);
      if (!template || isBuiltinTemplateId(template.id)) {
        throw new Error("Invalid custom Note template.");
      }
      const registry = read();
      registry.records[template.id] = { template };
      await options.settings.set(options.libraryID, setting, registry);
      notify();
    },
    async remove(templateId) {
      if (!templateId || isBuiltinTemplateId(templateId)) return;
      const registry = read();
      registry.records[templateId] = { deletedAt: now() };
      await options.settings.set(options.libraryID, setting, registry);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function mergeTemplateRegistries(
  localValue: unknown,
  remoteValue: unknown,
  conflictCopyLabel = "Conflict copy",
): TemplateRegistry {
  const local = parseTemplateRegistry(localValue);
  const remote = parseTemplateRegistry(remoteValue);
  const records: Record<string, TemplateRegistryRecord> = {
    ...remote.records,
  };
  for (const [id, localRecord] of Object.entries(local.records)) {
    const remoteRecord = records[id];
    if (!remoteRecord) {
      records[id] = cloneRecord(localRecord);
      continue;
    }
    const comparison = recordTime(localRecord).localeCompare(
      recordTime(remoteRecord),
    );
    if (comparison > 0) {
      records[id] = cloneRecord(localRecord);
      continue;
    }
    if (comparison < 0 || sameJson(localRecord, remoteRecord)) continue;
    if (!localRecord.template) continue;
    const conflictId = `${id}.conflict.${shortHash(JSON.stringify(localRecord))}`;
    if (!records[conflictId]) {
      records[conflictId] = {
        template: {
          ...localRecord.template,
          id: conflictId,
          name: `${localRecord.template.name} (${conflictCopyLabel})`,
          style: { ...localRecord.template.style },
          ...(localRecord.template.defaultSize
            ? { defaultSize: { ...localRecord.template.defaultSize } }
            : {}),
        },
      };
    }
  }
  return { version: 1, records };
}

export function parseTemplateRegistry(value: unknown): TemplateRegistry {
  const records: Record<string, TemplateRegistryRecord> = {};
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.records)) {
    return { version: 1, records };
  }
  for (const [id, candidate] of Object.entries(value.records)) {
    if (!id || !isRecord(candidate)) continue;
    const template = parseNoteTemplate(candidate.template);
    if (template?.id === id) {
      records[id] = { template };
      continue;
    }
    if (
      typeof candidate.deletedAt === "string" &&
      Number.isFinite(Date.parse(candidate.deletedAt))
    ) {
      records[id] = { deletedAt: candidate.deletedAt };
    }
  }
  return { version: 1, records };
}

function recordTime(record: TemplateRegistryRecord): string {
  return record.template?.updatedAt ?? record.deletedAt ?? "";
}

function cloneRecord(record: TemplateRegistryRecord): TemplateRegistryRecord {
  return record.template
    ? {
        template: {
          ...record.template,
          style: { ...record.template.style },
          ...(record.template.defaultSize
            ? { defaultSize: { ...record.template.defaultSize } }
            : {}),
        },
      }
    : { deletedAt: record.deletedAt };
}

function isBuiltinTemplateId(id: string): boolean {
  return Object.values(BUILTIN_NOTE_TEMPLATE_IDS).includes(
    id as (typeof BUILTIN_NOTE_TEMPLATE_IDS)[keyof typeof BUILTIN_NOTE_TEMPLATE_IDS],
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

let zoteroRepository: NoteTemplateRepository | undefined;

export function getZoteroNoteTemplateRepository(
  conflictCopyLabel = "Conflict copy",
): NoteTemplateRepository {
  if (zoteroRepository) return zoteroRepository;
  const zotero = Zotero as typeof Zotero & {
    SyncedSettings: SyncedSettingsPort;
  };
  zoteroRepository = createNoteTemplateRepository({
    libraryID: zotero.Libraries.userLibraryID,
    settings: zotero.SyncedSettings,
    conflictCopyLabel,
  });
  return zoteroRepository;
}
