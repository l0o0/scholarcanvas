import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import type { BoardNodeKind } from "../model/snapshot";

const LABELS: Record<BoardNodeKind, string> = {
  item: "Item",
  note: "Note",
  pdf: "PDF",
  attachment: "File",
  text: "Text",
  rect: "Shape",
  ellipse: "Shape",
  line: "Line",
  arrow: "Arrow",
};

export function CardShell(props: {
  kind: BoardNodeKind;
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
      <span className="zmd-board-card-kind">{LABELS[props.kind]}</span>
      {props.children}
    </article>
  );
}
