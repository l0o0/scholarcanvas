import { isPdfDocumentLink } from "./document-link-shared";
import { isMarkdownAttachment } from "./detect";
import { isWhiteboardAttachment } from "../whiteboard/detect";
import { getString } from "../../utils/locale";
import {
  noteHeadingPosition,
  noteHeadings,
  parseNoteLink,
  portableNoteFilename,
  resolveNoteLink,
  type NoteDocument,
  type PortableNote,
} from "./note-links";
import { noteMetadata, readLibraryNotes } from "./note-library";
export {
  buildDocumentLink,
  documentLinkTitle,
  parseDocumentLink,
  parseWikiLink,
} from "./document-link-shared";
import {
  buildDocumentLink,
  documentLinkTitle,
  parseDocumentLink,
  parseWikiLink,
  type DocumentLinkReference,
} from "./document-link-shared";

/** Maximum number of suggestions returned to an editor completion popup. */
export const MAX_DOCUMENT_LINK_RESULTS = 24;

export type DocumentLinkCandidateKind = "markdown" | "canvas" | "regular";

export interface DocumentLinkCandidate {
  key: string;
  libraryID: number;
  groupID?: number;
  title: string;
  kind: DocumentLinkCandidateKind;
  /** Localized label for UI surfaces; the stable kind remains machine-readable. */
  kindLabel?: string;
  href: string;
  /** Actual attachment filename for Markdown notes. */
  filename?: string;
  /** Optional heading selected by completion. */
  heading?: string;
  /** Internal item id is deliberately not serialized into the Markdown. */
  itemID?: number;
}

export function documentLinkKindLabel(kind: DocumentLinkCandidateKind): string {
  switch (kind) {
    case "markdown":
      return getString("document-link-kind-markdown");
    case "canvas":
      return getString("document-link-kind-canvas");
    case "regular":
      return getString("document-link-kind-regular");
  }
}

export type DocumentLinkSearchResult =
  | { status: "resolved"; candidate: DocumentLinkCandidate }
  | { status: "ambiguous"; candidates: DocumentLinkCandidate[] }
  | { status: "unresolved"; candidates: [] };

export type DocumentLinkOpenResult =
  | { status: "opened"; candidate?: DocumentLinkCandidate }
  | { status: "external" }
  | { status: "ambiguous"; candidates: DocumentLinkCandidate[] }
  | { status: "unresolved" }
  | { status: "unsupported" };

function reportDocumentLinkResult(result: DocumentLinkOpenResult): void {
  if (result.status === "opened" || result.status === "external") return;
  const text =
    result.status === "ambiguous"
      ? getString("document-link-ambiguous", {
          args: { count: result.candidates.length },
        })
      : result.status === "unresolved"
        ? getString("document-link-unresolved")
        : getString("document-link-unsupported");
  try {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({ text, type: "fail" })
      .show();
  } catch {
    ztoolkit.log("Bamboo document link unavailable", { status: result.status });
  }
}

function candidateTitle(item: Zotero.Item): string {
  const attachment = item.isAttachment();
  const filename = attachment ? item.attachmentFilename || "" : "";
  let title = "";
  try {
    title = String(item.getField("title") || "");
  } catch {
    // Some lightweight test/runtime item wrappers expose filename only.
  }
  const display = item.getDisplayTitle?.();
  // getDisplayTitle() is Promise-like in some Zotero versions. Completion is
  // metadata-only and must never leak "[object Promise]" as a title.
  const fallback =
    display &&
    typeof (display as unknown as { then?: unknown }).then !== "function"
      ? String(display)
      : item.key;
  return documentLinkTitle(title || filename || fallback);
}

function groupIDForLibrary(libraryID: number): number | false | null {
  const zotero = (globalThis as { Zotero?: any }).Zotero;
  if (!zotero || libraryID === zotero.Libraries?.userLibraryID) return false;
  try {
    const library = zotero.Libraries?.get(libraryID);
    if (
      library?.libraryType === "group" &&
      Number.isSafeInteger(library.groupID)
    ) {
      return library.groupID;
    }
    if (library?.libraryType && library.libraryType !== "group") return null;
  } catch {
    // Try the Groups cache below.
  }
  try {
    const groupID = zotero.Groups?.getGroupIDFromLibraryID?.(libraryID);
    return Number.isSafeInteger(groupID) && groupID > 0 ? groupID : null;
  } catch {
    return null;
  }
}

