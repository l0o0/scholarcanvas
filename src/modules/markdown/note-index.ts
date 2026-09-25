import { extractNoteLinks, type NoteDocument } from "./note-links";

/** Rebuildable cache only. Markdown files remain the source of truth. */
export class NoteIndex {
  private tail: Promise<unknown> = Promise.resolve();
  private db?: _ZoteroTypes.DB;
  private closing = false;
  private unavailable = false;

  constructor(
    private readonly connect: () =>
      _ZoteroTypes.DB | undefined | Promise<_ZoteroTypes.DB | undefined>,
  ) {}

  private run<T>(
    fallback: T,
    operation: (db: _ZoteroTypes.DB) => Promise<T>,
  ): Promise<T> {
    if (this.closing || this.unavailable) return Promise.resolve(fallback);
    const result = this.tail.then(async () => {
      try {
        if (this.unavailable) return fallback;
        if (!this.db) {
          const db = await this.connect();
          if (!db) return fallback;
          this.db = db;
          const version = Number(
            await db.valueQueryAsync("PRAGMA user_version"),
          );
          if (version !== 0 && version !== 1)
            throw new Error(`Unsupported note index version: ${version}`);
          await db.executeTransaction(async () => {
            await db.queryAsync(`CREATE TABLE IF NOT EXISTS notes (
              libraryID INTEGER NOT NULL, noteKey TEXT NOT NULL,
              filename TEXT NOT NULL, title TEXT NOT NULL, groupID INTEGER,
              path TEXT, modified REAL, size INTEGER, content TEXT NOT NULL,
              PRIMARY KEY (libraryID, noteKey))`);
            await db.queryAsync(`CREATE TABLE IF NOT EXISTS links (
              libraryID INTEGER NOT NULL, noteKey TEXT NOT NULL,
              position INTEGER NOT NULL, endPosition INTEGER NOT NULL,
              href TEXT NOT NULL, label TEXT NOT NULL, syntax TEXT NOT NULL,
              PRIMARY KEY (libraryID, noteKey, position, endPosition))`);
            await db.queryAsync("PRAGMA user_version = 1");
          });
        }
        return await operation(this.db);
      } catch (error) {
        // A cache error must never turn a successful Markdown save into a failure.
        this.unavailable = true;
        (globalThis as any).Zotero?.logError?.(error);
        return fallback;
      }
    });
    this.tail = result;
    return result;
  }

  load(libraryID: number): Promise<NoteDocument[]> {
    return this.run([], async (db) => {
      const rows = await db.queryAsync(
        "SELECT * FROM notes WHERE libraryID=?",
        [libraryID],
      );
      const notes = new Map<string, NoteDocument>();
      for (const row of rows ?? []) {
        notes.set(row.noteKey, {
          libraryID,
          key: row.noteKey,
          filename: row.filename,
          title: row.title,
          ...(row.groupID != null ? { groupID: row.groupID } : {}),
          ...(row.path ? { path: row.path } : {}),
          ...(row.modified != null && row.size != null
            ? { fileModified: row.modified, fileSize: row.size }
            : {}),
          content: row.content,
          links: [],
        });
      }
      const links = await db.queryAsync(
        "SELECT * FROM links WHERE libraryID=? ORDER BY noteKey, position",
        [libraryID],
      );
      for (const row of links ?? [])
        notes.get(row.noteKey)?.links?.push({
          from: row.position,
          to: row.endPosition,
          href: row.href,
          label: row.label,
          syntax: row.syntax,
        });
      return [...notes.values()];
    });
  }

  private async write(db: _ZoteroTypes.DB, note: NoteDocument): Promise<void> {
    await db.queryAsync("DELETE FROM links WHERE libraryID=? AND noteKey=?", [
      note.libraryID,
      note.key,
    ]);
    if (note.readError) {
      await db.queryAsync("DELETE FROM notes WHERE libraryID=? AND noteKey=?", [
        note.libraryID,
        note.key,
      ]);
      return;
    }
    await db.queryAsync(
      `INSERT OR REPLACE INTO notes
      (libraryID, noteKey, filename, title, groupID, path, modified, size, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.libraryID,
        note.key,
        note.filename,
        note.title,
        note.groupID ?? null,
        note.path ?? null,
        note.fileModified ?? null,
        note.fileSize ?? null,
        note.content,
      ],
    );
    for (const link of note.links ?? extractNoteLinks(note.content)) {
      await db.queryAsync(
        `INSERT INTO links
        (libraryID, noteKey, position, endPosition, href, label, syntax)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          note.libraryID,
          note.key,
          link.from,
          link.to,
          link.href,
          link.label,
          link.syntax,
        ],
      );
    }
  }

  save(note: NoteDocument): Promise<void> {
    return this.run(undefined, (db) =>
      db.executeTransaction(() => this.write(db, note)),
    );
  }

  /** Reconcile deletions only after a successful, still-current library scan. */
  replace(
    libraryID: number,
    notes: NoteDocument[],
    isCurrent: () => boolean,
    force = false,
  ): Promise<void> {
    return this.run(undefined, async (db) => {
      if (!isCurrent()) return;
      await db
        .executeTransaction(async () => {
          // Throwing rolls back the whole scan if a save or invalidation overtakes it.
          const check = () => {
            if (!isCurrent()) throw new StaleScan();
          };
          check();
          const keys = new Set(notes.map((note) => note.key));
          const old = await db.queryAsync(
            "SELECT * FROM notes WHERE libraryID=?",
            [libraryID],
          );
          for (const row of old ?? [])
            if (!keys.has(row.noteKey)) {
              await db.queryAsync(
                "DELETE FROM links WHERE libraryID=? AND noteKey=?",
                [libraryID, row.noteKey],
              );
              await db.queryAsync(
                "DELETE FROM notes WHERE libraryID=? AND noteKey=?",
                [libraryID, row.noteKey],
              );
            }
          const existing = new Map(
            (old ?? []).map((row) => [row.noteKey, row]),
          );
          for (const note of notes) {
            check();
            const row = existing.get(note.key);
            if (
              !force &&
              row &&
              !note.readError &&
              row.filename === note.filename &&
              row.title === note.title &&
              row.groupID === (note.groupID ?? null) &&
              row.path === (note.path ?? null) &&
              row.modified === (note.fileModified ?? null) &&
              row.size === (note.fileSize ?? null) &&
              row.content === note.content
            )
              continue;
            await this.write(db, note);
          }
          check();
        })
        .catch((error) => {
          if (!(error instanceof StaleScan)) throw error;
        });
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.tail;
    try {
      await this.db?.closeDatabase(true);
    } catch (error) {
      (globalThis as any).Zotero?.logError?.(error);
    }
  }
}

class StaleScan extends Error {}

/** Prepare the plugin directory before opening SQLite. */
export async function connectNoteIndex(): Promise<_ZoteroTypes.DB | undefined> {
  const api = (globalThis as any).Zotero;
  if (
    !api?.DBConnection ||
    !api.DataDirectory?.dir ||
    typeof PathUtils === "undefined" ||
    typeof IOUtils === "undefined"
  )
    return undefined;
  const directory = PathUtils.join(api.DataDirectory.dir, "scholar-canvas");
  const path = PathUtils.join(directory, "scholar-canvas.sqlite");
  await IOUtils.makeDirectory(directory, { ignoreExisting: true });
  return new api.DBConnection(path);
}

let index: NoteIndex | undefined;
export function noteIndex(): NoteIndex {
  return (index ??= new NoteIndex(connectNoteIndex));
}

export async function closeNoteIndex(): Promise<void> {
  const current = index;
  await current?.close();
}
