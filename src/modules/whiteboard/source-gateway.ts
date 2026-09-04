import type {
  AnnotationCandidate,
  AcademicAcquisition,
  AcademicSourceDescriptor,
  LiteratureSource,
  NoteSource,
  SourceResolutionResult,
} from "../../../packages/whiteboard/src/model";

export interface SourceGatewayDependencies {
  userLibraryID: number;
  getLibrary(
    libraryID: number,
  ): { libraryType: string; groupID?: number } | null;
  groupLibraryID(groupID: number): number | null;
  getByLibraryAndKey(libraryID: number, key: string): Zotero.Item | null;
  cleanTags(html: string): string;
  unescapeHTML(html: string): string;
  openItem(item: Zotero.Item): Promise<void>;
  openNote(item: Zotero.Item): Promise<void>;
  openAnnotation(
    attachment: Zotero.Item,
    annotation: Zotero.Item,
  ): Promise<boolean>;
  openAttachmentPage(
    attachment: Zotero.Item,
    pageIndex?: number,
  ): Promise<void>;
}

export interface ZoteroSourceGateway {
  acquireItem(item: Zotero.Item): AcademicAcquisition;
  resolve(
    nodeId: string,
    generation: number,
    descriptor: AcademicSourceDescriptor,
  ): Promise<SourceResolutionResult>;
  listAnnotations(source: LiteratureSource): Promise<AnnotationCandidate[]>;
  refreshNote(
    source: NoteSource,
  ): Promise<Extract<AcademicAcquisition, { kind: "note" }>>;
  open(descriptor: AcademicSourceDescriptor): Promise<void>;
}

type NoteUtilities = Pick<
  SourceGatewayDependencies,
  "cleanTags" | "unescapeHTML"
>;
type LibraryRef = LiteratureSource["library"];
type ChildItemLookup = { getByID(itemID: number): Zotero.Item | null };
type GatewayDependencies = SourceGatewayDependencies & Partial<ChildItemLookup>;

const unavailableMessages = {
  "library-missing": "The Zotero library is unavailable.",
  "item-missing": "The Zotero item is unavailable.",
  "wrong-kind": "The Zotero item has a different kind.",
  "parent-mismatch": "The Zotero item's parent has changed.",
} as const;

