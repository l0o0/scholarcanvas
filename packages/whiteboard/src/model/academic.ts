import type { BasicNode, BasicNodeKind } from "./basic";
import type { CanvasNodeBase, CanvasPoint } from "./core";

export type AcademicNodeKind =
  "literature" | "quote" | "note" | "question" | "claim" | "frame";

export type ZoteroLibraryRef =
  { type: "user" } | { type: "group"; groupID: number };

export interface LiteratureSource {
  library: ZoteroLibraryRef;
  itemKey: string;
}

export interface QuoteSource extends LiteratureSource {
  attachmentKey: string;
  annotationKey: string;
}

export interface NoteSource {
  library: ZoteroLibraryRef;
  noteKey: string;
  itemKey?: string;
}

export interface LiteratureSnapshot {
  title: string;
  creators?: string;
  year?: string;
  publicationTitle?: string;
  tags?: string[];
  annotationCount?: number;
}

export interface QuoteSnapshot {
  text: string;
  comment?: string;
  citation?: string;
  pageLabel?: string;
  color?: string;
}

export interface NoteSourceSnapshot {
  title?: string;
}

export interface LiteratureNode extends CanvasNodeBase<"literature"> {
  source: LiteratureSource;
  snapshot: LiteratureSnapshot;
}

export interface QuoteNode extends CanvasNodeBase<"quote"> {
  source: QuoteSource;
  snapshot: QuoteSnapshot;
}

export interface NoteNode extends CanvasNodeBase<"note"> {
  content: string;
  source?: NoteSource;
  sourceSnapshot?: NoteSourceSnapshot;
}

export interface QuestionNode extends CanvasNodeBase<"question"> {
  content: string;
}

export interface ClaimNode extends CanvasNodeBase<"claim"> {
  content: string;
}

export interface FrameNode extends Omit<CanvasNodeBase<"frame">, "frameId"> {
  title: string;
}

export type AcademicNode =
  LiteratureNode | QuoteNode | NoteNode | QuestionNode | ClaimNode | FrameNode;

export type CanvasNode = BasicNode | AcademicNode;
export type CanvasNodeKind = BasicNodeKind | AcademicNodeKind;

export interface LiteratureNodeOptions {
  source: LiteratureSource;
  snapshot: LiteratureSnapshot;
}

export interface QuoteNodeOptions {
  source: QuoteSource;
  snapshot: QuoteSnapshot;
}

export function createAcademicNode(
  kind: "literature",
  position: CanvasPoint,
  id: string,
  options: LiteratureNodeOptions,
): LiteratureNode;
export function createAcademicNode(
  kind: "quote",
  position: CanvasPoint,
  id: string,
  options: QuoteNodeOptions,
): QuoteNode;
export function createAcademicNode(
  kind: "note",
  position: CanvasPoint,
  id: string,
): NoteNode;
export function createAcademicNode(
  kind: "question",
  position: CanvasPoint,
  id: string,
): QuestionNode;
export function createAcademicNode(
  kind: "claim",
  position: CanvasPoint,
  id: string,
): ClaimNode;
export function createAcademicNode(
  kind: "frame",
  position: CanvasPoint,
  id: string,
): FrameNode;
export function createAcademicNode(
  kind: AcademicNodeKind,
  position: CanvasPoint,
  id: string,
  options?: LiteratureNodeOptions | QuoteNodeOptions,
): AcademicNode {
  switch (kind) {
    case "literature":
      return {
        id,
        kind,
        position,
        width: 280,
        height: 136,
        source: (options as LiteratureNodeOptions).source,
        snapshot: (options as LiteratureNodeOptions).snapshot,
      };
    case "quote":
      return {
        id,
        kind,
        position,
        width: 280,
        height: 168,
        source: (options as QuoteNodeOptions).source,
        snapshot: (options as QuoteNodeOptions).snapshot,
      };
    case "note":
      return { id, kind, position, width: 260, height: 152, content: "" };
    case "question":
    case "claim":
      return { id, kind, position, width: 260, height: 128, content: "" };
    case "frame":
      return { id, kind, position, width: 480, height: 320, title: "Frame" };
  }
}
