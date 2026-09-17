import { isMarkdownAttachment } from "./detect";
import { isWhiteboardAttachment } from "../whiteboard/detect";
import { getString } from "../../utils/locale";
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

function candidateFromItem(item: Zotero.Item): DocumentLinkCandidate | null {
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
): Promise<DocumentLinkCandidate[]> {
  const needle = query.trim();
  if (!currentItem || !Number.isSafeInteger(currentItem.libraryID)) {
    return [];
  }
  const zotero = (globalThis as { Zotero?: any }).Zotero;
  const Search = zotero?.Search;
  if (typeof Search !== "function") return [];
  try {
    const search = new Search({ libraryID: currentItem.libraryID });
    // `title` is indexed metadata for regular items and attachments (including
    // .md/.canvas filenames); no file content is read during completion.
    search.addCondition("title", exact ? "is" : "contains", needle);
    const searchIDs = await search.search();
    const ids: number[] = Array.isArray(searchIDs) ? searchIDs : [];
    const allCandidates: DocumentLinkCandidate[] = [];
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
      allCandidates.push(
        ...items
          .filter((item) => item?.libraryID === currentItem.libraryID)
          .filter(
            (item) =>
              !(item as unknown as { isTrashed?: () => boolean }).isTrashed?.(),
          )
          .map(candidateFromItem)
          .filter((item): item is DocumentLinkCandidate => !!item),
      );
    }
    return allCandidates.slice(0, MAX_DOCUMENT_LINK_RESULTS);
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
  } = {},
): Promise<DocumentLinkOpenResult> {
  // Keep the exact persisted URI/wiki spelling for validation. External URLs
  // may still be normalized the same way the native launcher handles them.
  const value = typeof href === "string" ? href : "";
  const externalValue = value.trim();
  if (externalLink(externalValue)) {
    try {
      Zotero.launchURL(externalValue);
      return { status: "external" };
    } catch {
      return { status: "unsupported" };
    }
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
      return openResolvedCandidate(selected, options.win);
    }
    if (result.status !== "resolved") return result;
    return openResolvedCandidate(result.candidate, options.win);
  }

  const ref = parseDocumentLink(value);
  if (!ref) return { status: "unsupported" };
  const candidate = candidateForReference(ref);
  if (!candidate) return { status: "unresolved" };
  return openResolvedCandidate(candidate, options.win);
}

/** Host-owned navigation shared by tab, sidebar, and standalone sessions. */
export function navigateDocumentLink(
  item: Zotero.Item,
  win: Window,
  href: string,
): void {
  void openDocumentLink(href, {
    currentItem: item,
    win,
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
): Promise<DocumentLinkOpenResult> {
  const item =
    candidate.itemID != null ? Zotero.Items.get(candidate.itemID) : false;
  if (!item) return { status: "unresolved" };
  try {
    if (candidate.kind === "markdown") {
      const { openMarkdownAttachment } = await import("./open");
      if (await openMarkdownAttachment(item))
        return { status: "opened", candidate };
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
