import type { NodeProps } from "@xyflow/react";
import { useWhiteboardLabels } from "../chrome/labels";
import { CardShell } from "./CardShell";
import type { CanvasFlowNode } from "./types";

function citationLine(parts: Array<string | undefined>) {
  const text = parts.filter(Boolean).join(" · ");
  return text ? <p className="zmd-board-card-meta">{text}</p> : null;
}

export function LiteratureNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== "literature") return null;
  const { snapshot } = model;
  return (
    <CardShell
      kind="literature"
      kindLabel={labels.kindLiterature}
      selected={selected}
    >
      <h3 className="zmd-board-card-title">{snapshot.title}</h3>
      {citationLine([snapshot.creators, snapshot.year])}
      {snapshot.publicationTitle ? (
        <p className="zmd-board-card-meta">{snapshot.publicationTitle}</p>
      ) : null}
      {snapshot.tags?.length ? (
        <div className="zmd-board-card-tags">
          {snapshot.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {snapshot.annotationCount !== undefined ? (
        <p className="zmd-board-card-count">
          {snapshot.annotationCount} {labels.annotations}
        </p>
      ) : null}
    </CardShell>
  );
}

export function QuoteNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== "quote") return null;
  const { snapshot } = model;
  return (
    <CardShell kind="quote" kindLabel={labels.kindQuote} selected={selected}>
      <span
        className="zmd-board-quote-color"
        style={{ backgroundColor: snapshot.color }}
        aria-hidden="true"
      />
      <p className="zmd-board-card-content">{snapshot.text}</p>
      {snapshot.comment ? (
        <p className="zmd-board-card-comment">{snapshot.comment}</p>
      ) : null}
      {citationLine([snapshot.citation, snapshot.pageLabel])}
    </CardShell>
  );
}

function AcademicTextNode({
  data,
  selected,
  kind,
}: NodeProps<CanvasFlowNode> & { kind: "note" | "question" | "claim" }) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== kind) return null;
  const kindLabel =
    kind === "note"
      ? labels.kindNote
      : kind === "question"
        ? labels.kindQuestion
        : labels.kindClaim;
  return (
    <CardShell kind={kind} kindLabel={kindLabel} selected={selected}>
      <p className="zmd-board-card-content" style={{ whiteSpace: "pre-wrap" }}>
        {model.content}
      </p>
    </CardShell>
  );
}

export function NoteNode(props: NodeProps<CanvasFlowNode>) {
  return <AcademicTextNode {...props} kind="note" />;
}

export function QuestionNode(props: NodeProps<CanvasFlowNode>) {
  return <AcademicTextNode {...props} kind="question" />;
}

export function ClaimNode(props: NodeProps<CanvasFlowNode>) {
  return <AcademicTextNode {...props} kind="claim" />;
}

export function FrameNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const labels = useWhiteboardLabels();
  const model = data.model;
  if (model.kind !== "frame") return null;
  return (
    <section
      className={`zmd-board-frame${selected ? " is-selected" : ""}`}
      aria-label={`${labels.kindFrame}: ${model.title}`}
    >
      <span className="zmd-board-frame-kind">{labels.kindFrame}</span>
      <h3>{model.title}</h3>
    </section>
  );
}
