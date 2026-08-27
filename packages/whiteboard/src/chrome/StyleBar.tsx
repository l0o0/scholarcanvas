import type { AcademicNode } from "../nodes";
import type { BoardNodeData } from "../model/snapshot";

const STROKES = ["#1f2937", "#2563eb", "#dc2626", "#059669", "#d97706"];
const FILLS = ["transparent", "#ffffff", "#f3f4f6", "#dbeafe"];
const WIDTHS = [1, 2, 4];
const RADII = [0, 8, 16, 32];

export function StyleBar(props: {
  node: AcademicNode;
  left: number;
  top: number;
  onChange: (
    patch: Partial<BoardNodeData> & { width?: number; height?: number },
  ) => void;
}) {
  const { node } = props;
  const data = node.data;
  const kind = node.type || data.kind;
  const stroke = data.stroke || "#1f2937";
  const fill = data.fill || "#ffffff";
  const strokeWidth = data.strokeWidth ?? 2;
  const radius = data.radius ?? 8;
  const width = Math.round(node.width ?? 120);
  const height = Math.round(node.height ?? 80);
  const showFill = kind === "rect" || kind === "ellipse";
  const showRadius = kind === "rect";

  return (
    <div
      className="zmd-board-style-bar"
      style={{ left: props.left, top: props.top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label className="zmd-board-style-group">
        <span>描边</span>
        <span className="zmd-board-swatches">
          {STROKES.map((color) => (
            <button
              key={color}
              type="button"
              className={stroke === color ? "is-active" : ""}
              style={{ background: color }}
              aria-label={color}
              onClick={() => props.onChange({ stroke: color })}
            />
          ))}
        </span>
      </label>
      <label className="zmd-board-style-group">
        <span>{strokeWidth}px</span>
        <select
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
      {showFill ? (
        <label className="zmd-board-style-group">
          <span>背景</span>
          <span className="zmd-board-swatches">
            {FILLS.map((color) => (
              <button
                key={color}
                type="button"
                className={fill === color ? "is-active" : ""}
                style={{
                  background: color === "transparent" ? "#fff" : color,
                  backgroundImage:
                    color === "transparent"
                      ? "linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%)"
                      : undefined,
                  backgroundSize:
                    color === "transparent" ? "8px 8px" : undefined,
                }}
                aria-label={color}
                onClick={() => props.onChange({ fill: color })}
              />
            ))}
          </span>
        </label>
      ) : null}
      <label className="zmd-board-style-group">
        <span>样式</span>
        <button
          type="button"
          className={data.dashed ? "is-active" : ""}
          onClick={() => props.onChange({ dashed: !data.dashed })}
        >
          {data.dashed ? "虚线" : "实线"}
        </button>
      </label>
      {showRadius ? (
        <label className="zmd-board-style-group">
          <span>边角</span>
          <select
            value={radius}
            onChange={(event) =>
              props.onChange({ radius: Number(event.target.value) })
            }
          >
            {RADII.map((value) => (
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
