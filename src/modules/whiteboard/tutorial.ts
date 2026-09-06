import {
  tutorialCanvasDocument,
  type CanvasDocument,
  type TutorialCanvasLabels,
  type TutorialCanvasSample,
} from "../../../packages/whiteboard/src/model";
import type { FluentMessageId } from "../../../typings/i10n";
import { getString } from "../../utils/locale";
import { getPref, setPref } from "../../utils/prefs";
import { createWhiteboardAttachment } from "./create";
import { openWhiteboardAttachment } from "./open";
import {
  createZoteroSourceGateway,
  type ZoteroSourceGateway,
} from "./source-gateway";

export const TUTORIAL_CANDIDATE_LIMIT = 50;

export interface TutorialSampleDependencies {
  userLibraryID: number;
  recentItemIDs(libraryID: number, limit: number): Promise<number[]>;
  getItem(itemID: number): Zotero.Item | null;
  gateway: ZoteroSourceGateway;
}

export interface TutorialOnboardingDependencies {
  completed(): boolean;
  markCompleted(): void;
  labels(): TutorialCanvasLabels;
  selectSample(): Promise<TutorialCanvasSample | undefined>;
  create(
    document: CanvasDocument,
    filename: string,
  ): Promise<Zotero.Item | null>;
  open(item: Zotero.Item): Promise<unknown>;
  log(message: string, error?: unknown): void;
}

interface RankedSample {
  sample: TutorialCanvasSample;
  tier: number;
  dateModified: string;
  itemID: number;
}

export async function selectTutorialSample(
  deps: TutorialSampleDependencies = productionDependencies(),
): Promise<TutorialCanvasSample | undefined> {
  let itemIDs: number[];
  try {
    const discovered: unknown = await deps.recentItemIDs(
      deps.userLibraryID,
      TUTORIAL_CANDIDATE_LIMIT,
    );
    if (!Array.isArray(discovered)) return undefined;
    itemIDs = discovered.filter(isItemID).slice(0, TUTORIAL_CANDIDATE_LIMIT);
  } catch {
    return undefined;
  }

  const ranked: RankedSample[] = [];
  for (const itemID of itemIDs) {
    try {
      const item = deps.getItem(itemID);
      if (
        !item ||
        !isItemID(item.id) ||
        item.id !== itemID ||
        typeof item.dateModified !== "string" ||
        !/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]) (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(
          item.dateModified,
        ) ||
        typeof item.key !== "string" ||
        !item.key.length ||
        item.libraryID !== deps.userLibraryID ||
        !item.isRegularItem()
      ) {
        continue;
      }
      const literature = deps.gateway.acquireItem(item);
      if (
        literature.kind !== "literature" ||
        literature.source.library.type !== "user" ||
        literature.source.itemKey !== item.key
      ) {
        continue;
      }

      const quotes = await tutorialQuotes(
        deps.gateway,
        literature.source,
        item.key,
      );
      const note = tutorialNote(deps, item);
      ranked.push({
        sample: { literature, quotes, ...(note ? { note } : {}) },
        tier: (quotes.length ? 2 : 0) + (note ? 1 : 0),
        dateModified: item.dateModified,
        itemID: item.id,
      });
    } catch {
      continue;
    }
  }

  ranked.sort(
    (left, right) =>
      right.tier - left.tier ||
      right.dateModified.localeCompare(left.dateModified) ||
      right.itemID - left.itemID,
  );
  return ranked[0]?.sample;
}

async function tutorialQuotes(
  gateway: ZoteroSourceGateway,
  source: TutorialCanvasSample["literature"]["source"],
  itemKey: string,
): Promise<TutorialCanvasSample["quotes"]> {
  const quotes: TutorialCanvasSample["quotes"] = [];
  try {
    const result = await gateway.listAnnotations(source);
    if (!Array.isArray(result.candidates)) return quotes;
    for (const candidate of result.candidates) {
      try {
        const acquisition = (
          candidate as { acquisition?: TutorialCanvasSample["quotes"][number] }
        )?.acquisition;
        if (
          acquisition?.kind !== "quote" ||
          acquisition.source.library.type !== "user" ||
          acquisition.source.itemKey !== itemKey ||
          typeof acquisition.source.attachmentKey !== "string" ||
          !acquisition.source.attachmentKey.length ||
          typeof acquisition.source.annotationKey !== "string" ||
          !acquisition.source.annotationKey.length ||
          typeof acquisition.snapshot.text !== "string" ||
          !acquisition.snapshot.text.trim()
        ) {
          continue;
        }
        quotes.push(acquisition);
        if (quotes.length === 2) break;
      } catch {
        continue;
      }
    }
  } catch {
    return quotes;
  }
  return quotes;
}