function portableHref(
  note: Pick<NoteDocument, "filename" | "key">,
  heading?: string,
): string {
  const target = encodeURI(portableNoteFilename(note));
  return heading ? `${target}#${encodeURIComponent(heading)}` : target;
}

function candidateFromNote(
  note: PortableNote,
  itemID?: number,
  heading?: string,
): DocumentLinkCandidate {
  const groupID = note.groupID;
  return {
    key: note.key,
    libraryID: note.libraryID,
    ...(groupID !== undefined ? { groupID } : {}),
    title: note.title,
    kind: "markdown",
    kindLabel: documentLinkKindLabel("markdown"),
    href: portableHref(note, heading),
    filename: note.filename,
    ...(heading ? { heading } : {}),
    ...(itemID !== undefined ? { itemID } : {}),
  };
}

function candidateFromItem(
  item: Zotero.Item,
  note?: PortableNote & { readError?: string },
  heading?: string,
): DocumentLinkCandidate | null {
  if (!item?.key || !Number.isSafeInteger(item.libraryID)) return null;
  let kind: DocumentLinkCandidateKind;
  if (isMarkdownAttachment(item)) kind = "markdown";
  else if (isWhiteboardAttachment(item)) kind = "canvas";
  else if ((item as any).isRegularItem?.()) kind = "regular";
  else return null;

  const groupID = groupIDForLibrary(item.libraryID);
  // Never turn an unknown group-library item into a personal-library URI.
  if (groupID === null) return null;
  let href: string;
  try {
    href = buildDocumentLink({
      key: item.key,
      libraryID: item.libraryID,
      isGroup: typeof groupID === "number",
      ...(typeof groupID === "number" ? { groupID } : {}),
    });
  } catch {
    return null;
  }
  if (kind === "markdown" && note) {
    return candidateFromNote(note, item.id, heading);
  }
  return {
    key: item.key,
    libraryID: item.libraryID,
    ...(typeof groupID === "number" ? { groupID } : {}),
    title: candidateTitle(item),
    kind,
    kindLabel: documentLinkKindLabel(kind),
    href,
    itemID: item.id,
  };
}

function noteQueryParts(query: string): { name: string; heading?: string } {
  const hash = query.indexOf("#");
  if (hash < 0) return { name: query.trim() };
  const name = query.slice(0, hash).trim();
  const heading = query.slice(hash + 1).trim();
  return { name, heading };
}

function aliasValues(note: Pick<NoteDocument, "title" | "filename">): string[] {
  const filename = note.filename.split(/[\\/]/).pop() || note.filename;
  return [
    note.title,
    note.filename,
    filename,
    filename.replace(/\.(?:md|markdown|mdown|mkd|mkdn)$/i, ""),
  ]
    .map((value) => value.trim().toLocaleLowerCase())
    .filter(Boolean);
}

function noteMatches(
  note: NoteDocument,
  query: string,
  exact: boolean,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return aliasValues(note).some((alias) =>
    exact ? alias === needle : alias.includes(needle),
  );
}

function headingMatches(value: string, query: string, exact: boolean): boolean {
  const left = value.trim().toLocaleLowerCase();
  const right = query.trim().toLocaleLowerCase();
  if (!right) return true;
  return exact ? left === right : left.includes(right);
}

function noteCandidatesForQuery(
  notes: readonly NoteDocument[],
  query: string,
  exact: boolean,
  itemIDs: ReadonlyMap<string, number | undefined> = new Map(),
): DocumentLinkCandidate[] {
  const parts = noteQueryParts(query);
  return notes
    .filter((note) => parts.heading === undefined || !note.readError)
    .filter((note) => noteMatches(note, parts.name, exact))
    .flatMap((note) => {
      if (parts.heading !== undefined) {
        return noteHeadings(note.content)
          .filter((value) => headingMatches(value.text, parts.heading!, exact))
          .map((heading) =>
            candidateFromNote(note, itemIDs.get(note.key), heading.text),
          );
      }
      return [candidateFromNote(note, itemIDs.get(note.key))];
    });
}

/** Pure, deterministic matching used by both completion and wiki navigation. */
export function searchLinkCandidates(
  candidates: readonly DocumentLinkCandidate[],
  query: string,
  exact = false,
): DocumentLinkSearchResult {
  const needle = query.trim().toLocaleLowerCase();
  const matches = candidates.filter((candidate) => {
    const title = candidate.title.toLocaleLowerCase();
    return exact ? title === needle : title.includes(needle);
  });
  if (matches.length === 1)
    return { status: "resolved", candidate: matches[0] };
  if (matches.length > 1)
    return {
      status: "ambiguous",
      candidates: matches.slice(0, MAX_DOCUMENT_LINK_RESULTS),
    };
  return { status: "unresolved", candidates: [] };
}

