import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasNodeStyle } from "../model/core";
import { nodeTextStyle } from "../whiteboard/document";
import type { CanvasConnection } from "../model/connection";
import type { WhiteboardLabels } from "../model/protocol";

export function connectionDisplayLabel(
  connection: CanvasConnection,
  labels: WhiteboardLabels,
  rawEdgeLabel?: string,
): string | undefined {
  if (connection.label !== undefined) return connection.label;
  if (rawEdgeLabel !== undefined) return rawEdgeLabel;
  if (connection.kind !== "academic") return undefined;
  switch (connection.relation) {
    case "related":
      return labels.relationRelated;
    case "supports":
      return labels.relationSupports;
    case "contradicts":
      return labels.relationContradicts;
  }
}

export function ConnectionEditor(props: {
  labels: WhiteboardLabels;
  value: string;
  left: number;
  top: number;
  zoom?: number;
  textStyle?: CanvasNodeStyle;
  onHeightChange?: (height: number) => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  const [value, setValue] = useState(props.value);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (
        (event.target as Element)?.closest(
          ".zmd-board-connection-editor, .zmd-board-style-bar.is-text",
        )
      )
        return;
      if (!finished.current) {
        finished.current = true;
        props.onCommit(value);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [value, props.onCommit]);

  useLayoutEffect(() => {
    const element = inputRef.current?.parentElement;
    if (!element) return;
    const measure = () => props.onHeightChange?.(element.offsetHeight);
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [props.onHeightChange]);

  const finish = (cancel = false) => {
    if (finished.current) return;
    finished.current = true;
    if (cancel) props.onCancel();
    else props.onCommit(value);
  };

  return (
    <div
      className="zmd-board-connection-editor nodrag nopan"
      style={{
        ...nodeTextStyle(props.textStyle ?? {}),
        left: props.left,
        top: props.top,
        transform: `translate(-50%, -50%) scale(${props.zoom ?? 1})`,
      }}
      onBlur={(event) => {
        if (
          (event.relatedTarget as Element | null)?.closest(
            ".zmd-board-style-bar.is-text",
          )
        )
          return;
        finish();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (
          event.key === "Escape" ||
          (event.key === "Enter" && !event.shiftKey)
        ) {
          event.preventDefault();
          finish(event.key === "Escape");
        }
      }}
    >
      <span className="zmd-board-connection-measure" aria-hidden="true">
        {value + "\u200b"}
      </span>
      <textarea
        ref={inputRef}
        rows={1}
        cols={1}
        value={value}
        aria-label={props.labels.edgeLabel}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}
