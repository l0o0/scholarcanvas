import { useCallback, useEffect, useRef, useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { colorPalette } from "./color";
import type { CanvasNodeStyle } from "../model/core";
import {
  canvasNodeUiSurfaceDefaults,
  getNoteType,
  type CanvasNodeKind,
} from "../model/academic";
import type { WhiteboardLabels } from "../model/protocol";
import type { WhiteboardTheme } from "../model/protocol";
import type { CanvasFlowNode } from "../nodes";

const WIDTHS = [1, 2, 4];
const RADII = [0, 8, 16, 32];

export function supportsFillStyle(kind: CanvasNodeKind): boolean {
  return kind !== "line" && kind !== "arrow";
}

export function supportsRadiusStyle(kind: CanvasNodeKind): boolean {
  return kind !== "ellipse" && kind !== "line" && kind !== "arrow";
}

export function StyleBar(props: {
  node: CanvasFlowNode;
  left: number;
  top: number;
  labels: WhiteboardLabels;
  theme: WhiteboardTheme;
  onChange: (
    patch: Partial<CanvasNodeStyle> & { width?: number; height?: number },
  ) => void;
}) {
  const [menu, setMenu] = useState<"stroke" | "fill" | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => {
    barRef.current
      ?.querySelector<HTMLButtonElement>(`[data-color-target="${menu}"]`)
      ?.focus();
    setMenu(null);
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [menu, closeMenu]);
  const { node } = props;
  const model = node.data.model;
  const style = model.style ?? {};
  const kind = model.kind;
  const defaults = canvasNodeUiSurfaceDefaults(
    kind,
    props.theme,
    model.kind === "note" ? getNoteType(model) : undefined,
  );
  const stroke = style.stroke || defaults.stroke;
  const fill =
    style.fillStyle === "none" ? "transparent" : style.fill || defaults.fill;
  const strokeWidth = style.strokeWidth ?? defaults.strokeWidth;
  const radius = style.radius ?? defaults.radius;
  const dashed =
    style.strokeStyle !== undefined
      ? style.strokeStyle !== "solid"
      : (style.dashed ?? defaults.strokeStyle !== "solid");
  const width = Math.round(node.width ?? 120);
  const height = Math.round(node.height ?? 80);
  const showFill = supportsFillStyle(kind);
  const showRadius = supportsRadiusStyle(kind);

  return (
    <div
      ref={barRef}
      className="zmd-board-style-bar"
      style={{ left: props.left, top: props.top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {(["stroke", "fill"] as const)
        .filter((target) => target === "stroke" || showFill)
        .map((target) => {
          const color = target === "stroke" ? stroke : fill;
          const title =
            target === "stroke" ? props.labels.stroke : props.labels.background;
          return (
            <span className="zmd-board-flyout" key={target}>
              <button
                type="button"
                data-color-target={target}
                title={title}
                aria-haspopup="dialog"
                aria-expanded={menu === target}
                className={menu === target ? "is-active" : ""}
                onClick={() => setMenu(menu === target ? null : target)}
              >
                <span
                  className={`zmd-board-color-swatch${color === "transparent" ? " is-transparent" : ""}`}
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                {title}
                <span aria-hidden="true">⌄</span>
              </button>
              {menu === target ? (
                <div
                  className="zmd-board-popover is-color"
                  role="dialog"
                  aria-label={title}
                >
                  <ColorPicker
                    title={title}
                    labels={props.labels}
                    color={color}
                    presets={colorPalette(
                      target === "fill"
                        ? props.theme === "light"
                        : props.theme === "dark",
                    )}
                    defaultColor={defaults[target]}
                    allowTransparent={target === "fill"}
                    onReset={() =>
                      props.onChange(
                        target === "stroke"
                          ? { stroke: undefined }
                          : { fill: undefined, fillStyle: undefined },
                      )
                    }
                    onChange={(next) =>
                      props.onChange(
                        target === "stroke"
                          ? { stroke: next }
                          : {
                              fill: next,
                              fillStyle:
                                next === "transparent"
                                  ? "none"
                                  : style.fillStyle === "hatch"
                                    ? "hatch"
                                    : "solid",
                            },
                      )
                    }
                    onClose={closeMenu}
                  />
                </div>
              ) : null}
            </span>
          );
        })}
      <label className="zmd-board-style-group">
        <select
          aria-label={props.labels.stroke}
          value={strokeWidth}
          onChange={(event) =>
            props.onChange({ strokeWidth: Number(event.target.value) })
          }
        >
          {WIDTHS.map((value) => (
            <option key={value} value={value}>
              {value}px
            </option>
          ))}
        </select>
      </label>
      <label className="zmd-board-style-group">
        <span>{props.labels.style}</span>
        <button
          type="button"
          className={dashed ? "is-active" : ""}
          onClick={() =>
            props.onChange({
              dashed: !dashed,
              strokeStyle: dashed ? "solid" : "dashed",
            })
          }
        >
          {dashed ? props.labels.dashed : props.labels.solid}
        </button>
      </label>
      {showRadius ? (
        <label className="zmd-board-style-group">
          <span>{props.labels.corners}</span>
          <select
            value={radius}
            onChange={(event) =>
              props.onChange({ radius: Number(event.target.value) })
            }
          >
            {Array.from(new Set([...RADII, radius]))
              .sort((a, b) => a - b)
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <label className="zmd-board-style-group">
        <span>W</span>
        <input
          type="number"
          min={8}
          value={width}
          onChange={(event) =>
            props.onChange({ width: Number(event.target.value) || width })
          }
        />
      </label>
      <label className="zmd-board-style-group">
        <span>H</span>
        <input
          type="number"
          min={8}
          value={height}
          onChange={(event) =>
            props.onChange({ height: Number(event.target.value) || height })
          }
        />
      </label>
    </div>
  );
}