/**
 * Search metadata only. Zotero's indexed title search avoids reading every
 * attachment file; only a bounded set of item records is loaded afterward.
 */
export async function searchDocumentLinks(
  currentItem: Zotero.Item,
  query: string,
  exact = false,
  options: { currentContent?: string } = {},
): Promise<DocumentLinkCandidate[]> {
  const needle = query.trim();
  if (!currentItem || !Number.isSafeInteger(currentItem.libraryID)) {
    return [];
  }
  const zotero = (globalThis as { Zotero?: any }).Zotero;
  const Search = zotero?.Search;
  if (typeof Search !== "function") {
    try {
      let notes = await readLibraryNotes(currentItem.libraryID);
      const currentNote = noteMetadata(currentItem);
      if (options.currentContent !== undefined && currentNote) {
        notes = notes.map((note) =>
          note.key === currentNote.key
            ? {
                ...note,
                content: options.currentContent!,
                readError: undefined,
              }
            : note,
        );
      }
      return noteCandidatesForQuery(notes, needle, exact);
    } catch {
      const currentNote = noteMetadata(currentItem);
      if (options.currentContent !== undefined && currentNote) {
        return noteCandidatesForQuery(
          [{ ...currentNote, content: options.currentContent }],
          needle,
          exact,
        );
      }
      return [];
    }
  }
  try {
    const search = new Search({ libraryID: currentItem.libraryID });
    // `title` is indexed metadata for regular items and attachments (including
    // .md/.canvas filenames); no file content is read during completion.
    search.addCondition("title", exact ? "is" : "contains", needle);
    const searchIDs = await search.search();
    const ids: number[] = Array.isArray(searchIDs) ? searchIDs : [];
    const allCandidates: DocumentLinkCandidate[] = [];
    const metadataByKey = new Map<string, PortableNote>();
    // Search IDs are cheap metadata. Fetch in bounded chunks until enough
    // eligible document candidates are found, instead of dropping matches
    // merely because unrelated items precede them in the index.
    for (
      let offset = 0;
      offset < ids.length && allCandidates.length < MAX_DOCUMENT_LINK_RESULTS;
      offset += 48
    ) {
      const batchIDs = ids.slice(offset, offset + 48);
      const records = zotero.Items?.getAsync
        ? await zotero.Items.getAsync(batchIDs)
        : zotero.Items?.get?.(batchIDs) || [];
      const items: Zotero.Item[] = Array.isArray(records) ? records : [records];
      for (const item of items) {
        if (item?.libraryID !== currentItem.libraryID) continue;
        if ((item as unknown as { isTrashed?: () => boolean }).isTrashed?.())
          continue;
        // A Markdown file needs no body read to produce a portable href. Keep
        // this metadata fallback even if the lazy body index fails below.
        const metadata = noteMetadata(item);
        if (metadata) metadataByKey.set(metadata.key, metadata);
        const candidate = candidateFromItem(item, metadata || undefined);
        if (candidate) allCandidates.push(candidate);
      }
    }

    // Markdown candidates are enriched from the lazy note index. Metadata is
    // enough to emit a portable file link; a failed read only disables heading
    // completion and backlink discovery.
    let notes: NoteDocument[] = [];
    try {
      notes = await readLibraryNotes(currentItem.libraryID);
    } catch {
      // Metadata completion above remains useful without the index.
    }
    // Seed the body index with metadata-only notes. This makes a successful
    // Zotero metadata search useful even when reading one or more files fails.
    const noteByKey = new Map<string, NoteDocument>(
      [...metadataByKey.values()].map((note) => [
        note.key,
        { ...note, content: "", readError: "Note body unavailable" },
      ]),
    );
    for (const note of notes) noteByKey.set(note.key, note);
    if (options.currentContent !== undefined) {
      const currentNote = noteMetadata(currentItem);
      if (currentNote) {
        const existing = noteByKey.get(currentNote.key) || {
          ...currentNote,
          content: "",
          readError: "Note body unavailable",
        };
        noteByKey.set(currentNote.key, {
          ...existing,
          ...currentNote,
          content: options.currentContent,
          readError: undefined,
        });
      }
    }
    const effectiveNotes = [...noteByKey.values()];
    const itemByKey = new Map(
      allCandidates.map((candidate) => [candidate.key, candidate.itemID]),
    );
    const noteQuery = noteQueryParts(needle);
    const noteCandidates = noteCandidatesForQuery(
      effectiveNotes,
      needle,
      exact,
      itemByKey,
    );
    const enriched = allCandidates.flatMap((candidate) => {
      const note = noteByKey.get(candidate.key);
      if (!note) return [candidate];
      if (note.readError) {
        return noteQuery.heading !== undefined && candidate.kind === "markdown"
          ? []
          : [candidateFromNote(note, candidate.itemID)];
      }
      if (noteQuery.heading !== undefined) {
        return noteHeadings(note.content)
          .filter((value) =>
            headingMatches(value.text, noteQuery.heading!, exact),
          )
          .map((heading) =>
            candidateFromNote(note, candidate.itemID, heading.text),
          );
      }
      return [candidateFromNote(note, candidate.itemID)];
    });
    const merged = [
      ...enriched,
      ...noteCandidates.filter(
        (candidate) =>
          !enriched.some(
            (item) =>
              item.key === candidate.key && item.heading === candidate.heading,
          ),
      ),
    ];
    return merged.slice(0, MAX_DOCUMENT_LINK_RESULTS);
  } catch (error) {
    try {
      ztoolkit.log("Bamboo document-link search failed", error);
    } catch {
      // Search is best-effort; completion must never break editing.
    }
    return [];
  }
}

