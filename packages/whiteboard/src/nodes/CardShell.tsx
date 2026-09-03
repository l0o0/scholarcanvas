import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import type { CanvasNodeKind } from "../model/academic";

export function CardShell(props: {
  kind: CanvasNodeKind;
  kindLabel: string;
  selected?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={`zmd-board-card is-${props.kind}${props.selected ? " is-selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <span className="zmd-board-card-kind">{props.kindLabel}</span>
      {props.children}
    </article>
  );
}
