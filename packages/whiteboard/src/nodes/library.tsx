import type { NodeProps } from "@xyflow/react";
import { CardShell } from "./CardShell";
import type { CanvasFlowNode } from "./types";

export function ItemNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const model = data.model;
  if (model.kind !== "item") return null;
  return (
    <CardShell kind="item" selected={selected}>
      <h3 className="zmd-board-card-title">{model.data.title}</h3>
      {model.data.subtitle ? (
        <p className="zmd-board-card-meta">{model.data.subtitle}</p>
      ) : null}
    </CardShell>
  );
}

export function NoteNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const model = data.model;
  if (model.kind !== "note") return null;
  return (
    <CardShell kind="note" selected={selected}>
      {model.sourceSnapshot?.title ? (
        <h3 className="zmd-board-card-title">{model.sourceSnapshot.title}</h3>
      ) : null}
      {model.content ? (
        <p className="zmd-board-card-preview">{model.content}</p>
      ) : (
        <p className="zmd-board-card-meta">Empty note</p>
      )}
    </CardShell>
  );
}

export function PdfNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const model = data.model;
  if (model.kind !== "pdf") return null;
  return (
    <CardShell kind="pdf" selected={selected}>
      {model.data.image ? (
        <img
          className="zmd-board-pdf-image"
          src={model.data.image}
          alt={model.data.title || "PDF page"}
        />
      ) : (
        <div className="zmd-board-pdf-page" aria-hidden="true">
          <span>{model.data.pdfPage ? `p. ${model.data.pdfPage}` : "PDF"}</span>
        </div>
      )}
      <h3 className="zmd-board-card-title">{model.data.title}</h3>
      {model.data.subtitle ? (
        <p className="zmd-board-card-meta">{model.data.subtitle}</p>
      ) : null}
    </CardShell>
  );
}

export function AttachmentNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const model = data.model;
  if (model.kind !== "attachment") return null;
  return (
    <CardShell kind="attachment" selected={selected}>
      <h3 className="zmd-board-card-title">{model.data.title}</h3>
      {model.data.subtitle ? (
        <p className="zmd-board-card-meta">{model.data.subtitle}</p>
      ) : null}
    </CardShell>
  );
}
