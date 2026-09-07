import { createAcademicNode } from "./academic";
import { createBasicNode } from "./basic";
import { createAcademicConnection } from "./connection";
import { CANVAS_DOCUMENT_VERSION, type CanvasDocument } from "./document";
import type { AcademicAcquisition } from "./protocol";

export interface TutorialCanvasLabels {
  title: string;
  welcome: string;
  welcomeBody: string;
  sourceNotice: string;
  addLiterature: string;
  addLiteratureBody: string;
  browseQuotes: string;
  browseQuotesBody: string;
  writeNote: string;
  writeNoteBody: string;
  questionBadge: string;
  claimBadge: string;
  organize: string;
  organizeBody: string;
  practice: string;
  practiceBody: string;
  supports: string;
}

export interface TutorialCanvasSample {
  literature: Extract<AcademicAcquisition, { kind: "literature" }>;
  quotes: Array<Extract<AcademicAcquisition, { kind: "quote" }>>;
  note?: Extract<AcademicAcquisition, { kind: "note" }>;
}

const headingStyle = {
  fontSize: 28,
  fontWeight: "bold",
  textAlign: "left",
  verticalAlign: "middle",
} as const;

const guideStyle = {
  stroke: "#94a3b8",
  strokeWidth: 2,
  radius: 12,
  fontSize: 16,
  fontWeight: "bold",
  textAlign: "left",
  verticalAlign: "top",
} as const;

const thoughtStyle = {
  stroke: "#eab308",
  strokeWidth: 2,
  radius: 12,
} as const;

const frameStyle = {
  fill: "transparent",
  stroke: "#64748b",
  strokeWidth: 2,
  radius: 12,
  strokeStyle: "dashed",
} as const;

const sampleStyle = {
  fill: "#eff6ff",
  stroke: "#60a5fa",
  strokeWidth: 2,
  radius: 12,
  textColor: "#172554",
} as const;

