import type { NodeProps } from "@xyflow/react";
import { useWhiteboardLabels } from "../chrome/labels";
import { canvasNodeSurfaceDefaults } from "../model/academic";
import { labelTextStyle, verticalAlignmentStyle } from "../whiteboard/document";
import {
  CardShell,
  NodeHandles,
  nodeSurfaceFill,
  nodeSurfaceStroke,
} from "./CardShell";
import type { CanvasFlowNode } from "./types";

function point(value: { x: number; y: number } | undefined, fallback: number) {
  return value ?? { x: fallback, y: fallback };
}

function resolvedStrokeStyle(style: CanvasFlowNode["data"]["model"]["style"]) {
  return style?.strokeStyle ?? (style?.dashed ? "dashed" : "solid");
}

function strokeDasharray(style: CanvasFlowNode["data"]["model"]["style"]) {
  const strokeStyle = resolvedStrokeStyle(style);
  return strokeStyle === "dotted"
    ? "2 6"
    : strokeStyle === "dashed"
      ? "8 6"
      : undefined;
}

export function TextNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== "text") return null;
  const style = model.style ?? {};
  return (
    <CardShell
      kind="text"
      kindLabel={labels.addText}
      selected={selected}
      nodeStyle={model.style}
    >
      <div
        className="zmd-board-card-label-layout"
        style={verticalAlignmentStyle(style)}
      >
        <p className="zmd-board-card-title" style={labelTextStyle(style)}>
          {model.data.title || labels.addText}
        </p>
      </div>
    </CardShell>
  );
}

function shapeStyle(
  kind: "rect" | "ellipse",
  style: CanvasFlowNode["data"]["model"]["style"],
) {
  const value = style ?? {};
  const defaults = canvasNodeSurfaceDefaults(kind);
  const stroke =
    nodeSurfaceStroke(kind, value) ??
    `var(--zmd-board-text, ${defaults.stroke})`;
  return {
    borderColor: stroke,
    background:
      nodeSurfaceFill(kind, value) ??
      `var(--zmd-board-surface, ${defaults.fill})`,
    borderWidth: value.strokeWidth ?? defaults.strokeWidth,
    borderStyle: resolvedStrokeStyle(value),
    borderRadius: kind === "ellipse" ? 999 : (value.radius ?? defaults.radius),
    ...verticalAlignmentStyle(value),
  } as const;
}

export function RectNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const model = data.model;
  if (model.kind !== "rect") return null;
  return (
    <div
      className={`zmd-board-shape is-rect${selected ? " is-selected" : ""}`}
      style={shapeStyle("rect", model.style)}
    >
      <NodeHandles />
      {model.data.title ? (
        <span style={labelTextStyle(model.style ?? {})}>
          {model.data.title}
        </span>
      ) : null}
    </div>
  );
}

export function EllipseNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const model = data.model;
  if (model.kind !== "ellipse") return null;
  return (
    <div
      className={`zmd-board-shape is-ellipse${selected ? " is-selected" : ""}`}
      style={shapeStyle("ellipse", model.style)}
    >
      <NodeHandles />
      {model.data.title ? (
        <span style={labelTextStyle(model.style ?? {})}>
          {model.data.title}
        </span>
      ) : null}
    </div>
  );
}

function StrokeShape({
  id,
  data,
  selected,
  width,
  height,
  arrow,
}: NodeProps<CanvasFlowNode> & { arrow?: boolean }) {
  const model = data.model;
  if (model.kind !== "line" && model.kind !== "arrow") return null;
  const style = model.style ?? {};
  const boxW = Math.max(width ?? 8, 8);
  const boxH = Math.max(height ?? 8, 8);
  const start = point(model.data.from, 0);
  const end = model.data.to ?? { x: boxW, y: boxH / 2 };
  const markerId = `zmd-board-arrow-${id}`;
  const stroke =
    nodeSurfaceStroke(model.kind, style) ??
    `var(--zmd-board-edge, ${canvasNodeSurfaceDefaults(model.kind).stroke})`;
  const fontSize = style.fontSize || 16;
  const maxTextHeight =
    Math.max(1, Math.floor(boxH / (fontSize * 1.25))) * fontSize * 1.25;
  return (
    <div
      className={`zmd-board-shape is-stroke${selected ? " is-selected" : ""}`}
    >
      <NodeHandles />
      <svg
        className="zmd-board-stroke"
        style={{ color: stroke }}
        viewBox={`0 0 ${boxW} ${boxH}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {arrow ? (
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          ) : null}
        </defs>
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="currentColor"
          strokeWidth={style.strokeWidth ?? 2}
          strokeDasharray={strokeDasharray(style)}
          markerEnd={arrow ? `url(#${markerId})` : undefined}
        />
      </svg>
      {model.data.title ? (
        <span
          className="zmd-board-stroke-label"
          style={{
            ...labelTextStyle(style),
            ...verticalAlignmentStyle(style),
            display: "flex",
            justifyContent:
              style.textAlign === "left"
                ? "flex-start"
                : style.textAlign === "right"
                  ? "flex-end"
                  : "center",
          }}
        >
          <span
            className="zmd-board-stroke-label-text"
            style={{ maxHeight: maxTextHeight }}
          >
            {model.data.title}
          </span>
        </span>
      ) : null}
    </div>
  );
}

export function LineNode(props: NodeProps<CanvasFlowNode>) {
  return <StrokeShape {...props} />;
}

export function ArrowNode(props: NodeProps<CanvasFlowNode>) {
  return <StrokeShape {...props} arrow />;
}
