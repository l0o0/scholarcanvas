import type { CanvasNode } from "../model/academic";
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
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paintId(prefix: string, color: string): string {
  const token = color.replace(/[^a-z0-9_-]/gi, "") || "default";
  return `${prefix}-${token}`;
}

function strokeDash(style: CanvasNodeStyle): string | undefined {
  if (style.strokeStyle === "dotted") return "2 6";
  if (style.strokeStyle === "dashed" || style.dashed) return "12 9";
  return undefined;
}

function attribute(name: string, value: string | number | undefined): string {
  return value === undefined ? "" : ` ${name}="${escapeXml(String(value))}"`;
}

function textElement(node: CanvasNode, width: number, height: number): string {
  const title = canvasNodeText(node);
  if (!title) return "";
  const style = node.style ?? {};
  const padding = 12;
  const align = style.textAlign || "center";
  const vertical = style.verticalAlign || "middle";
  const x =
    node.position.x +
    (align === "left"
      ? padding
      : align === "right"
        ? width - padding
        : width / 2);
  const y =
    node.position.y +
    (vertical === "top"
      ? padding + (style.fontSize || 16) * 0.8
      : vertical === "bottom"
        ? height - padding
        : height / 2 + (style.fontSize || 16) * 0.35);
  const anchor =
    align === "left" ? "start" : align === "right" ? "end" : "middle";
  return `<text${attribute("x", x)}${attribute("y", y)}${attribute("font-family", style.fontFamily || "system-ui, sans-serif")}${attribute("font-size", style.fontSize || 16)}${attribute("font-weight", style.fontWeight || "normal")}${attribute("font-style", style.fontStyle || "normal")}${attribute("text-decoration", style.textDecoration || "none")}${attribute("text-anchor", anchor)}${attribute("fill", style.textColor || "#111827")}${attribute("opacity", style.textOpacity ?? 1)}>${escapeXml(title)}</text>`;
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
  const renderedNodes = orderedNodes.map((node) => {
    const x = node.position.x;
    const y = node.position.y;
    const width = node.width;
    const height = node.height;
    const style = node.style ?? {};
    const stroke = style.stroke || "#94a3b8";
    const fill = fillValue(style.fill || "#ffffff", style.fillStyle);
    const strokeWidth = style.strokeWidth ?? 2;
    const dash = strokeDash(style);
    const common = `${attribute("fill", fill)}${attribute("stroke", stroke)}${attribute("stroke-width", strokeWidth)}${attribute("stroke-opacity", style.strokeOpacity)}${attribute("stroke-dasharray", dash)}`;
    if (node.kind === "ellipse") {
      return `<g><ellipse${attribute("cx", x + width / 2)}${attribute("cy", y + height / 2)}${attribute("rx", width / 2)}${attribute("ry", height / 2)}${common}/>${textElement(node, width, height)}</g>`;
    }
    if (node.kind === "line" || node.kind === "arrow") {
      const from = node.data.from ?? { x: 0, y: height / 2 };
      const to = node.data.to ?? { x: width, y: height / 2 };
      const marker =
        node.kind === "arrow"
          ? attribute("marker-end", `url(#${arrowMarker(stroke)})`)
          : "";
      return `<line${attribute("x1", x + from.x)}${attribute("y1", y + from.y)}${attribute("x2", x + to.x)}${attribute("y2", y + to.y)}${attribute("stroke", stroke)}${attribute("stroke-width", strokeWidth)}${attribute("stroke-opacity", style.strokeOpacity)}${attribute("stroke-dasharray", dash)}${marker}/>`;
    }
    const rx = node.kind === "rect" ? (style.radius ?? 8) : 8;
    return `<g><rect${attribute("x", x)}${attribute("y", y)}${attribute("width", width)}${attribute("height", height)}${attribute("rx", rx)}${common}/>${textElement(node, width, height)}</g>`;
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
