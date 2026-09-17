import { useState } from "react";
import {
  NOTE_TYPES,
  getNoteType,
  getNoteTitle,
  isNoteType,
  type NoteType,
  type NoteNode,
} from "../model/academic";
import {
  BUILTIN_NOTE_TEMPLATE_IDS,
  NOTE_TEMPLATE_LIMITS,
  type NoteTemplate,
} from "../model/note-template";
import type { WhiteboardLabels } from "../model/protocol";
import { noteTypeLabel, noteTypePrompt } from "./labels";
import { IconCopy, IconTrash } from "../whiteboard/icons";

const BUILTIN_IDS = new Set<string>(Object.values(BUILTIN_NOTE_TEMPLATE_IDS));

export function NoteTemplateControls(props: {
  labels: WhiteboardLabels;
  note: NoteNode;
  templates: NoteTemplate[];
  onBadgeChange: (badge: string) => void;
  onTypeChange: (type: NoteType) => void;
  onApply: (templateId: string) => void;
  onSave: (name: string, includeContent: boolean) => void;
  onRename: (templateId: string, name: string) => void;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
}) {
  const { labels, note, templates } = props;
  const [name, setName] = useState("");
  const [includeContent, setIncludeContent] = useState(false);
  const customTemplates = templates.filter(
    (template) => !BUILTIN_IDS.has(template.id),
  );

  return (
    <section className="zmd-board-note-template-controls">
      <label>
        <span>{labels.noteType}</span>
        <select
          aria-label={labels.noteType}
          value={getNoteType(note)}
          onChange={(event) => {
            const type = event.currentTarget.value;
            if (isNoteType(type)) props.onTypeChange(type);
          }}
        >
          {NOTE_TYPES.map((type) => (
            <option key={type} value={type}>
              {noteTypeLabel(labels, type)}
            </option>
          ))}
        </select>
      </label>
      <p className="zmd-board-note-prompt">
        {noteTypePrompt(labels, getNoteType(note))}
      </p>
      <label>
        <span>{labels.badge}</span>
        <input
          type="text"
          value={getNoteTitle(note) ?? ""}
          maxLength={NOTE_TEMPLATE_LIMITS.badge}
          onChange={(event) => props.onBadgeChange(event.currentTarget.value)}
        />
      </label>
      <details className="zmd-board-template-manager">
        <summary>{labels.customTemplates}</summary>
        {customTemplates.length ? (
          <label>
            <span>{labels.applyTemplate}</span>
            <select
              value=""
              onChange={(event) => {
                if (event.currentTarget.value)
                  props.onApply(event.currentTarget.value);
              }}
            >
              <option value="">{labels.chooseTemplate}</option>
              {customTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="zmd-board-template-save">
          <label>
            <span>{labels.templateName}</span>
            <input
              type="text"
              value={name}
              maxLength={NOTE_TEMPLATE_LIMITS.name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <label className="zmd-board-template-check">
            <input
              type="checkbox"
              checked={includeContent}
              onChange={(event) =>
                setIncludeContent(event.currentTarget.checked)
              }
            />
            <span>{labels.includeTemplateContent}</span>
          </label>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              const nextName = name.trim();
              if (!nextName) return;
              props.onSave(nextName, includeContent);
              setName("");
              setIncludeContent(false);
            }}
          >
            {labels.saveAsTemplate}
          </button>
        </div>
        {customTemplates.length ? (
          <div className="zmd-board-custom-templates">
            {customTemplates.map((template) => (
              <div
                key={`${template.id}:${template.updatedAt}`}
                className="zmd-board-custom-template-row"
              >
                <input
                  aria-label={labels.renameTemplate}
                  defaultValue={template.name}
                  maxLength={NOTE_TEMPLATE_LIMITS.name}
                  onBlur={(event) => {
                    const nextName = event.currentTarget.value.trim();
                    if (nextName && nextName !== template.name) {
                      props.onRename(template.id, nextName);
                    }
                  }}
                />
                <button
                  type="button"
                  title={labels.duplicateTemplate}
                  aria-label={labels.duplicateTemplate}
                  onClick={() => props.onDuplicate(template.id)}
                >
                  <IconCopy />
                </button>
                <button
                  type="button"
                  title={labels.deleteTemplate}
                  aria-label={labels.deleteTemplate}
                  onClick={() => props.onDelete(template.id)}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="zmd-board-template-empty">{labels.noCustomTemplates}</p>
        )}
      </details>
    </section>
  );
}