function tutorialNote(
  deps: TutorialSampleDependencies,
  item: Zotero.Item,
): TutorialCanvasSample["note"] {
  try {
    const noteIDs: unknown = item.getNotes();
    if (!Array.isArray(noteIDs)) return undefined;
    for (const noteID of noteIDs) {
      if (!isItemID(noteID)) continue;
      try {
        const note = deps.getItem(noteID);
        if (
          !note ||
          note.libraryID !== deps.userLibraryID ||
          typeof note.key !== "string" ||
          !note.key.length
        ) {
          continue;
        }
        const acquisition = deps.gateway.acquireItem(note);
        if (
          acquisition.kind === "note" &&
          acquisition.source.library.type === "user" &&
          acquisition.source.itemKey === item.key &&
          acquisition.source.noteKey === note.key
        ) {
          return acquisition;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function isItemID(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function productionDependencies(): TutorialSampleDependencies {
  return {
    userLibraryID: Zotero.Libraries.userLibraryID,
    recentItemIDs: (libraryID, limit) =>
      Zotero.DB.columnQueryAsync<number>(
        `SELECT itemID
         FROM items
         WHERE libraryID = ?
           AND itemID NOT IN (SELECT itemID FROM deletedItems)
         ORDER BY dateModified DESC, itemID DESC
         LIMIT ?`,
        [libraryID, limit],
      ),
    getItem: (itemID) => Zotero.Items.get(itemID) || null,
    gateway: createZoteroSourceGateway(),
  };
}

let tutorialInFlight: Promise<void> | undefined;

export function ensureTutorialWhiteboard(
  deps?: TutorialOnboardingDependencies,
): Promise<void> {
  if (tutorialInFlight) return tutorialInFlight;
  let resolved = deps;
  try {
    resolved ??= productionOnboardingDependencies();
    if (resolved.completed()) return Promise.resolve();
    return (tutorialInFlight = runTutorial(resolved).finally(() => {
      tutorialInFlight = undefined;
    }));
  } catch (error) {
    safeLog(resolved?.log, "Tutorial completion check failed", error);
    return Promise.resolve();
  }
}

async function runTutorial(
  deps: TutorialOnboardingDependencies,
): Promise<void> {
  let sample: TutorialCanvasSample | undefined;
  try {
    sample = await deps.selectSample();
  } catch (error) {
    safeLog(deps.log, "Tutorial sample selection failed", error);
  }

  try {
    const labels = deps.labels();
    const document = tutorialCanvasDocument(labels, sample);
    const attachment = await deps.create(document, labels.title);
    if (!attachment) {
      safeLog(deps.log, "Tutorial whiteboard creation returned no attachment");
      return;
    }
    deps.markCompleted();
    await deps.open(attachment);
  } catch (error) {
    safeLog(deps.log, "Tutorial whiteboard creation or opening failed", error);
  }
}

function safeLog(
  log: TutorialOnboardingDependencies["log"] | undefined,
  message: string,
  error?: unknown,
): void {
  try {
    if (log) log(message, error);
    else if (typeof ztoolkit !== "undefined") ztoolkit.log(message, error);
  } catch {
    // Logging must not block plugin startup.
  }
}

function productionOnboardingDependencies(): TutorialOnboardingDependencies {
  return {
    completed: () => getPref("whiteboardTutorialCreated") === true,
    markCompleted: () => setPref("whiteboardTutorialCreated", true),
    labels: tutorialLabels,
    selectSample: selectTutorialSample,
    create: (document, filename) =>
      createWhiteboardAttachment(null, {
        document,
        libraryID: Zotero.Libraries.userLibraryID,
        collections: [],
        filename,
        select: false,
        reportError: false,
      }),
    open: openWhiteboardAttachment,
    log: (message, error) => ztoolkit.log(message, error),
  };
}

function tutorialLabels(): TutorialCanvasLabels {
  const string = (key: string) => getString(key as FluentMessageId);
  return {
    title: string("whiteboard-tutorial-title"),
    welcome: string("whiteboard-tutorial-welcome"),
    welcomeBody: string("whiteboard-tutorial-welcome-body"),
    sourceNotice: string("whiteboard-tutorial-source-notice"),
    addLiterature: string("whiteboard-tutorial-add-literature"),
    addLiteratureBody: string("whiteboard-tutorial-add-literature-body"),
    browseQuotes: string("whiteboard-tutorial-browse-quotes"),
    browseQuotesBody: string("whiteboard-tutorial-browse-quotes-body"),
    writeNote: string("whiteboard-tutorial-write-note"),
    writeNoteBody: string("whiteboard-tutorial-write-note-body"),
    questionBadge: string("whiteboard-tutorial-question-badge"),
    claimBadge: string("whiteboard-tutorial-claim-badge"),
    organize: string("whiteboard-tutorial-organize"),
    organizeBody: string("whiteboard-tutorial-organize-body"),
    practice: string("whiteboard-tutorial-practice"),
    practiceBody: string("whiteboard-tutorial-practice-body"),
    supports: string("whiteboard-tutorial-supports"),
  };
}
