import type { WhiteboardLabels } from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";
import { getNodeSpec } from "../nodes";
import { flowNodeText } from "../whiteboard/document";
import { IconCopy, IconEdit, IconOpen, IconTrash } from "../whiteboard/icons";

export function PropertiesPanel(props: {
  labels: WhiteboardLabels;
  node: CanvasFlowNode | null;
  onEdit: (nodeId: string) => void;
  onOpen: (node: CanvasFlowNode) => void;
  onCopy: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}) {
  const { node, labels } = props;
  if (!node) return null;
  const model = node.data.model;
  const spec = getNodeSpec(model.kind);
  const data = "data" in model ? model.data : undefined;
  const canOpen = !!(
    data &&
    (("itemID" in data && data.itemID) ||
      ("attachmentID" in data && data.attachmentID))
  );
  const subtitle =
    data && "subtitle" in data && typeof data.subtitle === "string"
      ? data.subtitle
      : undefined;

  return (
    <aside className="zmd-board-properties" aria-label="Selection">
      <header className="zmd-board-properties-head">
        <span className="zmd-board-card-kind">{spec.label}</span>
        <h2>{flowNodeText(node) || spec.label}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="zmd-board-properties-actions">
        <button type="button" onClick={() => props.onEdit(node.id)}>
          <IconEdit />
          <span>{labels.editText}</span>
        </button>
        {canOpen ? (
          <button type="button" onClick={() => props.onOpen(node)}>
            <IconOpen />
            <span>{labels.openItem}</span>
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
