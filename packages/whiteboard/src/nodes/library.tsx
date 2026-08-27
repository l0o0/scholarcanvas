import type { NodeProps } from "@xyflow/react";
import { CardShell } from "./CardShell";
import type { AcademicNode } from "./types";

export function ItemNode({ data, selected }: NodeProps<AcademicNode>) {
  return (
    <CardShell kind="item" selected={selected}>
      <h3 className="zmd-board-card-title">{data.title}</h3>
      {data.subtitle ? (
        <p className="zmd-board-card-meta">{data.subtitle}</p>
      ) : null}
    </CardShell>
  );
}

export function NoteNode({ data, selected }: NodeProps<AcademicNode>) {
  return (
    <CardShell kind="note" selected={selected}>
      <h3 className="zmd-board-card-title">{data.title}</h3>
      {data.preview ? (
        <p className="zmd-board-card-preview">{data.preview}</p>
      ) : (
        <p className="zmd-board-card-meta">Empty note</p>
      )}
    </CardShell>
  );
}

export function PdfNode({ data, selected }: NodeProps<AcademicNode>) {
  return (
    <CardShell kind="pdf" selected={selected}>
      {data.image ? (
        <img
          className="zmd-board-pdf-image"
          src={data.image}
          alt={data.title || "PDF page"}
        />
      ) : (
        <div className="zmd-board-pdf-page" aria-hidden="true">
          <span>{data.pdfPage ? `p. ${data.pdfPage}` : "PDF"}</span>
        </div>
      )}
      <h3 className="zmd-board-card-title">{data.title}</h3>
      {data.subtitle ? (
        <p className="zmd-board-card-meta">{data.subtitle}</p>
      ) : null}
    </CardShell>
  );
}

export function AttachmentNode({ data, selected }: NodeProps<AcademicNode>) {
  return (
    <CardShell kind="attachment" selected={selected}>
      <h3 className="zmd-board-card-title">{data.title}</h3>
      {data.subtitle ? (
        <p className="zmd-board-card-meta">{data.subtitle}</p>
      ) : null}
    </CardShell>
  );
}