export function createZoteroSourceGateway(
  deps?: SourceGatewayDependencies,
): ZoteroSourceGateway;
export function createZoteroSourceGateway(
  deps: GatewayDependencies = productionDependencies(),
): ZoteroSourceGateway {
  function libraryRef(libraryID: number): LibraryRef {
    if (libraryID === deps.userLibraryID) return { type: "user" };
    const library = deps.getLibrary(libraryID);
    if (
      library?.libraryType === "group" &&
      typeof library.groupID === "number"
    ) {
      return { type: "group", groupID: library.groupID };
    }
    throw new Error("Unsupported Zotero library type.");
  }

  function libraryID(library: LibraryRef): number | null {
    return library.type === "user"
      ? deps.userLibraryID
      : deps.groupLibraryID(library.groupID);
  }

  function acquisition(item: Zotero.Item): AcademicAcquisition {
    if (item.isRegularItem())
      return literatureAcquisition(item, libraryRef(item.libraryID));
    if (item.isNote())
      return noteAcquisition(item, libraryRef(item.libraryID), deps);
    if (item.isAnnotation())
      return quoteAcquisition(item, libraryRef(item.libraryID));
    if (item.isAttachment()) throw new Error("Unsupported Zotero attachment.");
    throw new Error("Unsupported Zotero item.");
  }

  async function resolve(
    nodeId: string,
    generation: number,
    descriptor: AcademicSourceDescriptor,
  ): Promise<SourceResolutionResult> {
    const id = libraryID(descriptor.source.library);
    if (id == null) return unavailable(nodeId, generation, "library-missing");

    const item = deps.getByLibraryAndKey(id, keyFor(descriptor));
    if (!item) return unavailable(nodeId, generation, "item-missing");

    try {
      const resolved = acquisitionForDescriptor(item, descriptor, deps);
      return { nodeId, generation, status: "resolved", acquisition: resolved };
    } catch (error) {
      const code =
        error instanceof SourceIntegrityError ? error.code : "wrong-kind";
      return unavailable(nodeId, generation, code);
    }
  }

  async function listAnnotations(
    source: LiteratureSource,
  ): Promise<AnnotationCandidate[]> {
    const id = libraryID(source.library);
    if (id == null) throw new Error(unavailableMessages["library-missing"]);
    const literature = deps.getByLibraryAndKey(id, source.itemKey);
    if (!literature) throw new Error(unavailableMessages["item-missing"]);
    if (!literature.isRegularItem())
      throw new Error(unavailableMessages["wrong-kind"]);

    const attachmentIDs = literature.getAttachments();
    const candidates: AnnotationCandidate[] = [];
    for (const child of attachmentIDs) {
      const attachment = childItem(child, deps);
      if (
        !attachment?.isAttachment() ||
        attachment.attachmentContentType !== "application/pdf" ||
        !attachment.parentItem?.isRegularItem() ||
        attachment.parentItem.key !== source.itemKey
      ) {
        continue;
      }
      for (const annotation of attachment.getAnnotations()) {
        try {
          const acquisition = quoteAcquisition(annotation, source.library);
          if (acquisition.source.itemKey !== source.itemKey) continue;
          candidates.push({
            acquisition,
            attachmentTitle: textField(attachment, "title") || attachment.key,
            sortIndex: annotation.annotationSortIndex || "",
          });
        } catch {
          // A changed parent chain makes this annotation unavailable, not fatal.
        }
      }
    }
    return candidates.sort(
      (left, right) =>
        left.attachmentTitle.localeCompare(right.attachmentTitle) ||
        left.acquisition.source.attachmentKey.localeCompare(
          right.acquisition.source.attachmentKey,
        ) ||
        left.sortIndex.localeCompare(right.sortIndex) ||
        left.acquisition.source.annotationKey.localeCompare(
          right.acquisition.source.annotationKey,
        ),
    );
  }

  async function refreshNote(
    source: NoteSource,
  ): Promise<Extract<AcademicAcquisition, { kind: "note" }>> {
    const id = libraryID(source.library);
    if (id == null) throw new Error(unavailableMessages["library-missing"]);
    const note = deps.getByLibraryAndKey(id, source.noteKey);
    if (!note) throw new Error(unavailableMessages["item-missing"]);
    return noteForSource(note, source, deps);
  }

  async function open(descriptor: AcademicSourceDescriptor): Promise<void> {
    const id = libraryID(descriptor.source.library);
    if (id == null) throw new Error(unavailableMessages["library-missing"]);
    const item = deps.getByLibraryAndKey(id, keyFor(descriptor));
    if (!item) throw new Error(unavailableMessages["item-missing"]);

    if (descriptor.kind === "literature") {
      if (!item.isRegularItem())
        throw new Error(unavailableMessages["wrong-kind"]);
      await deps.openItem(item);
      return;
    }
    if (descriptor.kind === "note") {
      noteForSource(item, descriptor.source, deps);
      await deps.openNote(item);
      return;
    }

    const quote = quoteForSource(item, descriptor.source);
    const exact = await deps.openAnnotation(quote.attachment, item);
    if (!exact) {
      await deps.openAttachmentPage(
        quote.attachment,
        pageIndex(item.annotationPosition),
      );
    }
  }

  return {
    acquireItem: acquisition,
    resolve,
    listAnnotations,
    refreshNote,
    open,
  };
}

export function noteHtmlToText(html: string, utilities: NoteUtilities): string {
  let text: string;
  try {
    text = utilities.unescapeHTML(utilities.cleanTags(html));
  } catch {
    text = htmlToTextFallback(html);
  }
  return normalizeNoteText(text);
}