export function tutorialCanvasDocument(
  labels: TutorialCanvasLabels,
  sample?: TutorialCanvasSample,
): CanvasDocument {
  const title = createBasicNode("text", { x: 0, y: 0 }, "tutorial-title");
  const welcome = createAcademicNode(
    "note",
    { x: 0, y: 120 },
    "tutorial-welcome",
    {
      badge: labels.welcome,
      content: labels.welcomeBody,
      height: 200,
      width: 280,
      style: guideStyle,
    },
  );
  const sourceNotice = createBasicNode(
    "text",
    { x: 360, y: 340 },
    "tutorial-source-notice",
  );
  const addLiterature = guideNode(
    "tutorial-add-literature",
    360,
    labels.addLiterature,
    labels.addLiteratureBody,
  );
  const browseQuotes = guideNode(
    "tutorial-browse-quotes",
    720,
    labels.browseQuotes,
    labels.browseQuotesBody,
  );
  const writeNote = guideNode(
    "tutorial-write-note",
    1080,
    labels.writeNote,
    labels.writeNoteBody,
  );
  const question = createAcademicNode(
    "note",
    { x: 1080, y: 340 },
    "tutorial-question",
    {
      badge: labels.questionBadge,
      content: "",
      style: thoughtStyle,
    },
  );
  const claim = createAcademicNode(
    "note",
    { x: 1080, y: 520 },
    "tutorial-claim",
    {
      badge: labels.claimBadge,
      content: "",
      style: thoughtStyle,
    },
  );
  const organize = {
    ...createAcademicNode("frame", { x: 1440, y: 120 }, "tutorial-organize"),
    width: 320,
    height: 620,
    title: labels.organize,
    style: { ...frameStyle },
  };
  const organizeBody = {
    ...createAcademicNode(
      "note",
      { x: 1470, y: 190 },
      "tutorial-organize-body",
      { content: labels.organizeBody, style: guideStyle },
    ),
    frameId: organize.id,
  };
  const practice = {
    ...createAcademicNode("frame", { x: 1820, y: 120 }, "tutorial-practice"),
    width: 400,
    height: 620,
    title: labels.practice,
    style: { ...frameStyle },
  };
  const practiceBody = {
    ...createAcademicNode(
      "note",
      { x: 1850, y: 190 },
      "tutorial-practice-body",
      { content: labels.practiceBody, width: 340, style: guideStyle },
    ),
    frameId: practice.id,
  };

  const nodes: CanvasDocument["nodes"] = [
    {
      ...title,
      width: 1060,
      data: { title: labels.title },
      style: { ...headingStyle },
    },
    welcome,
    {
      ...sourceNotice,
      width: 640,
      height: 64,
      data: { title: labels.sourceNotice },
      style: {
        fill: "transparent",
        stroke: "transparent",
        fontSize: 12,
        fontWeight: "normal",
        textAlign: "left",
        verticalAlign: "top",
      },
    },
    addLiterature,
    browseQuotes,
    writeNote,
    question,
    claim,
    organize,
    organizeBody,
    practice,
    practiceBody,
  ];

  const connections: CanvasDocument["connections"] = [
    createAcademicConnection(
      "tutorial-path-welcome-literature",
      welcome.id,
      addLiterature.id,
    ),
    createAcademicConnection(
      "tutorial-path-literature-quotes",
      addLiterature.id,
      browseQuotes.id,
    ),
    createAcademicConnection(
      "tutorial-path-quotes-note",
      browseQuotes.id,
      writeNote.id,
    ),
    createAcademicConnection(
      "tutorial-path-note-organize",
      writeNote.id,
      organizeBody.id,
    ),
    createAcademicConnection(
      "tutorial-path-organize-practice",
      organizeBody.id,
      practiceBody.id,
    ),
    {
      ...createAcademicConnection(
        "tutorial-supports",
        browseQuotes.id,
        claim.id,
        "supports",
      ),
      label: labels.supports,
    },
  ];

  if (sample) {
    const literature = {
      ...createAcademicNode(
        "literature",
        { x: 360, y: 440 },
        "tutorial-sample-literature",
        {
          source: copySource(sample.literature.source),
          snapshot: {
            ...sample.literature.snapshot,
            ...(sample.literature.snapshot.tags
              ? { tags: [...sample.literature.snapshot.tags] }
              : {}),
          },
        },
      ),
      style: { ...sampleStyle },
    };
    const quotes = sample.quotes.slice(0, 2).map((quote, index) => ({
      ...createAcademicNode(
        "quote",
        { x: 720, y: 440 + index * 220 },
        `tutorial-sample-quote-${index + 1}`,
        {
          source: copySource(quote.source),
          snapshot: { ...quote.snapshot },
        },
      ),
      style: { ...sampleStyle },
    }));
    nodes.push(literature, ...quotes);

    if (sample.note) {
      const note = {
        ...createAcademicNode(
          "note",
          { x: 1080, y: 700 },
          "tutorial-sample-note",
          { content: sample.note.content, style: sampleStyle },
        ),
        source: copySource(sample.note.source),
        ...(sample.note.sourceSnapshot
          ? { sourceSnapshot: { ...sample.note.sourceSnapshot } }
          : {}),
      };
      nodes.push(note);
      if (quotes[0]) {
        connections.push({
          ...createAcademicConnection(
            "tutorial-sample-supports",
            quotes[0].id,
            note.id,
            "supports",
          ),
          label: labels.supports,
        });
      }
    }
  }

  return {
    version: CANVAS_DOCUMENT_VERSION,
    nodes,
    connections,
    viewport: { x: 40, y: 40, zoom: 0.85 },
  };
}

function guideNode(id: string, x: number, title: string, body: string) {
  return createAcademicNode("note", { x, y: 120 }, id, {
    badge: title,
    content: body,
    width: 280,
    height: 200,
    style: guideStyle,
  });
}

function copySource<Source extends { library: object }>(
  source: Source,
): Source {
  return { ...source, library: { ...source.library } };
}
