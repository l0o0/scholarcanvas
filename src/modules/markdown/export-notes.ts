import { parser as markdownParser } from "@lezer/markdown";
import {
  extractNoteLinks,
  formatNoteLink,
  noteIgnoredRanges,
  resolveNoteLink,
  portableNoteFilename,
  type PortableNote,
  type NoteDocument,
} from "./note-links";
import { readLibraryNotes } from "./note-library";
import { parseMarkdownImages } from "./images/model";

export interface NoteExportFile {
  path: string;
  content: string;
}

export interface NoteExportAsset {
  libraryID: number;
  key: string;
  reference: string;
  path: string;
}

export interface NoteExportPlan {
  files: NoteExportFile[];
  assets: NoteExportAsset[];
  warnings: string[];
}

export interface NoteExportOptions {
  format?: "wiki" | "markdown";
}

function warning(kind: string, note: PortableNote, href: string): string {
  return `${kind} in ${note.filename}: ${href}`;
}

function explicitLinkLabel(link: {
  href: string;
  label: string;
  syntax: string;
}): string | undefined {
  if (link.syntax !== "wiki") return link.label;
  const inner =
    link.href.startsWith("[[") && link.href.endsWith("]]")
      ? link.href.slice(2, -2)
      : "";
  return inner.includes("|") ? link.label : undefined;
}

function inRange(
  position: number,
  ranges: readonly { from: number; to: number }[],
): boolean {
  return ranges.some(({ from, to }) => position >= from && position < to);
}

/** Only explicit relative image paths are copied; never URLs or absolute files. */
function relativeImageReference(reference: string): string | null {
  if (
    !reference ||
    /^[a-z][a-z0-9+.-]*:|^[\\/]/i.test(reference) ||
    /[\\:*?<>|]/.test(reference) ||
    [...reference].some((character) => character.charCodeAt(0) < 32)
  )
    return null;
  const parts: string[] = [];
  for (const part of reference.split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." && parts.length && parts.at(-1) !== "..") parts.pop();
    else parts.push(part);
  }
  const normalized = parts.join("/");
  return /\.(?:png|jpe?g|gif|webp|svg|avif|bmp|tiff?)$/i.test(normalized)
    ? normalized
    : null;
}

function assetOutputPath(note: PortableNote, name: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(note.key)) return null;
  return `assets/${note.key}/${name}`;
}

function noteOutputPath(note: PortableNote): string | null {
  const path = portableNoteFilename(note);
  return path && !/[\\/\0]/.test(path) ? path : null;
}

function replaceImageReference(
  source: string,
  image: { from: number; to: number; source: string },
  replacement: string,
): { from: number; to: number; insert: string } | null {
  const segment = source.slice(image.from, image.to);
  const markdownStart = segment.indexOf("](");
  if (markdownStart >= 0) {
    const sourceStart = segment.indexOf(image.source, markdownStart + 2);
    if (sourceStart >= 0) {
      return {
        from: image.from + sourceStart,
        to: image.from + sourceStart + image.source.length,
        insert: replacement,
      };
    }
  }
  const htmlSource = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(segment);
  if (htmlSource && htmlSource.index !== undefined) {
    const valueStart = htmlSource.index + htmlSource[0].indexOf(htmlSource[2]);
    return {
      from: image.from + valueStart,
      to: image.from + valueStart + htmlSource[2].length,
      insert: replacement,
    };
  }
  const unquoted = /\bsrc\s*=\s*([^\s>]+)/i.exec(segment);
  if (unquoted && unquoted.index !== undefined) {
    const valueStart = unquoted.index + unquoted[0].indexOf(unquoted[1]);
    return {
      from: image.from + valueStart,
      to: image.from + valueStart + unquoted[1].length,
      insert: replacement,
    };
  }
  return null;
}

