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
    itemIDs = await deps.recentItemIDs(
      deps.userLibraryID,
      TUTORIAL_CANDIDATE_LIMIT,
    );
  } catch {
    return undefined;
  }

  const ranked: RankedSample[] = [];
  for (const itemID of itemIDs.slice(0, TUTORIAL_CANDIDATE_LIMIT)) {
    try {
      const item = deps.getItem(itemID);
      if (
        !item ||
        item.libraryID !== deps.userLibraryID ||
        !item.isRegularItem()
      ) {
        continue;
      }
      const literature = deps.gateway.acquireItem(item);
      if (literature.kind !== "literature") continue;

      const quotes = await tutorialQuotes(deps.gateway, literature.source);
      const note = tutorialNote(deps, item, literature.source.itemKey);
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
): Promise<TutorialCanvasSample["quotes"]> {
  try {
    const result = await gateway.listAnnotations(source);
    return result.candidates
      .slice(0, 2)
      .map((candidate) => candidate.acquisition);
  } catch {
    return [];
  }
}

function tutorialNote(
  deps: TutorialSampleDependencies,
  item: Zotero.Item,
  itemKey: string,
): TutorialCanvasSample["note"] {
  let noteIDs: number[];
  try {
    noteIDs = item.getNotes();
  } catch {
    return undefined;
  }
  for (const noteID of noteIDs) {
    try {
      const note = deps.getItem(noteID);
      if (!note || note.libraryID !== deps.userLibraryID) continue;
      const acquisition = deps.gateway.acquireItem(note);
      if (
        acquisition.kind === "note" &&
        acquisition.source.library.type === "user" &&
        acquisition.source.itemKey === itemKey
      ) {
        return acquisition;
      }
    } catch {
      continue;
    }
  }
  return undefined;
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
