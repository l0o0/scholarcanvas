import { useMemo } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { colorToHex } from "./color";
import type { WhiteboardLabels } from "../model/protocol";

export function ColorPicker(props: {
  title: string;
  labels: Pick<
    WhiteboardLabels,
    | "close"
    | "commonColors"
    | "transparent"
    | "resetColor"
    | "customColor"
    | "opacity"
  >;
  color: string;
  defaultColor: string;
  presets: string[];
  allowTransparent?: boolean;
  opacity?: number;
  onChange: (color: string) => void;
  onReset: () => void;
  onOpacityChange?: (opacity: number) => void;
  onClose: () => void;
}) {
  const color = useMemo(
    () => colorToHex(props.color) || "#1f2937",
    [props.color],
  );
  const transparent = props.color === "transparent";
  const opacity = props.opacity ?? 1;

  return (
    <div
      className="zmd-board-color-picker"
      onKeyDown={(event) => {
        if (event.key !== "Escape") event.stopPropagation();
      }}
    >
      <header>
        <strong>{props.title}</strong>
        <button
          type="button"
          aria-label={props.labels.close}
          onClick={props.onClose}
        >
          ×
        </button>
      </header>
      <div
        className="zmd-board-swatches is-palette"
        role="group"
        aria-label={props.labels.commonColors}
      >
        {props.presets.map((item) => (
          <button
            key={item}
            type="button"
            className={!transparent && color === item ? "is-active" : ""}
            aria-pressed={!transparent && color === item}
            aria-label={item}
            title={item}
            style={{ backgroundColor: item }}
            onClick={() => props.onChange(item)}
          />
        ))}
      </div>
      <div className="zmd-board-color-actions">
        {props.allowTransparent ? (
          <button
            type="button"
            aria-pressed={transparent}
            className={transparent ? "is-active" : ""}
            onClick={() => props.onChange("transparent")}
          >
            <span
              className="zmd-board-color-swatch is-transparent"
              aria-hidden="true"
            />
            {props.labels.transparent}
          </button>
        ) : null}
        <button type="button" onClick={props.onReset}>
          <span
            className={`zmd-board-color-swatch${props.defaultColor === "transparent" ? " is-transparent" : ""}`}
            style={{ backgroundColor: props.defaultColor }}
            aria-hidden="true"
          />
          {props.labels.resetColor}
        </button>
      </div>
      <details className="zmd-board-custom-color">
        <summary>{props.labels.customColor}</summary>
        <div className="zmd-board-custom-color-body">
          <HexColorPicker color={color} onChange={props.onChange} />
          <label className="zmd-board-color-hex">
            <span>Hex</span>
            <HexColorInput
              color={transparent ? "" : color}
              prefixed
              aria-label={`${props.title} (Hex)`}
              onChange={props.onChange}
              spellCheck={false}
            />
          </label>
          {props.onOpacityChange ? (
            <label className="zmd-board-color-opacity">
              <span>{props.labels.opacity}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(event) =>
                  props.onOpacityChange?.(Number(event.target.value) / 100)
                }
              />
              <output>{Math.round(opacity * 100)}%</output>
            </label>
          ) : null}
        </div>
      </details>
    </div>
  );
}
