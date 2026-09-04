import { createContext, useContext, type ReactNode } from "react";
import type { CanvasNodeKind } from "../model/academic";
import type { WhiteboardLabels } from "../model/protocol";

const WhiteboardLabelsContext = createContext<WhiteboardLabels | null>(null);

export function WhiteboardLabelsProvider(props: {
  value: WhiteboardLabels;
  children: ReactNode;
}) {
  return (
    <WhiteboardLabelsContext.Provider value={props.value}>
      {props.children}
    </WhiteboardLabelsContext.Provider>
  );
}

export function useWhiteboardLabels(): WhiteboardLabels {
  const labels = useContext(WhiteboardLabelsContext);
  if (!labels) {
    throw new Error(
      "useWhiteboardLabels must be used inside WhiteboardLabelsProvider.",
    );
  }
  return labels;
}

export function nodeKindLabel(
  labels: WhiteboardLabels,
  kind: CanvasNodeKind,
): string {
  switch (kind) {
    case "item":
      return labels.addItem;
    case "pdf":
      return labels.addPdf;
    case "attachment":
      return labels.addFile;
    case "text":
      return labels.addText;
    case "rect":
      return labels.addRect;
    case "ellipse":
      return labels.addEllipse;
    case "line":
      return labels.addLine;
    case "arrow":
      return labels.addArrow;
    case "literature":
      return labels.kindLiterature;
    case "quote":
      return labels.kindQuote;
    case "note":
      return labels.kindNote;
    case "question":
      return labels.kindQuestion;
    case "claim":
      return labels.kindClaim;
    case "frame":
      return labels.kindFrame;
  }
}
