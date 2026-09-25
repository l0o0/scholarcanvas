import type { NodeProps } from "@xyflow/react";
import { useWhiteboardLabels } from "../chrome/labels";
import { nodeTextStyle } from "../whiteboard/document";
import { CardShell } from "./CardShell";
import type { CanvasFlowNode } from "./types";

export function ItemNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== "item") return null;
  return (
    <CardShell
      kind="item"
      kindLabel={labels.addItem}
      selected={selected}
      nodeStyle={model.style}
    >
      <h3
        className="zmd-board-card-title"
        style={nodeTextStyle(model.style ?? {})}
      >
        {model.data.title}
      </h3>
      {model.data.subtitle ? (
        <p className="zmd-board-card-meta">{model.data.subtitle}</p>
      ) : null}
    </CardShell>
  );
}

export function PdfNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== "pdf") return null;
  return (
    <CardShell
      kind="pdf"
      kindLabel={labels.addPdf}
      selected={selected}
      nodeStyle={model.style}
    >
      {model.data.image ? (
        <img
          className="zmd-board-pdf-image"
          src={model.data.image}
          alt={model.data.title || labels.addPdf}
        />
      ) : model.data.source ? null : (
        <div className="zmd-board-pdf-page" aria-hidden="true">
          <span>{model.data.pdfPage ? model.data.pdfPage : labels.addPdf}</span>
        </div>
      )}
      <h3
        className="zmd-board-card-title"
        style={nodeTextStyle(model.style ?? {})}
      >
        {model.data.title}
      </h3>
      {model.data.subtitle || model.data.contentType ? (
        <p className="zmd-board-card-meta">
          {model.data.subtitle || model.data.contentType}
        </p>
      ) : null}
      {model.data.availability === "not-downloaded" ? (
        <p className="zmd-board-card-meta">
          {labels.attachmentNotDownloaded}
        </p>
      ) : null}
    </CardShell>
  );
}

export function AttachmentNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== "attachment") return null;
  return (
    <CardShell
      kind="attachment"
      kindLabel={labels.addFile}
      selected={selected}
      nodeStyle={model.style}
    >
      <h3
        className="zmd-board-card-title"
        style={nodeTextStyle(model.style ?? {})}
      >
        {model.data.title}
      </h3>
      {model.data.subtitle || model.data.contentType ? (
        <p className="zmd-board-card-meta">
          {model.data.subtitle || model.data.contentType}
        </p>
      ) : null}
      {model.data.availability === "not-downloaded" ? (
        <p className="zmd-board-card-meta">
          {labels.attachmentNotDownloaded}
        </p>
      ) : null}
      {model.data.preview ? (
        <p
          className="zmd-board-attachment-preview"
          style={nodeTextStyle(model.style ?? {})}
        >
          {model.data.preview}
        </p>
      ) : null}
    </CardShell>
  );
}
