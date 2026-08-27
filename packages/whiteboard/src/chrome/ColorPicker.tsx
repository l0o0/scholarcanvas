import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PRESET_COLORS, hexToHsv, hsvToHex, normalizeHex } from "./color";
import type { WhiteboardLabels } from "../model/protocol";

export function ColorPicker(props: {
  title: string;
  labels: Pick<WhiteboardLabels, "close" | "commonColors" | "recentColors">;
  color: string;
  opacity?: number;
  onChange: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
  onClose: () => void;
  extra?: ReactNode;
}) {
  const color = normalizeHex(props.color) || "#1f2937";
  const hsv = useMemo(() => hexToHsv(color), [color]);
  const [hexDraft, setHexDraft] = useState(color.replace("#", ""));
  const padRef = useRef<HTMLDivElement>(null);
  const opacity = props.opacity ?? 1;

  useEffect(() => {
    setHexDraft(color.replace("#", ""));
  }, [color]);

  const applyPad = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const box = pad.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const v = Math.min(1, Math.max(0, 1 - (clientY - box.top) / box.height));
    props.onChange(hsvToHex({ h: hsv.h, s, v }));
  };

  return (
    <div className="zmd-board-color-picker">
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
      {props.extra}
      <div
        ref={padRef}
        className="zmd-board-color-pad"
        style={{
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, ${hsvToHex({ h: hsv.h, s: 1, v: 1 })})
          `,
        }}
        onPointerDown={(event) => {
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          applyPad(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          applyPad(event.clientX, event.clientY);
        }}
      >
        <span
          className="zmd-board-color-knob"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        className="zmd-board-color-hue"
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        onChange={(event) =>
          props.onChange(
            hsvToHex({ h: Number(event.target.value), s: hsv.s, v: hsv.v }),
          )
        }
      />
      {props.onOpacityChange ? (
        <input
          className="zmd-board-color-alpha"
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(event) =>
            props.onOpacityChange?.(Number(event.target.value) / 100)
          }
        />
      ) : null}
      <p className="zmd-board-color-label">{props.labels.commonColors}</p>
      <div className="zmd-board-swatches is-lg">
        {PRESET_COLORS.map((item) => (
          <button
            key={item}
            type="button"
            className={color === item ? "is-active" : ""}
            style={{ background: item }}
            onClick={() => props.onChange(item)}
          />
        ))}
      </div>
      <p className="zmd-board-color-label">{props.labels.recentColors}</p>
      <label className="zmd-board-color-hex">
        <span>#</span>
        <input
          value={hexDraft}
          onChange={(event) => {
            const next = event.target.value.replace("#", "");
            setHexDraft(next);
            const normalized = normalizeHex(next);
            if (normalized) props.onChange(normalized);
          }}
        />
      </label>
    </div>
  );
}
