import { useLayoutEffect, useRef, useState } from "react";

export interface FloatingStyleBarAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useFloatingStyleBar(props: {
  left: number;
  top: number;
  anchor?: FloatingStyleBarAnchor;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: props.left,
    top: props.top,
  });

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const host = bar.offsetParent ?? bar.parentElement;
    const topIsland =
      host?.querySelector<HTMLElement>(".zmd-board-top-island") ??
      (typeof document !== "undefined"
        ? document.querySelector<HTMLElement>(".zmd-board-top-island")
        : null);
    const measure = () => {
      const hostRect = host?.getBoundingClientRect();
      const originX = hostRect?.left ?? 0;
      const originY = hostRect?.top ?? 0;
      const right = Math.min(
        window.innerWidth,
        hostRect?.right || window.innerWidth,
      );
      const bottom = Math.min(
        window.innerHeight,
        hostRect?.bottom || window.innerHeight,
      );
      const rect = bar.getBoundingClientRect();
      const visibleTop = Math.max(0, originY) + 8;
      const requestedLeft = props.anchor
        ? props.anchor.x + (props.anchor.width - rect.width) / 2
        : props.left;
      let requestedTop = props.anchor
        ? props.anchor.y - rect.height - 12
        : props.top;
      if (props.anchor && requestedTop < visibleTop) {
        const below = props.anchor.y + props.anchor.height + 12;
        if (below + rect.height <= bottom - 8) requestedTop = below;
      }
      const left =
        Math.max(
          Math.max(0, originX) + 8,
          Math.min(requestedLeft, right - rect.width - 8),
        ) - originX;
      const leftScreen = left + originX;
      requestedTop = Math.max(
        visibleTop,
        Math.min(requestedTop, bottom - rect.height - 8),
      );
      const islandRect = topIsland?.getBoundingClientRect();
      const overlapsIsland = (candidateTop: number) =>
        !!islandRect &&
        leftScreen < islandRect.right &&
        leftScreen + rect.width > islandRect.left &&
        candidateTop < islandRect.bottom &&
        candidateTop + rect.height > islandRect.top;
      if (overlapsIsland(requestedTop)) {
        const below = props.anchor
          ? props.anchor.y + props.anchor.height + 12
          : undefined;
        if (
          below !== undefined &&
          below >= visibleTop &&
          below + rect.height <= bottom - 8 &&
          !overlapsIsland(below)
        ) {
          requestedTop = below;
        } else if (islandRect) {
          requestedTop = islandRect.bottom + 12;
        }
      }
      const top =
        Math.max(visibleTop, Math.min(requestedTop, bottom - rect.height - 8)) -
        originY;
      setPosition((current) =>
        current.left === left && current.top === top ? current : { left, top },
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(bar);
    if (host) observer?.observe(host);
    if (topIsland) observer?.observe(topIsland);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [
    props.left,
    props.top,
    props.anchor?.x,
    props.anchor?.y,
    props.anchor?.width,
    props.anchor?.height,
  ]);

  return { barRef, position };
}
