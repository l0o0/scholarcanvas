export type AcademicRelation = "related" | "supports" | "contradicts";

export interface CanvasConnectionBase {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  color?: string;
  dashed?: boolean;
  arrow?: boolean;
  extensions?: Record<string, unknown>;
}

export interface BasicConnection extends CanvasConnectionBase {
  kind: "basic";
}

export interface AcademicConnection extends CanvasConnectionBase {
  kind: "academic";
  relation: AcademicRelation;
}

export type CanvasConnection = BasicConnection | AcademicConnection;

export function createAcademicConnection(
  id: string,
  source: string,
  target: string,
  relation: AcademicRelation = "related",
): AcademicConnection {
  return { id, kind: "academic", source, target, relation };
}