function literatureAcquisition(
  item: Zotero.Item,
  library: LibraryRef,
): Extract<AcademicAcquisition, { kind: "literature" }> {
  return {
    kind: "literature",
    source: { library, itemKey: item.key },
    snapshot: omitEmpty({
      title: textField(item, "title"),
      creators: creatorsText(item),
      year: year(textField(item, "date")),
      publicationTitle: textField(item, "publicationTitle"),
      tags: tags(item),
    }),
  };
}

function noteAcquisition(
  item: Zotero.Item,
  library: LibraryRef,
  utilities: NoteUtilities,
): Extract<AcademicAcquisition, { kind: "note" }> {
  const parent = item.parentItem;
  return {
    kind: "note",
    source: {
      library,
      noteKey: item.key,
      ...(parent?.isRegularItem() ? { itemKey: parent.key } : {}),
    },
    ...(item.getNoteTitle()
      ? { sourceSnapshot: { title: item.getNoteTitle() } }
      : {}),
    content: noteHtmlToText(item.getNote(), utilities),
  };
}

function quoteAcquisition(
  item: Zotero.Item,
  library: LibraryRef,
): Extract<AcademicAcquisition, { kind: "quote" }> {
  const { attachment, literature } = validatedQuote(item);
  return {
    kind: "quote",
    source: {
      library,
      itemKey: literature.key,
      attachmentKey: attachment.key,
      annotationKey: item.key,
    },
    snapshot: omitEmpty({
      text: item.annotationText?.trim() || "",
      comment: item.annotationComment?.trim(),
      pageLabel: item.annotationPageLabel?.trim(),
      color: item.annotationColor?.trim(),
    }),
  };
}

function acquisitionForDescriptor(
  item: Zotero.Item,
  descriptor: AcademicSourceDescriptor,
  utilities: NoteUtilities,
): AcademicAcquisition {
  if (descriptor.kind === "literature") {
    if (!item.isRegularItem()) throw new SourceIntegrityError("wrong-kind");
    return literatureAcquisition(item, descriptor.source.library);
  }
  if (descriptor.kind === "note")
    return noteForSource(item, descriptor.source, utilities);
  return quoteForSource(item, descriptor.source).acquisition;
}

function noteForSource(
  item: Zotero.Item,
  source: NoteSource,
  utilities: NoteUtilities,
): Extract<AcademicAcquisition, { kind: "note" }> {
  if (!item.isNote()) throw new SourceIntegrityError("wrong-kind");
  if (
    source.itemKey &&
    (!item.parentItem?.isRegularItem() ||
      item.parentItem.key !== source.itemKey)
  ) {
    throw new SourceIntegrityError("parent-mismatch");
  }
  const acquired = noteAcquisition(item, source.library, utilities);
  if (acquired.source.noteKey !== source.noteKey)
    throw new SourceIntegrityError("parent-mismatch");
  return acquired;
}

function quoteForSource(
  item: Zotero.Item,
  source: Extract<AcademicSourceDescriptor, { kind: "quote" }>["source"],
) {
  if (!item.isAnnotation()) throw new SourceIntegrityError("wrong-kind");
  const { attachment, literature } = validatedQuote(item);
  if (
    attachment.key !== source.attachmentKey ||
    literature.key !== source.itemKey
  ) {
    throw new SourceIntegrityError("parent-mismatch");
  }
  return { attachment, acquisition: quoteAcquisition(item, source.library) };
}

function quoteChain(annotation: Zotero.Item): {
  attachment: Zotero.Item;
  literature: Zotero.Item;
} {
  const attachment = annotation.parentItem;
  const literature = attachment?.parentItem;
  if (!attachment?.isAttachment() || !literature?.isRegularItem()) {
    throw new SourceIntegrityError("parent-mismatch");
  }
  return { attachment, literature };
}

function validatedQuote(annotation: Zotero.Item): {
  attachment: Zotero.Item;
  literature: Zotero.Item;
} {
  if (!isSupportedAnnotation(annotation)) {
    throw new SourceIntegrityError("wrong-kind");
  }
  const chain = quoteChain(annotation);
  if (chain.attachment.attachmentContentType !== "application/pdf") {
    throw new SourceIntegrityError("wrong-kind");
  }
  return chain;
}

