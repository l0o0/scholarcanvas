import type { WhiteboardLabels } from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";
import { nodeKindLabel } from "./labels";
import { flowNodeText } from "../whiteboard/document";
import { IconCopy, IconEdit, IconOpen, IconTrash } from "../whiteboard/icons";
import type { SourceResolutionState } from "../whiteboard/sourceState";
import type { Ref } from "react";

export function PropertiesPanel(props: {
  labels: WhiteboardLabels;
  node: CanvasFlowNode | null;
  sourceState?: SourceResolutionState;
  onEdit: (nodeId: string) => void;
  onOpen: (node: CanvasFlowNode) => void;
  onRefreshSource: (node: CanvasFlowNode) => void;
  onViewAnnotations: (node: CanvasFlowNode) => void;
  viewAnnotationsRef?: Ref<HTMLButtonElement>;
  onCopy: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}) {
  const { node, labels } = props;
  if (!node) return null;
  const model = node.data.model;
  const hasSource =
    model.kind === "literature" ||
    model.kind === "quote" ||
    (model.kind === "note" && !!model.source);
  const kindLabel = nodeKindLabel(labels, model.kind);
  const data = "data" in model ? model.data : undefined;
  const canOpen = !!(
    data &&
    (("itemID" in data && data.itemID) ||
      ("attachmentID" in data && data.attachmentID))
  );
  const subtitle =
    model.kind === "note" && model.sourceSnapshot?.title
      ? model.sourceSnapshot.title
      : data && "subtitle" in data && typeof data.subtitle === "string"
        ? data.subtitle
        : undefined;
  const sourceStatus =
    props.sourceState?.status === "unavailable"
      ? labels.sourceMissing
      : props.sourceState?.status === "loading"
        ? labels.sourceLoading
        : props.sourceState?.status === "resolved"
          ? labels.sourceAvailable
          : labels.sourceIdle;

  return (
    <aside className="zmd-board-properties" aria-label="Selection">
      <header className="zmd-board-properties-head">
        <span className="zmd-board-card-kind">{kindLabel}</span>
        <h2>{flowNodeText(node) || kindLabel}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        {hasSource ? (
          <p
            className="zmd-board-source-status"
            data-source-status={props.sourceState?.status ?? "idle"}
          >
            {labels.sourceStatus}: {sourceStatus}
          </p>
        ) : null}
      </header>
      <div className="zmd-board-properties-actions">
        <button type="button" onClick={() => props.onEdit(node.id)}>
          <IconEdit />
          <span>{labels.editText}</span>
        </button>
        {hasSource ? (
          <button type="button" onClick={() => props.onOpen(node)}>
            <IconOpen />
            <span>{labels.openSource}</span>
          </button>
        ) : canOpen ? (
          <button type="button" onClick={() => props.onOpen(node)}>
            <IconOpen />
            <span>{labels.openItem}</span>
          </button>
        ) : null}
        {model.kind === "note" && model.source ? (
          <button type="button" onClick={() => props.onRefreshSource(node)}>
            <IconOpen />
            <span>{labels.refreshNote}</span>
          </button>
        ) : null}
        {model.kind === "literature" || model.kind === "quote" ? (
          <button type="button" onClick={() => props.onRefreshSource(node)}>
            <IconOpen />
            <span>{labels.refreshSource}</span>
          </button>
        ) : null}
        {model.kind === "literature" ? (
          <button
            ref={props.viewAnnotationsRef}
            type="button"
            onClick={() => props.onViewAnnotations(node)}
          >
            <IconOpen />
            <span>{labels.viewAnnotations}</span>
          </button>
        ) : null}
        <button type="button" onClick={() => props.onCopy(node.id)}>
          <IconCopy />
          <span>{labels.copy}</span>
        </button>
        <button type="button" onClick={() => props.onDelete(node.id)}>
          <IconTrash />
          <span>{labels.delete}</span>
        </button>
      </div>
    </aside>
  );
}