function externalLink(value: string): boolean {
  return /^(?:https?:|mailto:)/i.test(value.trim());
}

function candidateForReference(
  ref: DocumentLinkReference,
): DocumentLinkCandidate | null {
  const zotero = (globalThis as { Zotero?: any }).Zotero;
  const libraryID =
    ref.scope === "library"
      ? zotero?.Libraries?.userLibraryID
      : zotero?.Groups?.get?.(ref.groupID)?.libraryID;
  if (!Number.isSafeInteger(libraryID)) return null;
  const item = zotero?.Items?.getByLibraryAndKey?.(libraryID, ref.key);
  return item ? candidateFromItem(item) : null;
}

function itemForNote(
  note: Pick<NoteDocument, "libraryID" | "key">,
): Zotero.Item | false {
  const api = (globalThis as { Zotero?: any }).Zotero;
  try {
    return (
      api?.Items?.getByLibraryAndKey?.(note.libraryID, note.key) ||
      api?.Items?.getByLibraryAndKey?.(
        note.libraryID,
        note.key.toUpperCase(),
      ) ||
      false
    );
  } catch {
    return false;
  }
}

/**
 * Open a validated link. Callers can pass a search function to keep async
 * completion/navigation scoped to the current editor document.
 */
export async function openDocumentLink(
  href: string,
  options: {
    currentItem?: Zotero.Item;
    search?: (query: string) => Promise<DocumentLinkCandidate[]>;
    searchExact?: (query: string) => Promise<DocumentLinkCandidate[]>;
    chooseCandidate?: (
      candidates: readonly DocumentLinkCandidate[],
    ) => Promise<DocumentLinkCandidate | undefined>;
    win?: Window;
    /** Source occurrence to reveal when this link came from a backlink. */
    position?: number;
    /** Return true when the active surface handled navigation itself. */
    onNavigateNote?: (
      note: PortableNote,
      heading?: string,
      position?: number,
    ) => boolean | Promise<boolean>;
  } = {},
): Promise<DocumentLinkOpenResult> {
  // Keep the exact persisted URI/wiki spelling for validation. External URLs
  // may still be normalized the same way the native launcher handles them.
  const value = typeof href === "string" ? href : "";
  const externalValue = value.trim();
  if (externalLink(externalValue) || isPdfDocumentLink(value)) {
    try {
      Zotero.launchURL(externalValue);
      return { status: "external" };
    } catch {
      return { status: "unsupported" };
    }
  }

  const noteRef = parseNoteLink(value);
  if (noteRef && options.currentItem?.libraryID) {
    let notes: NoteDocument[] = [];
    try {
      notes = await readLibraryNotes(options.currentItem.libraryID);
    } catch {
      // Legacy title search below remains a safe fallback for wiki links.
      if (noteRef.syntax !== "wiki") return { status: "unresolved" };
    }
    const current =
      noteMetadata(options.currentItem) ||
      ({
        libraryID: options.currentItem.libraryID,
        key: options.currentItem.key || "",
        filename: "",
        title: "",
      } as PortableNote);
    const resolved = resolveNoteLink(
      noteRef.syntax === "wiki" ? value : externalValue,
      current,
      notes,
    );
    if (resolved.status === "resolved") {
      const targetItem = itemForNote(resolved.note);
      if (targetItem) {
        const candidate = candidateFromItem(
          targetItem,
          resolved.note,
          resolved.heading,
        );
        if (candidate) {
          return openResolvedCandidate(candidate, options.win, {
            heading: resolved.heading,
            position: options.position,
            note: resolved.note,
            onNavigateNote: options.onNavigateNote,
          });
        }
      }
      return { status: "unresolved" };
    }
    if (resolved.status === "ambiguous") {
      const candidates = resolved.notes
        .map((note) => {
          const item = itemForNote(note);
          return candidateFromNote(note, item ? item.id : undefined);
        })
        .filter(Boolean) as DocumentLinkCandidate[];
      if (options.chooseCandidate) {
        const selected = await options.chooseCandidate(candidates);
        if (selected) {
          const selectedNote = resolved.notes.find(
            (note) => note.key === selected.key,
          );
          if (selectedNote) {
            return openResolvedCandidate(selected, options.win, {
              note: selectedNote,
              heading: noteRef.heading,
              onNavigateNote: options.onNavigateNote,
              position: options.position,
            });
          }
        }
      }
      return { status: "ambiguous", candidates };
    }
    // A wiki link may still be an old title-only link. Let the legacy metadata
    // search below resolve that spelling; direct file links stay unresolved.
    if (noteRef.syntax !== "wiki") return { status: "unresolved" };
  }

  const wiki = parseWikiLink(value);
  if (wiki) {
    const candidates = await (options.searchExact && options.currentItem
      ? options.searchExact(wiki.name)
      : options.search && options.currentItem
        ? options.search(wiki.name)
        : searchDocumentLinks(
            options.currentItem as Zotero.Item,
            wiki.name,
            true,
          ));
    const result = searchLinkCandidates(candidates, wiki.name, true);
    if (result.status === "ambiguous" && options.chooseCandidate) {
      const selected = await options.chooseCandidate(result.candidates);
      if (!selected) return result;
      return openResolvedCandidate(selected, options.win, {
        position: options.position,
        onNavigateNote: options.onNavigateNote,
      });
    }
    if (result.status !== "resolved") return result;
    return openResolvedCandidate(result.candidate, options.win, {
      position: options.position,
      onNavigateNote: options.onNavigateNote,
    });
  }

  const ref = parseDocumentLink(value);
  if (!ref) return { status: "unsupported" };
  const candidate = candidateForReference(ref);
  if (!candidate) return { status: "unresolved" };
  return openResolvedCandidate(candidate, options.win, {
    position: options.position,
    onNavigateNote: options.onNavigateNote,
  });
}

