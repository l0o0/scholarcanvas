import { canvasNodeUiSurfaceDefaults } from "../model/academic";
import { NoteTypeIcon } from "../whiteboard/icons";
import { noteTypePrompt } from "./labels";
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { WhiteboardLabels, WhiteboardTheme } from "../model/protocol";
import type { NoteTemplate } from "../model/note-template";
import {
  IconAlignBottom,
  IconAlignHCenter,
  IconAlignLeft,
  IconAlignRight,
  IconAlignTop,
  IconAlignVCenter,
  IconArrow,
  IconCheck,
  IconChevronDown,
  IconDistributeH,
  IconDistributeV,
  IconEllipse,
  IconEraser,
  IconFitView,
  IconFrame,
  IconHand,
  IconItem,
  IconLayout,
  IconLine,
  IconMore,
  IconNote,
  IconRect,
  IconRedo,
  IconSave,
  IconExport,
  IconSelect,
  IconText,
  IconUndo,
} from "../whiteboard/icons";
import type { CanvasTool } from "./tools";

interface ToolButton {
  tool: CanvasTool;
  title: string;
  icon: ReactElement;
}

export function TopIsland(props: {
  labels: WhiteboardLabels;
  theme?: WhiteboardTheme;
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  noteTemplates: NoteTemplate[];
  activeNoteTemplateId: string;
  onSelectNoteTemplate: (templateId: string) => void;
  saveState: "saved" | "saving" | "error";
  selectedNodeCount: number;
  selectedEdgeCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSwitchWindow?: () => void;
  onExportPng?: () => void;
  exportBusy?: boolean;
  onFitView: () => void;
  onAutoLayout: () => void;
  onAlign: (
    mode: "left" | "right" | "top" | "bottom" | "horizontal" | "vertical",
  ) => void;
  onDistribute: (direction: "horizontal" | "vertical") => void;
  onEdgeColor: () => void;
  onEdgeDash: () => void;
  onEdgeArrow: () => void;
  onOpenShortcuts: () => void;
}) {
  const { labels, activeTool, onSelectTool } = props;
  const [openMenu, setOpenMenu] = useState<"templates" | "more" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const templateTriggerRef = useRef<HTMLButtonElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const trigger =
        openMenu === "templates"
          ? templateTriggerRef.current
          : moreTriggerRef.current;
      setOpenMenu(null);
      trigger?.focus();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);
  const activeNoteTemplate =
    props.noteTemplates.find(
      (template) => template.id === props.activeNoteTemplateId,
    ) ?? props.noteTemplates[0];
  const groups: ToolButton[][] = [
    [
      { tool: "select", title: labels.select, icon: <IconSelect /> },
      { tool: "hand", title: labels.hand, icon: <IconHand /> },
    ],
    [{ tool: "literature", title: labels.addItem, icon: <IconItem /> }],
    [
      { tool: "note", title: labels.addNote, icon: <IconNote /> },
      {
        tool: "frame",
        title: `${labels.addFrame} (F)`,
        icon: <IconFrame />,
      },
    ],
    [{ tool: "text", title: `${labels.addText} (T)`, icon: <IconText /> }],
  ];
  const sideTools: ToolButton[] = [
    { tool: "rect", title: `${labels.addRect} (R)`, icon: <IconRect /> },
    {
      tool: "ellipse",
      title: `${labels.addEllipse} (O)`,
      icon: <IconEllipse />,
    },
    { tool: "arrow", title: `${labels.addArrow} (A)`, icon: <IconArrow /> },
    { tool: "line", title: `${labels.addLine} (L)`, icon: <IconLine /> },
    { tool: "eraser", title: `${labels.eraser} (E)`, icon: <IconEraser /> },
  ];

  return (
    <div ref={menuRef} className="zmd-board-toolbars">
      <div
        className="zmd-board-top-island"
        role="toolbar"
        aria-label={labels.canvas}
      >
        {groups.map((group, index) => (
          <div key={index} className="zmd-board-top-group">
            {group.map((item) => (
              <button
                key={item.tool}
                type="button"
                title={item.title}
                aria-label={item.title}
                aria-pressed={activeTool === item.tool}
                className={activeTool === item.tool ? "is-active" : ""}
                onClick={() => {
                  setOpenMenu(null);
                  onSelectTool(item.tool);
                }}
              >
                {item.icon}
              </button>
            ))}
            {group.some((item) => item.tool === "note") ? (
              <div className="zmd-board-template">
                <button
                  ref={templateTriggerRef}
                  type="button"
                  className="zmd-board-template-trigger"
                  title={labels.addNote}
                  aria-label={labels.addNote}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "templates"}
                  onClick={() =>
                    setOpenMenu((current) =>
                      current === "templates" ? null : "templates",
                    )
                  }
                >
                  <span>{activeNoteTemplate?.name ?? labels.addNote}</span>
                  <IconChevronDown />
                </button>
                {openMenu === "templates" ? (
                  <div
                    className="zmd-board-template-menu"
                    role="menu"
                    aria-label={labels.addNote}
                  >
                    {props.noteTemplates.map((template) => {
                      const active = template.id === props.activeNoteTemplateId;
                      const surface = {
                        ...canvasNodeUiSurfaceDefaults(
                          "note",
                          props.theme ?? "light",
                          template.noteType,
                        ),
                        ...template.style,
                      };
                      return (
                        <button
                          key={template.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            props.onSelectNoteTemplate(template.id);
                            props.onSelectTool("note");
                            setOpenMenu(null);
                            templateTriggerRef.current?.focus();
                          }}
                        >
                          {template.noteType ? (
                            <span
                              className="zmd-board-template-preview"
                              style={{
                                background: surface.fill,
                                borderColor: surface.stroke,
                                borderRadius: surface.radius / 2,
                                borderStyle: template.style.dashed
                                  ? "dashed"
                                  : surface.strokeStyle,
                                borderWidth: surface.strokeWidth,
                              }}
                            >
                              <NoteTypeIcon type={template.noteType} />
                            </span>
                          ) : null}
                          <span className="zmd-board-template-option">
                            <span>{template.name}</span>
                            {template.noteType ? (
                              <small>
                                {noteTypePrompt(labels, template.noteType)}
                              </small>
                            ) : null}
                          </span>
                          {active ? <IconCheck /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
        <div className="zmd-board-more">
          <button
            ref={moreTriggerRef}
            type="button"
            title={labels.more}
            aria-haspopup="menu"
            aria-expanded={openMenu === "more"}
            className={openMenu === "more" ? "is-active" : ""}
            onClick={() =>
              setOpenMenu((current) => (current === "more" ? null : "more"))
            }
          >
            <IconMore />
          </button>
          {openMenu === "more" ? (
            <div className="zmd-board-more-menu" role="menu">
              {props.onSwitchWindow ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null);
                    props.onSwitchWindow?.();
                  }}
                >
                  {labels.switchWindow}
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  props.onOpenShortcuts();
                }}
              >
                {labels.shortcutsTitle}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="zmd-board-side-island"
        role="toolbar"
        aria-label={labels.more}
        aria-orientation="vertical"
      >
        <div className="zmd-board-top-group">
          {sideTools.map((item) => (
            <button
              key={item.tool}
              type="button"
              title={item.title}
              aria-label={item.title}
              aria-pressed={activeTool === item.tool}
              className={activeTool === item.tool ? "is-active" : ""}
              onClick={() => {
                setOpenMenu(null);
                onSelectTool(item.tool);
              }}
            >
              {item.icon}
            </button>
          ))}
        </div>
        <span className="zmd-board-toolbar-sep" />
        <button type="button" title={labels.undo} onClick={props.onUndo}>
          <IconUndo />
        </button>
        <button type="button" title={labels.redo} onClick={props.onRedo}>
          <IconRedo />
        </button>
        <button type="button" title={labels.save} onClick={props.onSave}>
          <IconSave />
        </button>
        {props.onExportPng ? (
          <button
            type="button"
            title={`${labels.exportPng} · 2×`}
            aria-label={`${labels.exportPng} · 2×`}
            disabled={props.exportBusy}
            onClick={props.onExportPng}
          >
            <IconExport />
          </button>
        ) : null}
        <span className={`zmd-board-save-state is-${props.saveState}`}>
          {props.saveState === "saving"
            ? labels.saving
            : props.saveState === "error"
              ? labels.saveFailed
              : labels.saved}
        </span>
        {props.selectedNodeCount >= 2 ? (
          <div className="zmd-board-top-group">
            <span className="zmd-board-toolbar-sep" />
            <button
              type="button"
              title={labels.alignLeft}
              onClick={() => props.onAlign("left")}
            >
              <IconAlignLeft />
            </button>
            <button
              type="button"
              title={labels.alignRight}
              onClick={() => props.onAlign("right")}
            >
              <IconAlignRight />
            </button>
            <button
              type="button"
              title={labels.alignTop}
              onClick={() => props.onAlign("top")}
            >
              <IconAlignTop />
            </button>
            <button
              type="button"
              title={labels.alignBottom}
              onClick={() => props.onAlign("bottom")}
            >
              <IconAlignBottom />
            </button>
            <button
              type="button"
              title={labels.alignHorizontal}
              onClick={() => props.onAlign("horizontal")}
            >
              <IconAlignHCenter />
            </button>
            <button
              type="button"
              title={labels.alignVertical}
              onClick={() => props.onAlign("vertical")}
            >
              <IconAlignVCenter />
            </button>
            {props.selectedNodeCount >= 3 ? (
              <>
                <button
                  type="button"
                  title={labels.distributeHorizontal}
                  onClick={() => props.onDistribute("horizontal")}
                >
                  <IconDistributeH />
                </button>
                <button
                  type="button"
                  title={labels.distributeVertical}
                  onClick={() => props.onDistribute("vertical")}
                >
                  <IconDistributeV />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {props.selectedEdgeCount >= 1 ? (
          <div className="zmd-board-top-group">
            <span className="zmd-board-toolbar-sep" />
            <button
              type="button"
              title={labels.edgeColor}
              onClick={props.onEdgeColor}
            >
              <IconLine />
            </button>
            <button
              type="button"
              title={labels.edgeDash}
              onClick={props.onEdgeDash}
            >
              <IconLine />
            </button>
            <button
              type="button"
              title={labels.edgeArrow}
              onClick={props.onEdgeArrow}
            >
              <IconArrow />
            </button>
          </div>
        ) : null}
        <span className="zmd-board-toolbar-sep" />
        <button type="button" title={labels.fitView} onClick={props.onFitView}>
          <IconFitView />
        </button>
        <button
          type="button"
          title={labels.autoLayout}
          onClick={props.onAutoLayout}
        >
          <IconLayout />
        </button>
      </div>
    </div>
  );
}
