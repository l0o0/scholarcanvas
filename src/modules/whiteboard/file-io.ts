import { getString } from "../../utils/locale";
import { parseBoardDocument, type BoardDocument } from "./snapshot";
import {
  parseStoredCanvas,
  serializeStoredCanvas,
  type StoredCanvasFormat,
} from "../../../packages/whiteboard/src/model/canvas-file";

const CANVAS_FILTER: [string, string] = [
  "Research Canvas (*.canvas)",
  "*.canvas",
];
const LEGACY_BOARD_FILTER: [string, string] = [
  "Legacy Research Board (*.board, *.zmdboard)",
  "*.board; *.zmdboard",
];

export type AtomicWriteUTF8 = (
  path: string,
  value: string,
  options: { tmpPath: string; flush: boolean },
) => Promise<number | void>;

export function serializeBoardDocument(
  doc: BoardDocument,
  format: StoredCanvasFormat = "canvas",
): string {
  return serializeStoredCanvas(parseBoardDocument(doc), format);
}

export function basename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export function canvasFormatForPath(path: string): StoredCanvasFormat {
  return /\.(board|zmdboard)$/i.test(path) ? "legacy" : "canvas";
}

export function ensureCanvasExtension(path: string): string {
  return /\.(canvas|board|zmdboard)$/i.test(path) ? path : `${path}.canvas`;
}

export const ensureBoardExtension = ensureCanvasExtension;

export async function pickBoardFile(
  mode: "open" | "save",
  win?: Window,
  suggestion = "whiteboard.canvas",
): Promise<string | null> {
  const title = getString(
    mode === "open" ? "whiteboard-open" : "whiteboard-save",
  );
  const picked = await new ztoolkit.FilePicker(
    title,
    mode,
    mode === "open" ? [CANVAS_FILTER, LEGACY_BOARD_FILTER] : [CANVAS_FILTER],
    mode === "save" ? suggestion : undefined,
    win,
  ).open();
  return picked || null;
}

export async function readBoardFile(path: string): Promise<BoardDocument> {
  const text = (await Zotero.File.getContentsAsync(path)) as string;
  if (!text.trim()) return parseStoredCanvas({}).document;
  try {
    return parseStoredCanvas(JSON.parse(text)).document;
  } catch {
    throw new Error("Invalid canvas file");
  }
}

export async function writeBoardFile(
  path: string,
  doc: BoardDocument,
  options: { nonce?: string; writeUTF8?: AtomicWriteUTF8 } = {},
): Promise<string> {
  const target = ensureCanvasExtension(path);
  const name = basename(target);
  const nonce =
    options.nonce ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const separatorIndex = Math.max(
    target.lastIndexOf("/"),
    target.lastIndexOf("\\"),
  );
  const parent = separatorIndex >= 0 ? target.slice(0, separatorIndex + 1) : "";
  const tmpPath = `${parent}.${name}.${nonce}.tmp`;
  const writeUTF8: AtomicWriteUTF8 =
    options.writeUTF8 ??
    ((targetPath, value, writeOptions) =>
      IOUtils.writeUTF8(targetPath, value, writeOptions));
  await writeUTF8(
    target,
    serializeStoredCanvas(doc, canvasFormatForPath(target), {
      title: name.replace(/\.(canvas|board|zmdboard)$/i, ""),
    }),
    { tmpPath, flush: true },
  );
  return target;
}
