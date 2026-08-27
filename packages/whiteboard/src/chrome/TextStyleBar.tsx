import { useEffect, useState } from "react";
import type { BoardNodeData } from "../model/snapshot";
import type { WhiteboardLabels } from "../model/protocol";
import { ColorPicker } from "./ColorPicker";
import {
  IconAlignTextCenter,
  IconAlignTextLeft,
  IconAlignTextRight,
  IconBold,
  IconItalic,
  IconStrike,
  IconUnderline,
  IconValignBottom,
  IconValignMiddle,
  IconValignTop,
} from "../whiteboard/icons";

const FONTS = [
  { value: "system-ui, sans-serif", label: "fontSystem" },
  { value: "Georgia, serif", label: "fontGeorgia" },
  { value: '"Times New Roman", Times, serif', label: "fontTimes" },
  { value: "Inter, system-ui, sans-serif", label: "fontInter" },
  { value: "Menlo, monospace", label: "fontMenlo" },
  { value: '"Noto Serif SC", serif', label: "fontSerifSc" },
] as const;

const SIZES = [12, 14, 16, 18, 24, 32, 48];
const WEIGHTS = ["normal", "bold"] as const;

type TextMenu = "format" | "color" | "align" | null;

export function isEditableControl(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") {
    return false;
  }
  return Boolean(
    (target as Element).closest("select, option, input, textarea"),
  );
}

export function TextStyleBar(props: {
  data: BoardNodeData;
  left: number;
  top: number;
  labels: WhiteboardLabels;
  onChange: (patch: Partial<BoardNodeData>) => void;
  onHoldFocus?: () => void;
}) {
  const { data } = props;
  const [menu, setMenu] = useState<TextMenu>(null);
  const bold = data.fontWeight === "bold";
  const italic = data.fontStyle === "italic";
  const underline = data.textDecoration === "underline";
  const strike = data.textDecoration === "line-through";
  const align = data.textAlign || "center";
  const valign = data.verticalAlign || "middle";
  const fontSize = data.fontSize || 16;
  const fontFamily = data.fontFamily || "system-ui, sans-serif";
  const color = data.textColor || "#111827";

  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".zmd-board-style-bar, .zmd-board-popover")) {
        setMenu(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menu]);

  const toggle = (next: TextMenu) =>
    setMenu((current) => (current === next ? null : next));

  return (
    <div
      className="zmd-board-style-bar is-text"
      style={{ left: props.left, top: props.top }}
      onPointerDown={(event) => {
        props.onHoldFocus?.();
        event.stopPropagation();
        if (!isEditableControl(event.target)) event.preventDefault();
      }}
    >
      <span className="zmd-board-flyout">
        <button
          type="button"
          title={props.labels.format}
          className={bold || menu === "format" ? "is-active" : ""}
          onClick={() => toggle("format")}
        >
          B
        </button>
        {menu === "format" ? (
          <div className="zmd-board-popover is-mini">
            <button
              type="button"
              className={bold ? "is-active" : ""}
              onClick={() =>
                props.onChange({ fontWeight: bold ? "normal" : "bold" })
              }
            >
              <IconBold />B
            </button>
            <button
              type="button"
              className={italic ? "is-active" : ""}
              onClick={() =>
                props.onChange({
                  fontStyle: italic ? "normal" : "italic",
                })
              }
            >
              <IconItalic />I
            </button>
            <button
              type="button"
              className={underline ? "is-active" : ""}
              onClick={() =>
                props.onChange({
                  textDecoration: underline ? "none" : "underline",
                })
              }
            >
              <IconUnderline />U
            </button>
            <button
              type="button"
              className={strike ? "is-active" : ""}
              onClick={() =>
                props.onChange({
                  textDecoration: strike ? "none" : "line-through",
                })
              }
            >
              <IconStrike />
            </button>
          </div>
        ) : null}
      </span>
      <span className="zmd-board-flyout">
        <button
          type="button"
          title={props.labels.color}
          className={menu === "color" ? "is-active" : ""}
          onClick={() => toggle("color")}
        >
          <span className="zmd-board-color-letter" style={{ color }}>
            A
          </span>
          {props.labels.color}
        </button>
        {menu === "color" ? (
          <div className="zmd-board-popover is-color">
            <ColorPicker
              title={props.labels.color}
              labels={props.labels}
              color={color}
              opacity={data.textOpacity ?? 1}
              onChange={(next) => props.onChange({ textColor: next })}
              onOpacityChange={(next) => props.onChange({ textOpacity: next })}
              onClose={() => setMenu(null)}
            />
          </div>
        ) : null}
      </span>
      <label className="zmd-board-style-group">
        <select
          value={fontFamily}
          onChange={(event) =>
            props.onChange({ fontFamily: event.target.value })
          }
        >
          {FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {props.labels[font.label]}
            </option>
          ))}
        </select>
      </label>
      <label className="zmd-board-style-group">
        <select
          value={data.fontWeight || "normal"}
          onChange={(event) =>
            props.onChange({
              fontWeight: event.target.value as "normal" | "bold",
            })
          }
        >
          {WEIGHTS.map((weight) => (
            <option key={weight} value={weight}>
              {weight === "bold"
                ? props.labels.weightBold
                : props.labels.weightRegular}
            </option>
          ))}
        </select>
      </label>
      <label className="zmd-board-style-group">
        <span>{props.labels.size}</span>
        <select
          value={fontSize}
          onChange={(event) =>
            props.onChange({ fontSize: Number(event.target.value) })
          }
        >
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="zmd-board-flyout">
        <button
          type="button"
          title={props.labels.alignment}
          className={menu === "align" ? "is-active" : ""}
          onClick={() => toggle("align")}
        >
          {props.labels.alignment}
        </button>
        {menu === "align" ? (
          <div className="zmd-board-popover is-align">
            <p>{props.labels.textAlignment}</p>
            <div className="zmd-board-align-row">
              <button
                type="button"
                className={align === "left" ? "is-active" : ""}
                onClick={() => props.onChange({ textAlign: "left" })}
              >
                <IconAlignTextLeft />
              </button>
              <button
                type="button"
                className={align === "center" ? "is-active" : ""}
                onClick={() => props.onChange({ textAlign: "center" })}
              >
                <IconAlignTextCenter />
              </button>
              <button
                type="button"
                className={align === "right" ? "is-active" : ""}
                onClick={() => props.onChange({ textAlign: "right" })}
              >
                <IconAlignTextRight />
              </button>
            </div>
            <p>{props.labels.verticalAlignment}</p>
            <div className="zmd-board-align-row">
              <button
                type="button"
                className={valign === "top" ? "is-active" : ""}
                onClick={() => props.onChange({ verticalAlign: "top" })}
              >
                <IconValignTop />
              </button>
              <button
                type="button"
                className={valign === "middle" ? "is-active" : ""}
                onClick={() => props.onChange({ verticalAlign: "middle" })}
              >
                <IconValignMiddle />
              </button>
              <button
                type="button"
                className={valign === "bottom" ? "is-active" : ""}
                onClick={() => props.onChange({ verticalAlign: "bottom" })}
              >
                <IconValignBottom />
              </button>
            </div>
          </div>
        ) : null}
      </span>
    </div>
  );
}