function encodeAssetPath(path: string): string {
  return path
    .split("/")
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

function wikiImageReferences(source: string): {
  from: number;
  to: number;
  source: string;
  wiki: true;
  alias: string;
}[] {
  return [...source.matchAll(/!\[\[([^\]\n]+)\]\]/g)]
    .filter(
      (match) =>
        (source.slice(0, match.index).match(/\\+$/)?.[0].length || 0) % 2 === 0,
    )
    .map((match) => ({
      from: match.index!,
      to: match.index! + match[0].length,
      source: match[1].split("|", 1)[0].trim(),
      wiki: true as const,
      alias: match[1].split("|").slice(1).join("|"),
    }));
}

function referenceImages(source: string) {
  const definitions = new Map<
    string,
    { from: number; to: number; source: string; definition: true }
  >();
  const labels = new Set<string>();
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toUpperCase();
  markdownParser.parse(source).iterate({
    enter({ node }) {
      if (node.name === "LinkReference") {
        const label = node.getChild("LinkLabel");
        const url = node.getChild("URL");
        if (!label || !url) return;
        const key = normalize(source.slice(label.from + 1, label.to - 1));
        if (definitions.has(key)) return;
        const raw = source.slice(url.from, url.to);
        const angled = raw.startsWith("<") && raw.endsWith(">");
        definitions.set(key, {
          from: url.from + (angled ? 1 : 0),
          to: url.to - (angled ? 1 : 0),
          source: angled ? raw.slice(1, -1) : raw,
          definition: true,
        });
      } else if (node.name === "Image" && !node.getChild("URL")) {
        const label = node.getChild("LinkLabel");
        const explicit = label
          ? source.slice(label.from + 1, label.to - 1)
          : "";
        const alt =
          /^!\[([^\]]*)\]/.exec(source.slice(node.from, node.to))?.[1] ?? "";
        labels.add(normalize(explicit || alt));
      }
    },
  });
  return [...labels].flatMap((label) =>
    definitions.has(label) ? [definitions.get(label)!] : [],
  );
}

