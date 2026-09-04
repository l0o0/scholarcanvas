import {
  canvasNodeSurfaceDefaults,
  effectiveCanvasNodeTextStyle,
  type CanvasNode,
} from "../model/academic";
import type { CanvasNodeStyle } from "../model/core";
import type { CanvasDocument } from "../model/document";

function boundsOf(nodes: CanvasNode[]) {
  if (!nodes.length) return { x: 0, y: 0, width: 800, height: 600 };
  const left = Math.min(...nodes.map((n) => n.position.x));
  const top = Math.min(...nodes.map((n) => n.position.y));
  const right = Math.max(...nodes.map((n) => n.position.x + n.width));
  const bottom = Math.max(...nodes.map((n) => n.position.y + n.height));
  return {
    x: left - 40,
    y: top - 40,
    width: right - left + 80,
    height: bottom - top + 80,
  };
}

function escapeXml(value: string): string {
  let xmlSafe = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    xmlSafe +=
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff)
        ? character
        : "\ufffd";
  }
  return xmlSafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function strokeDash(
  style: CanvasNodeStyle,
  defaultDashed = false,
): string | undefined {
  if (style.strokeStyle === "dotted") return "2 6";
  if (style.strokeStyle === "dashed") return "12 9";
  if (style.strokeStyle === "solid") return undefined;
  return (style.dashed ?? defaultDashed) ? "12 9" : undefined;
}

function attribute(name: string, value: string | number | undefined): string {
  return value === undefined ? "" : ` ${name}="${escapeXml(String(value))}"`;
}

