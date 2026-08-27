import { Handle, Position, type NodeProps } from "@xyflow/react";
import { labelTextStyle, verticalAlignmentStyle } from "../whiteboard/document";
import { CardShell } from "./CardShell";
import type { AcademicNode } from "./types";

function point(value: { x: number; y: number } | undefined, fallback: number) {
  return value ?? { x: fallback, y: fallback };
}

export function TextNode({ data, selected }: NodeProps<AcademicNode>) {
  return (
    <CardShell kind="text" selected={selected}>
      <p className="zmd-board-card-title" style={labelTextStyle(data)}>
        {data.title || "Text"}
      </p>
    </CardShell>
  );
}

function shapeStyle(data: AcademicNode["data"], ellipse?: boolean) {
  return {
    borderColor: data.stroke || "#1f2937",
    background: data.fill || "#ffffff",
    borderWidth: data.strokeWidth ?? 2,
    borderStyle: data.dashed ? "dashed" : "solid",
    borderRadius: ellipse ? 999 : (data.radius ?? 8),
    color: data.stroke || "#1f2937",
    ...verticalAlignmentStyle(data),
  } as const;
}

export function RectNode({ data, selected }: NodeProps<AcademicNode>) {
  return (
    <div
      className={`zmd-board-shape is-rect${selected ? " is-selected" : ""}`}
      style={shapeStyle(data)}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {data.title ? (
        <span style={labelTextStyle(data)}>{data.title}</span>
      ) : null}
    </div>
  );
}

export function EllipseNode({ data, selected }: NodeProps<AcademicNode>) {
  return (
    <div
      className={`zmd-board-shape is-ellipse${selected ? " is-selected" : ""}`}
      style={shapeStyle(data, true)}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {data.title ? (
        <span style={labelTextStyle(data)}>{data.title}</span>
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
}: NodeProps<AcademicNode> & { arrow?: boolean }) {
  const boxW = Math.max(width ?? 8, 8);
  const boxH = Math.max(height ?? 8, 8);
  const start = point(data.from, 0);
  const end = data.to ?? { x: boxW, y: boxH / 2 };
  const markerId = `zmd-board-arrow-${id}`;
  const stroke = data.stroke || "#1f2937";
  return (
    <div
      className={`zmd-board-shape is-stroke${selected ? " is-selected" : ""}`}
      style={{ color: stroke }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <svg
        className="zmd-board-stroke"
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
          strokeWidth={data.strokeWidth ?? 2}
          strokeDasharray={data.dashed ? "8 6" : undefined}
          markerEnd={arrow ? `url(#${markerId})` : undefined}
        />
      </svg>
      {data.title ? <span>{data.title}</span> : null}
    </div>
  );
}

export function LineNode(props: NodeProps<AcademicNode>) {
  return <StrokeShape {...props} />;
}

export function ArrowNode(props: NodeProps<AcademicNode>) {
  return <StrokeShape {...props} arrow />;
}
