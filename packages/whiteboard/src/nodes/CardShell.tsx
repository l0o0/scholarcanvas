import type { CSSProperties, ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  canvasNodeSurfaceDefaults,
  type CanvasNodeKind,
} from "../model/academic";
import type { CanvasNodeStyle } from "../model/core";
import { IconItem, IconNote, IconQuote } from "../whiteboard/icons";

export function nodeSurfaceFill(
  kind: CanvasNodeKind,
  style: Partial<CanvasNodeStyle>,
): string | undefined {
  if (style.fillStyle === "none" || style.fill === "transparent") {
    return "transparent";
  }
  const defaultFill = canvasNodeSurfaceDefaults(kind).fill;
  if (defaultFill === "transparent" && style.fill === undefined) {
    return style.fillStyle === "hatch" ? "transparent" : undefined;
  }
  if (style.fillStyle === "hatch") {
    const fill = style.fill || `var(--zmd-board-surface, ${defaultFill})`;
    return `repeating-linear-gradient(135deg, ${fill} 0, ${fill} 6px, rgba(148, 163, 184, 0.25) 6px, rgba(148, 163, 184, 0.25) 8px)`;
  }
  return style.fill;
}

export function nodeSurfaceStroke(
  kind: CanvasNodeKind,
  style: Partial<CanvasNodeStyle>,
): string | undefined {
  if (style.strokeOpacity === undefined) return style.stroke;
  const opacity = Math.max(0, Math.min(1, style.strokeOpacity));
  const defaultStroke = canvasNodeSurfaceDefaults(kind).stroke;
  const fallback =
    kind === "line" || kind === "arrow"
      ? `var(--zmd-board-edge, ${defaultStroke})`
      : kind === "rect" || kind === "ellipse"
        ? `var(--zmd-board-text, ${defaultStroke})`
        : `var(--zmd-board-border, ${defaultStroke})`;
  return `color-mix(in srgb, ${style.stroke || fallback} ${opacity * 100}%, transparent)`;
}

export function nodeSurfaceStyle(
  kind: CanvasNodeKind,
  style: Partial<CanvasNodeStyle>,
): CSSProperties {
  const stroke = nodeSurfaceStroke(kind, style);
  const fill = nodeSurfaceFill(kind, style);
  const strokeStyle =
    style.strokeStyle ??
    (style.dashed === undefined
      ? undefined
      : style.dashed
        ? "dashed"
        : "solid");
  return {
    ...(stroke !== undefined ? { "--zmd-board-node-stroke": stroke } : {}),
    ...(fill !== undefined ? { "--zmd-board-node-fill": fill } : {}),
    ...(style.strokeWidth !== undefined
      ? { "--zmd-board-node-stroke-width": `${style.strokeWidth}px` }
      : {}),
    ...(strokeStyle !== undefined
      ? { "--zmd-board-node-stroke-style": strokeStyle }
      : {}),
    ...(style.radius !== undefined
      ? { "--zmd-board-node-radius": `${style.radius}px` }
      : {}),
  } as CSSProperties;
}

export function nodeContentAlignmentStyle(
  style: Partial<CanvasNodeStyle>,
): CSSProperties {
  if (style.verticalAlign === undefined) return {};
  return {
    justifyContent:
      style.verticalAlign === "top"
        ? "flex-start"
        : style.verticalAlign === "bottom"
          ? "flex-end"
          : "center",
  };
}

export function CardShell(props: {
  kind: CanvasNodeKind;
  kindLabel: string;
  badge?: string;
  selected?: boolean;
  nodeStyle?: Partial<CanvasNodeStyle>;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const nodeStyle = props.nodeStyle ?? {};
  return (
    <article
      className={`zmd-board-card is-${props.kind}${props.selected ? " is-selected" : ""}`}
      style={nodeSurfaceStyle(props.kind, nodeStyle)}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <header className="zmd-board-card-header" title={props.kindLabel}>
        {props.kind === "literature" ? (
          <IconItem />
        ) : props.kind === "quote" ? (
          <IconQuote />
        ) : props.kind === "note" ? (
          <IconNote />
        ) : null}
        <span
          className={
            props.badge ? "zmd-board-note-badge" : "zmd-board-card-kind"
          }
        >
          {props.badge || props.kindLabel}
        </span>
      </header>
      <div
        className="zmd-board-card-body"
        style={nodeContentAlignmentStyle(nodeStyle)}
      >
        {props.children}
      </div>
      {props.footer ? (
        <div className="zmd-board-card-footer">{props.footer}</div>
      ) : null}
    </article>
  );
}
