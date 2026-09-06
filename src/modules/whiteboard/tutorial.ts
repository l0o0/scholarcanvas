import type { TutorialCanvasSample } from "../../../packages/whiteboard/src/model";
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
    itemIDs = discovered.slice(0, TUTORIAL_CANDIDATE_LIMIT).filter(isItemID);
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
        typeof item.dateModified !== "string" ||
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
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
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