function buildNoteContent(
  note: NoteDocument,
  notes: readonly NoteDocument[],
  format: "wiki" | "markdown",
  assets: NoteExportAsset[],
  warnings: string[],
): string | null {
  if (note.readError) {
    warnings.push(`Unable to read ${note.filename}: ${note.readError}`);
    return null;
  }
  const source = note.content;
  const replacements: { from: number; to: number; insert: string }[] = [];
  const links = extractNoteLinks(source);
  for (const link of links) {
    const resolved = resolveNoteLink(link.href, note, notes);
    if (resolved.status === "resolved") {
      const label = explicitLinkLabel(link);
      replacements.push({
        from: link.from,
        to: link.to,
        insert: formatNoteLink(resolved.note, {
          format,
          ...(resolved.heading ? { heading: resolved.heading } : {}),
          ...(label ? { label } : {}),
        }),
      });
    } else if (resolved.status === "ambiguous") {
      warnings.push(warning("Ambiguous internal note link", note, link.href));
    } else if (resolved.status === "unresolved") {
      warnings.push(warning("Unresolved internal note link", note, link.href));
    }
  }

  const ignored = noteIgnoredRanges(source);
  const imageReplacements: {
    from: number;
    to: number;
    insert: string;
    reference: string;
    path: string;
  }[] = [];
  const images = [
    ...parseMarkdownImages(source),
    ...referenceImages(source),
    ...wikiImageReferences(source),
  ].sort((a, b) => a.from - b.from);
  const localPaths = new Map<string, string>();
  for (const image of images) {
    if (inRange(image.from, ignored)) continue;
    if ((source.slice(0, image.from).match(/\\+$/)?.[0].length || 0) % 2)
      continue;
    const isWikiImage = "wiki" in image;
    let reference = image.source.replace(/^zotero-md:\/\/asset\//, "assets/");
    // Markdown/HTML destinations are URLs; wiki image filenames are literal.
    if (!isWikiImage) {
      try {
        reference = decodeURIComponent(reference);
      } catch {
        warnings.push(
          `Unable to export asset ${image.source}: invalid URL encoding`,
        );
        continue;
      }
    }
    if (isWikiImage && !reference.includes("/"))
      reference = `assets/${reference}`;
    const normalized = relativeImageReference(reference);
    if (!normalized) {
      if (isWikiImage || !/^(?:https?:|data:|\/\/)/i.test(reference))
        warnings.push(
          `Unable to export asset ${image.source}: unsupported or unsafe reference`,
        );
      continue;
    }
    reference = normalized;
    const name =
      reference.startsWith("assets/") && reference.split("/").length === 2
        ? reference.slice("assets/".length)
        : `linked/${localPaths.size + 1}/${reference.split("/").pop()}`;
    let path = localPaths.get(reference) ?? assetOutputPath(note, name);
    if (
      !localPaths.has(reference) &&
      path &&
      [...localPaths.values()].some(
        (value) => value.toLocaleLowerCase() === path!.toLocaleLowerCase(),
      )
    )
      path = assetOutputPath(
        note,
        `linked/${localPaths.size + 1}/${reference.split("/").pop()}`,
      );
    if (path) localPaths.set(reference, path);
    if (!path) {
      warnings.push(`Unable to export asset ${image.source}: invalid note key`);
      continue;
    }
    const encodedPath = encodeAssetPath(path);
    let replacement;
    if (isWikiImage) {
      const size = /^(\d+)(?:x(\d+))?$/.exec(image.alias);
      const label = image.alias.replace(/([\\[\]])/g, "\\$1");
      const insert =
        format === "wiki"
          ? `![[${path}${image.alias ? `|${image.alias}` : ""}]]`
          : size
            ? `<img src="${encodedPath}" width="${size[1]}"${size[2] ? ` height="${size[2]}"` : ""}>`
            : `![${label}](${encodedPath})`;
      replacement = { from: image.from, to: image.to, insert };
    } else if ("definition" in image) {
      replacement = { from: image.from, to: image.to, insert: encodedPath };
    } else {
      replacement = replaceImageReference(source, image, encodedPath);
    }
    if (!replacement) {
      warnings.push(
        `Unable to rewrite asset ${image.source} in ${note.filename}`,
      );
      continue;
    }
    imageReplacements.push({
      ...replacement,
      reference,
      path,
    });
  }

  const assetSet = new Set<string>();
  for (const image of imageReplacements) {
    const key = `${note.libraryID}:${note.key}:${image.reference}`;
    if (!assetSet.has(key)) {
      assetSet.add(key);
      assets.push({
        libraryID: note.libraryID,
        key: note.key,
        reference: image.reference,
        path: image.path,
      });
    }
    replacements.push({
      from: image.from,
      to: image.to,
      insert: image.insert,
    });
  }

  replacements.sort((a, b) => b.from - a.from);
  let result = source;
  let end = source.length;
  for (const replacement of replacements) {
    if (replacement.to > end) continue;
    result =
      result.slice(0, replacement.from) +
      replacement.insert +
      result.slice(replacement.to);
    end = replacement.from;
  }
  return result;
}

export function buildNoteExport(
  notes: readonly NoteDocument[],
  options: NoteExportOptions = {},
): NoteExportPlan {
  const format = options.format ?? "wiki";
  const files: NoteExportFile[] = [];
  const assets: NoteExportAsset[] = [];
  const warnings: string[] = [];
  const byKey = new Map<string, NoteExportAsset>();
  const portableNotes = notes.filter((note) => !note.readError);
  for (const note of notes) {
    const content = buildNoteContent(
      note,
      portableNotes,
      format,
      assets,
      warnings,
    );
    if (content === null) continue;
    const path = noteOutputPath(note);
    if (!path) {
      warnings.push(`Unable to export ${note.filename}: invalid note key`);
      continue;
    }
    files.push({ path, content });
  }
  // Keep asset plans deterministic and de-duplicate references across image
  // syntaxes without depending on object identity.
  for (const asset of assets) {
    const id = `${asset.libraryID}:${asset.key}:${asset.reference}`;
    if (!byKey.has(id)) byKey.set(id, asset);
  }
  return { files, assets: [...byKey.values()], warnings };
}

function parentDirectory(path: string): string | null {
  if (!path || typeof path !== "string") return null;
  if (
    path.includes("\0") ||
    path.split(/[\\/]/).includes("..") ||
    !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(path)
  )
    return null;
  try {
    const parent = PathUtils.parent(path);
    return parent && parent !== path ? parent : null;
  } catch {
    return null;
  }
}

function sourceAssetPath(note: NoteDocument, reference: string): string | null {
  const relative = relativeImageReference(reference);
  let parent = parentDirectory(note.path || "");
  if (!relative || !parent) return null;
  const parts = relative.split("/");
  while (parts[0] === "..") {
    parts.shift();
    const next: string | null = PathUtils.parent(parent);
    if (!next || next === parent) return null;
    parent = next;
  }
  return PathUtils.join(parent, ...parts);
}

async function chooseExportParent(win: Window): Promise<string | null> {
  const picked = await new ztoolkit.FilePicker(
    "Export Markdown notes",
    "folder",
    [],
    undefined,
    win,
  ).open();
  return picked || null;
}

async function createExportDirectory(parent: string): Promise<string> {
  const base = "zotero-markdown-export";
  for (let index = 0; index < 1000; index++) {
    const suffix = index ? `-${index}` : "";
    const candidate = PathUtils.join(parent, `${base}${suffix}`);
    if (await IOUtils.exists(candidate)) continue;
    try {
      await IOUtils.makeDirectory(candidate, { ignoreExisting: false });
      return candidate;
    } catch (error) {
      if (await IOUtils.exists(candidate)) continue;
      throw error;
    }
  }
  throw new Error("Could not create a unique export directory");
}

function warningReportPath(files: readonly NoteExportFile[]): string {
  const occupied = new Set(files.map((file) => file.path.toLocaleLowerCase()));
  for (let index = 0; ; index++) {
    const suffix = index ? `-${index}` : "";
    const path = `REPORT${suffix}.md`;
    if (!occupied.has(path.toLocaleLowerCase())) return path;
  }
}

export async function exportNoteLibrary(
  win: Window,
  libraryID: number,
  format: "wiki" | "markdown",
): Promise<{ directory: string; notes: number; warnings: string[] } | null> {
  const notes = await readLibraryNotes(libraryID, { refresh: true });
  const plan = buildNoteExport(
    notes.filter((note) => note.libraryID === libraryID),
    { format },
  );
  const parent = await chooseExportParent(win);
  if (!parent) return null;
  const directory = await createExportDirectory(parent);
  const warnings = [...plan.warnings];

  for (const file of plan.files) {
    await Zotero.File.putContentsAsync(
      PathUtils.join(directory, file.path),
      file.content,
    );
  }

  const noteByKey = new Map(
    notes.map((note) => [`${note.libraryID}:${note.key}`, note] as const),
  );
  for (const asset of plan.assets) {
    const note = noteByKey.get(`${asset.libraryID}:${asset.key}`);
    const source = note ? sourceAssetPath(note, asset.reference) : null;
    if (!source) {
      warnings.push(
        `Unable to copy asset ${asset.reference}: invalid source root`,
      );
      continue;
    }
    try {
      if (!(await IOUtils.exists(source))) {
        warnings.push(
          `Unable to copy asset ${asset.reference}: file not found`,
        );
        continue;
      }
      const info = await IOUtils.stat(source);
      if (info.type && info.type !== "regular") {
        warnings.push(`Unable to copy asset ${asset.reference}: not a file`);
        continue;
      }
      const targetDirectory = PathUtils.parent(
        PathUtils.join(directory, asset.path),
      );
      if (!targetDirectory) throw new Error("Invalid export target");
      await IOUtils.makeDirectory(targetDirectory, {
        ignoreExisting: true,
        createAncestors: true,
      });
      await IOUtils.write(
        PathUtils.join(directory, asset.path),
        await IOUtils.read(source),
      );
    } catch (error) {
      warnings.push(
        `Unable to copy asset ${asset.reference}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  if (warnings.length) {
    const report = warningReportPath(plan.files);
    await Zotero.File.putContentsAsync(
      PathUtils.join(directory, report),
      `# Export warnings\n\n${warnings.map((message) => `- ${message}`).join("\n")}\n`,
    );
  }
  return { directory, notes: plan.files.length, warnings };
}
