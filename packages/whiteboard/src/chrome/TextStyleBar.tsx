import { useEffect, useState, type CSSProperties } from "react";
import type { BoardNodeData } from "../model/snapshot";
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
  { value: "system-ui, sans-serif", label: "系统字体" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: '"Times New Roman", Times, serif', label: "Times" },
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: "Menlo, monospace", label: "Menlo" },
  { value: '"Noto Serif SC", serif', label: "宋体" },
];

const SIZES = [12, 14, 16, 18, 24, 32, 48];
const WEIGHTS = [
  { value: "normal", label: "Regular" },
  { value: "bold", label: "Bold" },
] as const;

type TextMenu = "format" | "color" | "align" | null;

export function isEditableControl(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") {
    return false;
  }
  return Boolean(
    (target as Element).closest("select, option, input, textarea"),
  );
}

export function labelTextStyle(data: BoardNodeData): CSSProperties {
  return {
    fontFamily: data.fontFamily || "system-ui, sans-serif",
    fontSize: data.fontSize || 16,
    fontWeight: data.fontWeight || "normal",
    fontStyle: data.fontStyle || "normal",
    textDecoration: data.textDecoration || "none",
    textAlign: data.textAlign || "center",
    color: data.textColor || "#111827",
    opacity: data.textOpacity ?? 1,
    width: "100%",
    display: "block",
  };
}

export function TextStyleBar(props: {
  data: BoardNodeData;
  left: number;
  top: number;
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
          title="粗体"
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
          title="颜色"
          className={menu === "color" ? "is-active" : ""}
          onClick={() => toggle("color")}
        >
          <span className="zmd-board-color-letter" style={{ color }}>
            A
          </span>
          颜色
        </button>
        {menu === "color" ? (
          <div className="zmd-board-popover is-color">
            <ColorPicker
              title="颜色"
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
              {font.label}
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
            <option key={weight.value} value={weight.value}>
              {weight.label}
            </option>
          ))}
        </select>
      </label>
      <label className="zmd-board-style-group">
        <span>大小</span>
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
          title="对齐"
          className={menu === "align" ? "is-active" : ""}
          onClick={() => toggle("align")}
        >
          对齐
        </button>
        {menu === "align" ? (
          <div className="zmd-board-popover is-align">
            <p>文本对齐</p>
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
            <p>垂直对齐</p>
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