/** Host-owned navigation shared by tab, sidebar, and standalone sessions. */
export function navigateDocumentLink(
  item: Zotero.Item,
  win: Window,
  href: string,
  navigation: {
    position?: number;
    onNavigateNote?: (
      note: PortableNote,
      heading?: string,
      position?: number,
    ) => boolean | Promise<boolean>;
  } = {},
): void {
  void openDocumentLink(href, {
    currentItem: item,
    win,
    ...navigation,
    search: (query) => searchDocumentLinks(item, query),
    searchExact: (query) => searchDocumentLinks(item, query, true),
    chooseCandidate: (candidates) =>
      chooseDocumentLinkCandidate(candidates, win),
  })
    .then(reportDocumentLinkResult)
    .catch((error) => {
      ztoolkit.log("Bamboo document link navigation failed", error);
      reportDocumentLinkResult({ status: "unresolved" });
    });
}

/**
 * Small host-owned chooser used when a title is not unique. The entered
 * number is an explicit user choice; no candidate is opened implicitly.
 */
export async function chooseDocumentLinkCandidate(
  candidates: readonly DocumentLinkCandidate[],
  win?: Window,
): Promise<DocumentLinkCandidate | undefined> {
  if (!candidates.length) return undefined;
  const promptOwner =
    win &&
    typeof (win as Window & { prompt?: typeof globalThis.prompt }).prompt ===
      "function"
      ? win
      : globalThis;
  const promptFn = (promptOwner as { prompt?: typeof globalThis.prompt })
    .prompt;
  if (typeof promptFn !== "function") return undefined;
  const choices = candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.title} · ${candidate.kindLabel || documentLinkKindLabel(candidate.kind)} [${candidate.key}]`,
    )
    .join("\n");
  const answer = promptFn.call(
    promptOwner,
    `${getString("document-link-choose")}\n${getString(
      "document-link-ambiguous",
      { args: { count: candidates.length } },
    )}\n${choices}`,
    "1",
  );
  if (answer == null) return undefined;
  const index = Number(answer.trim()) - 1;
  return Number.isSafeInteger(index) && index >= 0 && index < candidates.length
    ? candidates[index]
    : undefined;
}

async function openResolvedCandidate(
  candidate: DocumentLinkCandidate,
  win?: Window,
  options: {
    note?: PortableNote;
    heading?: string;
    position?: number;
    onNavigateNote?: (
      note: PortableNote,
      heading?: string,
      position?: number,
    ) => boolean | Promise<boolean>;
  } = {},
): Promise<DocumentLinkOpenResult> {
  const item =
    candidate.itemID != null ? Zotero.Items.get(candidate.itemID) : false;
  if (!item) return { status: "unresolved" };
  try {
    if (candidate.kind === "markdown") {
      const note = options.note || noteMetadata(item);
      if (note && options.onNavigateNote) {
        try {
          const handled = await options.onNavigateNote(
            note,
            options.heading,
            options.position,
          );
          if (handled) return { status: "opened", candidate };
        } catch {
          // Fall through to opening the target in the normal Markdown tab.
        }
      }
      const tabModule = await import("./tab");
      const { openMarkdownTab, refreshMarkdownSessionOnFocus } = tabModule;
      const suppliedWindow = win as
        | (_ZoteroTypes.MainWindow & {
            Zotero_Tabs?: { add?: unknown };
          })
        | undefined;
      const mainWindow = Zotero.getMainWindow?.() as
        | (_ZoteroTypes.MainWindow & { Zotero_Tabs?: { add?: unknown } })
        | undefined;
      const tabWindow =
        suppliedWindow && typeof suppliedWindow.Zotero_Tabs?.add === "function"
          ? suppliedWindow
          : mainWindow;
      if (!tabWindow || typeof tabWindow.Zotero_Tabs?.add !== "function") {
        return { status: "unresolved" };
      }
      const tabID = await openMarkdownTab(item, { win: tabWindow });
      if (tabID) {
        if (options.heading || options.position != null) {
          const { sessionRegistry } = await import("./session-registry");
          const session =
            sessionRegistry.get(tabID) ||
            (tabWindow
              ? sessionRegistry.find(tabWindow, item.id, "tab")
              : undefined);
          const editor = session?.editor;
          if (editor) {
            // Opening an existing tab starts document-sync refresh in the
            // background. Wait for it before reading the editor, otherwise a
            // heading/source position can be calculated against stale text.
            const pendingRefresh = session.documentSyncRefresh;
            if (pendingRefresh?.then) await pendingRefresh;
            else if (session.documentSyncSourceID)
              await refreshMarkdownSessionOnFocus(session);
            const value = editor.getValue();
            const target =
              options.position != null
                ? options.position
                : options.heading
                  ? noteHeadingPosition(value, options.heading)
                  : null;
            if (target != null && session) {
              const tabModule = (await import("./tab")) as unknown as {
                revealMarkdownSessionPosition?: (
                  session: unknown,
                  position: number,
                ) => void;
              };
              if (tabModule.revealMarkdownSessionPosition)
                tabModule.revealMarkdownSessionPosition(session, target);
              else editor.revealPosition(target);
            }
          }
        }
        return { status: "opened", candidate };
      }
    } else if (candidate.kind === "canvas") {
      const { openWhiteboardAttachment } = await import("../whiteboard/open");
      if (await openWhiteboardAttachment(item))
        return { status: "opened", candidate };
    } else {
      const pane =
        (win as _ZoteroTypes.MainWindow | undefined)?.ZoteroPane ||
        Zotero.getActiveZoteroPane?.();
      if (pane?.selectItem) {
        await pane.selectItem(item.id);
        return { status: "opened", candidate };
      }
    }
  } catch (error) {
    try {
      ztoolkit.log("Bamboo document-link open failed", error);
    } catch {
      // fall through to unresolved for a stale/deleted item
    }
  }
  return { status: "unresolved" };
}
