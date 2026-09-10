const CANVAS_EXTENSION = "canvas";

export function isWhiteboardAttachment(
  item: Zotero.Item | false | undefined,
): item is Zotero.Item {
  if (!item || !item.isAttachment()) return false;
  if (item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_URL) {
    return false;
  }
  const filename = item.attachmentFilename || "";
  const ext = getExtension(filename);
  return ext === CANVAS_EXTENSION;
}

export function getExtension(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || filename;
  const idx = base.lastIndexOf(".");
  if (idx <= 0) return "";
  return base.slice(idx + 1).toLowerCase();
}

export function defaultCanvasFilename(now: Date = new Date()): string {
  const date = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
  ].join("");
  const time = [
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join("");
  return `Canvas-${date}-${time}.canvas`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}