function glyphWidth(character: string, fontSize: number): number {
  if (/\s/u.test(character)) return fontSize * 0.33;
  if (/[ilI1.,'`:;!|]/u.test(character)) return fontSize * 0.3;
  if (/[MW@%&#]/u.test(character)) return fontSize * 0.9;
  const codePoint = character.codePointAt(0) ?? 0;
  if (
    (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xffef) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  ) {
    return fontSize;
  }
  return fontSize * 0.6;
}

function wrapVisualLine(
  value: string,
  availableWidth: number,
  fontSize: number,
): string[] {
  const characters = Array.from(value);
  if (!characters.length) return [""];
  const lines: string[] = [];
  let start = 0;
  while (start < characters.length) {
    while (start < characters.length && /\s/u.test(characters[start]!)) {
      start += 1;
    }
    if (start >= characters.length) break;
    let end = start;
    let width = 0;
    let lastBreak = -1;
    while (end < characters.length) {
      const nextWidth = width + glyphWidth(characters[end]!, fontSize);
      if (nextWidth > availableWidth && end > start) break;
      width = nextWidth;
      if (/\s/u.test(characters[end]!)) lastBreak = end;
      end += 1;
      if (width > availableWidth) break;
    }
    if (end >= characters.length) {
      lines.push(characters.slice(start).join("").trimEnd());
      break;
    }
    if (lastBreak >= start) {
      lines.push(characters.slice(start, lastBreak).join("").trimEnd());
      start = lastBreak + 1;
      continue;
    }
    lines.push(characters.slice(start, end).join(""));
    start = end;
  }
  return lines.length ? lines : [""];
}

function wrappedTextLines(
  value: string,
  availableWidth: number,
  fontSize: number,
): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line) => wrapVisualLine(line, availableWidth, fontSize));
}

function textPadding(node: CanvasNode): {
  horizontal: number;
  vertical: number;
} {
  return {
    horizontal: 12,
    vertical: node.kind === "line" || node.kind === "arrow" ? 0 : 12,
  };
}

function textElement(
  node: CanvasNode,
  width: number,
  height: number,
  clipId: string,
): string {
  const title = canvasNodeText(node);
  if (!title) return "";
  const style = effectiveCanvasNodeTextStyle(node.kind, node.style);
  const padding = textPadding(node);
  const fontSize = style.fontSize;
  const lineHeight = fontSize * 1.25;
  const availableWidth = Math.max(1, width - padding.horizontal * 2);
  const availableHeight = Math.max(0, height - padding.vertical * 2);
  const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
  const lines = wrappedTextLines(title, availableWidth, fontSize).slice(
    0,
    maxLines,
  );
  const align = style.textAlign;
  const vertical = style.verticalAlign;
  const x =
    node.position.x +
    (align === "left"
      ? padding.horizontal
      : align === "right"
        ? width - padding.horizontal
        : width / 2);
  const blockHeight = fontSize + (lines.length - 1) * lineHeight;
  const firstBaseline =
    node.position.y +
    (vertical === "top"
      ? padding.vertical + fontSize * 0.8
      : vertical === "bottom"
        ? height -
          padding.vertical -
          fontSize * 0.2 -
          (lines.length - 1) * lineHeight
        : height / 2 - blockHeight / 2 + fontSize * 0.8);
  const anchor =
    align === "left" ? "start" : align === "right" ? "end" : "middle";
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan${attribute("x", x)}${attribute("y", firstBaseline + index * lineHeight)}>${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text${attribute("x", x)}${attribute("y", firstBaseline)}${attribute("font-family", style.fontFamily)}${attribute("font-size", fontSize)}${attribute("font-weight", style.fontWeight)}${attribute("font-style", style.fontStyle)}${attribute("text-decoration", style.textDecoration)}${attribute("text-anchor", anchor)}${attribute("fill", style.textColor)}${attribute("opacity", style.textOpacity)}${attribute("clip-path", `url(#${clipId})`)}>${tspans}</text>`;
}

export function canvasNodeText(node: CanvasNode): string {
  switch (node.kind) {
    case "literature":
      return node.snapshot.title;
    case "quote":
      return node.snapshot.text;
    case "note":
    case "question":
    case "claim":
      return node.content;
    case "frame":
      return node.title;
    case "item":
    case "pdf":
    case "attachment":
    case "text":
    case "rect":
    case "ellipse":
    case "line":
    case "arrow":
      return node.data.title;
  }
  node satisfies never;
  throw new Error("Unsupported canvas node kind.");
}

export function containGeometry(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

export function buildCanvasSvg(doc: CanvasDocument): string {
  const bounds = boundsOf(doc.nodes);
  const definitions = new Map<string, string>();
  const paintIds = new Map<string, string>();
  let nextPaintId = 0;
  const paintId = (prefix: "arrow" | "hatch", color: string) => {
    const key = `${prefix}\u0000${color}`;
    const existing = paintIds.get(key);
    if (existing) return existing;
    const id = `canvas-${prefix}-${nextPaintId}`;
    nextPaintId += 1;
    paintIds.set(key, id);
    return id;
  };
  const arrowMarker = (color: string) => {
    const id = paintId("arrow", color);
    definitions.set(
      id,
      `<marker id="${escapeXml(id)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(color)}"/></marker>`,
    );
    return id;
  };
  const fillValue = (fill: string, fillStyle: CanvasNodeStyle["fillStyle"]) => {
    if (fillStyle === "none" || fill === "transparent") return "none";
    if (fillStyle !== "hatch") return fill;
    const id = paintId("hatch", fill);
    definitions.set(
      id,
      `<pattern id="${escapeXml(id)}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${escapeXml(fill)}"/><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="currentColor" stroke-width="1" opacity="0.25"/></pattern>`,
    );
    return `url(#${id})`;
  };
  const orderedNodes = [
    ...doc.nodes.filter((node) => node.kind === "frame"),
    ...doc.nodes.filter((node) => node.kind !== "frame"),
  ];
  const frameCount = orderedNodes.findIndex((node) => node.kind !== "frame");
  const renderedNodes = orderedNodes.map((node, index) => {
    const x = node.position.x;
    const y = node.position.y;
    const width = node.width;
    const height = node.height;
    const style = node.style ?? {};
    const defaults = canvasNodeSurfaceDefaults(node.kind);
    const stroke = style.stroke || defaults.stroke;
    const fill = fillValue(style.fill || defaults.fill, style.fillStyle);
    const strokeWidth = style.strokeWidth ?? defaults.strokeWidth;
    const dash = strokeDash(style, defaults.strokeStyle !== "solid");
    const common = `${attribute("fill", fill)}${attribute("stroke", stroke)}${attribute("stroke-width", strokeWidth)}${attribute("stroke-opacity", style.strokeOpacity)}${attribute("stroke-dasharray", dash)}`;
    const clipId = `canvas-node-clip-${index}`;
    const text = textElement(node, width, height, clipId);
    if (text) {
      const padding = textPadding(node);
      definitions.set(
        clipId,
        `<clipPath id="${clipId}"><rect${attribute("x", x + padding.horizontal)}${attribute("y", y + padding.vertical)}${attribute("width", Math.max(0, width - padding.horizontal * 2))}${attribute("height", Math.max(0, height - padding.vertical * 2))}/></clipPath>`,
      );
    }
    if (node.kind === "line" || node.kind === "arrow") {
      const from = node.data.from ?? { x: 0, y: height / 2 };
      const to = node.data.to ?? { x: width, y: height / 2 };
      const marker =
        node.kind === "arrow"
          ? attribute("marker-end", `url(#${arrowMarker(stroke)})`)
          : "";
      return `<g><line${attribute("x1", x + from.x)}${attribute("y1", y + from.y)}${attribute("x2", x + to.x)}${attribute("y2", y + to.y)}${attribute("stroke", stroke)}${attribute("stroke-width", strokeWidth)}${attribute("stroke-opacity", style.strokeOpacity)}${attribute("stroke-dasharray", dash)}${marker}/>${text}</g>`;
    }
    if (node.kind === "ellipse") {
      return `<g><ellipse${attribute("cx", x + width / 2)}${attribute("cy", y + height / 2)}${attribute("rx", width / 2)}${attribute("ry", height / 2)}${common}/>${text}</g>`;
    }
    const rx = style.radius ?? 8;
    return `<g><rect${attribute("x", x)}${attribute("y", y)}${attribute("width", width)}${attribute("height", height)}${attribute("rx", rx)}${common}/>${text}</g>`;
  });
  const splitIndex = frameCount < 0 ? renderedNodes.length : frameCount;
  const frames = renderedNodes.slice(0, splitIndex).join("\n");
  const shapes = renderedNodes.slice(splitIndex).join("\n");
  const edges = doc.connections
    .map((edge) => {
      const source = doc.nodes.find((n) => n.id === edge.source);
      const target = doc.nodes.find((n) => n.id === edge.target);
      if (!source || !target) return "";
      const sx = source.position.x + source.width / 2;
      const sy = source.position.y + source.height / 2;
      const tx = target.position.x + target.width / 2;
      const ty = target.position.y + target.height / 2;
      const color = edge.color || "#94a3b8";
      const marker =
        edge.arrow === false
          ? ""
          : attribute("marker-end", `url(#${arrowMarker(color)})`);
      const relation =
        edge.kind === "academic"
          ? attribute("data-relation", edge.relation)
          : "";
      return `<line${relation}${attribute("x1", sx)}${attribute("y1", sy)}${attribute("x2", tx)}${attribute("y2", ty)}${attribute("stroke", color)} stroke-width="1.5"${attribute("stroke-dasharray", edge.dashed ? "6 4" : undefined)}${marker}/>`;
    })
    .filter(Boolean)
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}">
<defs>${[...definitions.values()].join("")}</defs>
<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="#fbfbfc"/>
${frames}
${edges}
${shapes}
</svg>`;
}

const ACADEMIC_KIND_ORDER = [
  "literature",
  "quote",
  "note",
  "question",
  "claim",
  "frame",
] as const;

const ACADEMIC_KIND_LABELS = {
  literature: "Literature",
  quote: "Quote",
  note: "Note",
  question: "Question",
  claim: "Claim",
  frame: "Frame",
} as const;

const ACADEMIC_KINDS = new Set<CanvasNode["kind"]>(ACADEMIC_KIND_ORDER);

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function inlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compareNodes(a: CanvasNode, b: CanvasNode): number {
  return (
    compareStrings(
      inlineText(canvasNodeText(a)),
      inlineText(canvasNodeText(b)),
    ) || compareStrings(a.id, b.id)
  );
}

function basicKindLabel(kind: CanvasNode["kind"]): string {
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

export function buildCanvasMarkdown(doc: CanvasDocument): string {
  const lines = ["# Academic Canvas", ""];
  const byId = new Map(doc.nodes.map((node) => [node.id, node]));
  const textCounts = new Map<string, number>();
  for (const node of doc.nodes) {
    const text = inlineText(canvasNodeText(node)) || node.kind;
    textCounts.set(text, (textCounts.get(text) ?? 0) + 1);
  }

  const endpointText = (id: string): string => {
    const node = byId.get(id);
    if (!node) return `[missing: ${id}]`;
    const text = inlineText(canvasNodeText(node)) || node.kind;
    return (textCounts.get(text) ?? 0) > 1 ? `${text} [${node.id}]` : text;
  };

  for (const kind of ACADEMIC_KIND_ORDER) {
    const nodes = doc.nodes
      .filter((node) => node.kind === kind)
      .sort(compareNodes);
    for (const node of nodes) {
      const text = inlineText(canvasNodeText(node)) || node.kind;
      lines.push(`## ${ACADEMIC_KIND_LABELS[kind]}: ${text}`, "");
      if (node.kind === "literature") {
        const citation = [node.snapshot.creators, node.snapshot.year]
          .filter(Boolean)
          .join(" · ");
        if (citation) lines.push(citation, "");
      } else if (node.kind === "quote") {
        lines.push(
          ...node.snapshot.text.split(/\r?\n/).map((line) => `> ${line}`),
          "",
        );
      } else if (
        (node.kind === "note" ||
          node.kind === "question" ||
          node.kind === "claim") &&
        /\r?\n/.test(node.content)
      ) {
        lines.push(node.content, "");
      }
    }
  }

  const basicNodes = doc.nodes
    .filter((node) => !ACADEMIC_KINDS.has(node.kind))
    .sort((a, b) => compareStrings(a.kind, b.kind) || compareNodes(a, b));
  if (basicNodes.length) {
    lines.push("## Other objects", "");
    for (const node of basicNodes) {
      const text = inlineText(canvasNodeText(node)) || node.kind;
      lines.push(`- ${basicKindLabel(node.kind)}: ${text} [${node.id}]`);
    }
    lines.push("");
  }

  if (doc.connections.length) {
    const relationships = doc.connections
      .map((connection) => ({
        id: connection.id,
        relation:
          connection.kind === "academic"
            ? connection.relation
            : inlineText(connection.label ?? "") || "connects",
        source: endpointText(connection.source),
        target: endpointText(connection.target),
      }))
      .sort(
        (a, b) =>
          compareStrings(a.relation, b.relation) ||
          compareStrings(a.source, b.source) ||
          compareStrings(a.target, b.target) ||
          compareStrings(a.id, b.id),
      );
    lines.push("## Relationships", "");
    for (const relationship of relationships) {
      lines.push(
        `- ${relationship.relation}: ${relationship.source} → ${relationship.target}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

export function svgToPngDataUrl(
  svg: string,
  width = 1600,
  height = 1200,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(svg);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.fillStyle = "#fbfbfc";
      ctx.fillRect(0, 0, width, height);
      const target = containGeometry(
        image.naturalWidth,
        image.naturalHeight,
        width,
        height,
      );
      ctx.drawImage(image, target.x, target.y, target.width, target.height);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    image.onerror = () => reject(new Error("SVG render failed"));
    image.src = `data:image/svg+xml;charset=utf-8,${encoded}`;
  });
}
