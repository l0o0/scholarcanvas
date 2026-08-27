import type { WhiteboardLabels } from "../model/protocol";
import type { AcademicNode } from "../nodes";
import { getNodeSpec } from "../nodes";
import { IconCopy, IconEdit, IconOpen, IconTrash } from "../whiteboard/icons";

export function PropertiesPanel(props: {
  labels: WhiteboardLabels;
  node: AcademicNode | null;
  onEdit: (nodeId: string) => void;
  onOpen: (node: AcademicNode) => void;
  onCopy: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}) {
  const { node, labels } = props;
  if (!node) return null;
  const spec = getNodeSpec(node.type || node.data.kind);
  const canOpen = !!(
    node.data.itemID ||
    node.data.attachmentID ||
    node.data.noteID
  );

  return (
    <aside className="zmd-board-properties" aria-label="Selection">
      <header className="zmd-board-properties-head">
        <span className="zmd-board-card-kind">{spec.label}</span>
        <h2>{node.data.title || spec.label}</h2>
        {node.data.subtitle ? <p>{node.data.subtitle}</p> : null}
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
