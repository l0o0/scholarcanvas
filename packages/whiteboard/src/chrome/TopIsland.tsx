import { useEffect, useRef, useState, type ReactElement } from "react";
import type { WhiteboardLabels } from "../model/protocol";
import {
  IconAlignBottom,
  IconAlignHCenter,
  IconAlignLeft,
  IconAlignRight,
  IconAlignTop,
  IconAlignVCenter,
  IconArrow,
  IconClaim,
  IconDistributeH,
  IconDistributeV,
  IconEllipse,
  IconEraser,
  IconFile,
  IconFitView,
  IconFrame,
  IconHand,
  IconItem,
  IconLayout,
  IconLine,
  IconMore,
  IconNote,
  IconPdf,
  IconQuestion,
  IconRect,
  IconRedo,
  IconSave,
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
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  saveState: "saved" | "saving" | "error";
  selectedNodeCount: number;
  selectedEdgeCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);
  const groups: ToolButton[][] = [
    [
      { tool: "select", title: labels.select, icon: <IconSelect /> },
      { tool: "hand", title: labels.hand, icon: <IconHand /> },
    ],
    [
      { tool: "item", title: labels.addItem, icon: <IconItem /> },
      { tool: "pdf", title: labels.addPdf, icon: <IconPdf /> },
      { tool: "attachment", title: labels.addFile, icon: <IconFile /> },
    ],
    [
      { tool: "note", title: labels.addNote, icon: <IconNote /> },
      {
        tool: "question",
        title: `${labels.addQuestion} (Q)`,
        icon: <IconQuestion />,
      },
      {
        tool: "claim",
        title: `${labels.addClaim} (C)`,
        icon: <IconClaim />,
      },
      {
        tool: "frame",
        title: `${labels.addFrame} (F)`,
        icon: <IconFrame />,
      },
    ],
    [
      { tool: "rect", title: `${labels.addRect} (R)`, icon: <IconRect /> },
      {
        tool: "ellipse",
        title: `${labels.addEllipse} (O)`,
        icon: <IconEllipse />,
      },
      { tool: "arrow", title: `${labels.addArrow} (A)`, icon: <IconArrow /> },
      { tool: "line", title: `${labels.addLine} (L)`, icon: <IconLine /> },
      { tool: "text", title: `${labels.addText} (T)`, icon: <IconText /> },
      { tool: "eraser", title: `${labels.eraser} (E)`, icon: <IconEraser /> },
    ],
  ];

  return (
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
              onClick={() => onSelectTool(item.tool)}
            >
              {item.icon}
            </button>
          ))}
        </div>
      ))}
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
      <div className="zmd-board-more" ref={menuRef}>
        <button
          type="button"
          title={labels.more}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={menuOpen ? "is-active" : ""}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <IconMore />
        </button>
        {menuOpen ? (
          <div className="zmd-board-more-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                props.onOpenShortcuts();
              }}
            >
              {labels.shortcutsTitle}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
