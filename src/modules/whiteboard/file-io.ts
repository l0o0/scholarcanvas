import { getString } from "../../utils/locale";
import {
  parseStoredCanvas,
  serializeCanvasDocument,
  type ParsedCanvasFile,
} from "../../../packages/whiteboard/src/model/canvas-file";
import type { CanvasDocument } from "./snapshot";

const CANVAS_FILTER: [string, string] = [
  "Research Canvas (*.canvas)",
  "*.canvas",
];

export type AtomicWriteUTF8 = (
  path: string,
  value: string,
  options: { tmpPath: string; flush: boolean },
) => Promise<number | void>;

export type ReadUTF8 = (path: string) => Promise<string>;

export function basename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export function ensureCanvasExtension(path: string): string {
  return /\.canvas$/i.test(path) ? path : `${path}.canvas`;
}

export async function pickCanvasFile(
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
    [CANVAS_FILTER],
    mode === "save" ? suggestion : undefined,
    win,
  ).open();
  return picked || null;
}

export async function readCanvasFile(
  path: string,
  options: { readUTF8?: ReadUTF8 } = {},
): Promise<ParsedCanvasFile> {
  if (!/\.canvas$/i.test(path)) {
    throw new Error("Canvas files must use the .canvas extension.");
  }
  const readUTF8: ReadUTF8 =
    options.readUTF8 ??
    (async (target) => String(await Zotero.File.getContentsAsync(target)));
  return parseStoredCanvas(await readUTF8(path));
}

export async function writeCanvasFile(
  path: string,
  document: CanvasDocument,
  options: { writeUTF8?: AtomicWriteUTF8 } = {},
): Promise<string> {
  const target = ensureCanvasExtension(path);
  const writeUTF8: AtomicWriteUTF8 =
    options.writeUTF8 ??
    ((targetPath, value, writeOptions) =>
      IOUtils.writeUTF8(targetPath, value, writeOptions));
  await writeUTF8(target, serializeCanvasDocument(document), {
    tmpPath: `${target}.tmp`,
    flush: true,
  });
  return target;
}
