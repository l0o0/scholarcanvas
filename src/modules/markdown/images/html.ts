export interface MarkdownImageReference {
  alt: string;
  source: string;
  from: number;
  to: number;
  syntax?: "html";
  width?: number;
  title?: string;
}

export const MAX_DISPLAY_IMAGE_WIDTH = 4096;

export function decodeImageAttribute(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,
    (match, entity: string) => {
      if (entity[0] !== "#") {
        return (
          { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" } as Record<
            string,
            string
          >
        )[entity.toLowerCase()];
      }
      const code =
        entity[1].toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : match;
    },
  );
}

function escapeImageAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#13;")
    .replace(/\n/g, "&#10;");
}

/** Read only image data; arbitrary HTML attributes are never rendered. */
export function parseHtmlImage(
  source: string,
  from = 0,
): MarkdownImageReference | null {
  const tag = /^<img\b(?:[^<>"']|"[^"]*"|'[^']*')*>/i.exec(source.slice(from));
  if (!tag) return null;
  const attrs = new Map<string, string>();
  const pattern = /([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const attr of tag[0].slice(4, -1).matchAll(pattern)) {
    const name = attr[1].toLowerCase();
    if (!attrs.has(name))
      attrs.set(name, decodeImageAttribute(attr[2] ?? attr[3] ?? attr[4]));
  }
  const src = attrs.get("src");
  if (!src) return null;
  const width = Number(attrs.get("width"));
  return {
    from,
    to: from + tag[0].length,
    source: src,
    alt: attrs.get("alt") ?? "",
    syntax: "html",
    ...(Number.isInteger(width) && width > 0 && width <= MAX_DISPLAY_IMAGE_WIDTH
      ? { width }
      : {}),
    ...(attrs.has("title") ? { title: attrs.get("title")! } : {}),
  };
}

/** Persist each occurrence's display size alongside its normal attachment path. */
export function serializeImageReference(
  image: Pick<MarkdownImageReference, "source" | "alt" | "title">,
  width?: number,
): string {
  const size =
    width === undefined
      ? undefined
      : Math.min(MAX_DISPLAY_IMAGE_WIDTH, Math.max(1, Math.round(width)));
  return `<img src="${escapeImageAttribute(image.source)}" alt="${escapeImageAttribute(image.alt)}"${image.title ? ` title="${escapeImageAttribute(image.title)}"` : ""}${size !== undefined && Number.isFinite(size) ? ` width="${size}"` : ""}>`;
}