function isSupportedAnnotation(item: Zotero.Item): boolean {
  return (
    item.isAnnotation() &&
    (item.annotationType === "highlight" ||
      item.annotationType === "underline") &&
    Boolean(item.annotationText?.trim())
  );
}

function keyFor(descriptor: AcademicSourceDescriptor): string {
  if (descriptor.kind === "literature") return descriptor.source.itemKey;
  if (descriptor.kind === "note") return descriptor.source.noteKey;
  return descriptor.source.annotationKey;
}

function unavailable(
  nodeId: string,
  generation: number,
  code: keyof typeof unavailableMessages,
): SourceResolutionResult {
  return {
    nodeId,
    generation,
    status: "unavailable",
    code,
    message: unavailableMessages[code],
  };
}

function childItem(
  value: unknown,
  deps: GatewayDependencies,
): Zotero.Item | null {
  if (value && typeof value === "object") return value as Zotero.Item;
  return typeof value === "number" ? deps.getByID?.(value) || null : null;
}

function textField(item: Zotero.Item, field: string): string {
  try {
    return String(item.getField(field) || "").trim();
  } catch {
    return "";
  }
}

function creatorsText(item: Zotero.Item): string | undefined {
  const creator = String(
    (item as unknown as { firstCreator?: string }).firstCreator ||
      textField(item, "creators"),
  ).trim();
  return creator || undefined;
}

function year(date: string): string | undefined {
  return date.match(/\b\d{4}\b/)?.[0];
}

function tags(item: Zotero.Item): string[] | undefined {
  const itemWithTags = item as unknown as {
    getTags?: () => Array<{ tag: string }>;
  };
  const value = itemWithTags
    .getTags?.()
    .map(({ tag }) => tag.trim())
    .filter(Boolean);
  return value?.length ? value : undefined;
}

function omitEmpty<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) =>
      Array.isArray(entry) ? entry.length : entry !== undefined && entry !== "",
    ),
  ) as T;
}

function normalizeNoteText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^[ \t]+|[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToTextFallback(html: string): string {
  const document = (globalThis as { document?: Document }).document;
  if (document) {
    const element = document.createElement("div");
    element.innerHTML = html;
    return element.textContent || "";
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ");
}

function pageIndex(position: string): number | undefined {
  try {
    const value = JSON.parse(position) as { pageIndex?: unknown };
    return typeof value.pageIndex === "number" &&
      Number.isInteger(value.pageIndex) &&
      value.pageIndex >= 0
      ? value.pageIndex
      : undefined;
  } catch {
    return undefined;
  }
}

class SourceIntegrityError extends Error {
  constructor(readonly code: "wrong-kind" | "parent-mismatch") {
    super(code);
  }
}

function productionDependencies(): GatewayDependencies {
  const zotero = (globalThis as unknown as { Zotero: any }).Zotero;
  return {
    userLibraryID: zotero.Libraries.userLibraryID,
    getLibrary: (libraryID) => zotero.Libraries.get(libraryID) || null,
    groupLibraryID: (groupID) => zotero.Groups.get(groupID)?.libraryID ?? null,
    getByLibraryAndKey: (libraryID, key) =>
      zotero.Items.getByLibraryAndKey(libraryID, key) || null,
    getByID: (itemID) => zotero.Items.get(itemID) || null,
    cleanTags: (html) => zotero.Utilities.cleanTags(html),
    unescapeHTML: (html) => zotero.Utilities.unescapeHTML(html),
    openItem: async (item) =>
      void (await zotero.getMainWindow().ZoteroPane.selectItem(item.id)),
    openNote: async (item) =>
      void (await zotero.getMainWindow().ZoteroPane.openNote(item.id)),
    openAnnotation: async (attachment, annotation) => {
      try {
        await zotero.Reader.open(attachment.id, {
          annotationKey: annotation.key,
        });
        return true;
      } catch {
        return false;
      }
    },
    openAttachmentPage: async (attachment, pageIndex) =>
      void (await zotero.Reader.open(
        attachment.id,
        pageIndex === undefined ? undefined : { pageIndex },
      )),
  };
}
