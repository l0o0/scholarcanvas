export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasViewport extends CanvasPoint {
  zoom: number;
}

export interface CanvasMetadata {
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasNodeStyle {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  radius?: number;
  dashed?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  textColor?: string;
  textOpacity?: number;
  strokeOpacity?: number;
  fillStyle?: "none" | "solid" | "hatch";
  strokeStyle?: "solid" | "dotted" | "dashed";
}

export interface CanvasNodeBase<K extends string> {
  id: string;
  kind: K;
  position: CanvasPoint;
  width: number;
  height: number;
  frameId?: string;
  style?: CanvasNodeStyle;
  extensions?: Record<string, unknown>;
}
