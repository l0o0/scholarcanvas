/**
 * iframe-side whiteboard: React + @xyflow/react.
 */
/// <reference lib="dom" />

import { createRoot } from "react-dom/client";
import { WhiteboardApp, type WhiteboardRuntime } from "./whiteboard/app";
import {
  WHITEBOARD_MESSAGE_SOURCE,
  WHITEBOARD_PROTOCOL_VERSION,
  isWhiteboardProtocolMessageForChannel,
  type ParentToWhiteboardMessage,
  type WhiteboardTheme,
} from "./model/protocol";
import { emptyCanvasDocument, type CanvasDocument } from "./model/document";
import {
  createDeferredLabels,
  forwardAcademicParentMessage,
} from "./bootstrapState";

const channel = new URL(window.location.href).searchParams.get("channel") || "";

let theme: WhiteboardTheme = "light";
let pendingSnapshot: CanvasDocument | null = null;
const deferredLabels = createDeferredLabels();
let runtime: WhiteboardRuntime | null = null;
let rev = 0;

function postToParent(message: {
  type:
    | "ready"
    | "change"
    | "snapshot"
    | "save"
    | "error"
    | "pickAcademicSource"
    | "resolveAcademicSources"
    | "openAcademicSource"
    | "openItem"
    | "dropAcademicSources"
    | "listLiteratureAnnotations"
    | "refreshZoteroNote"
    | "exportFile";
  payload?: unknown;
}) {
  window.parent?.postMessage(
    {
      source: WHITEBOARD_MESSAGE_SOURCE,
      channel,
      v: WHITEBOARD_PROTOCOL_VERSION,
      ...message,
    },
    "*",
  );
}

function applyDocumentTheme(next: WhiteboardTheme) {
  theme = next;
  document.documentElement.dataset.theme = next;
  document.body.style.background = next === "dark" ? "#1a1d24" : "#fbfbfc";
}

function handleParentMessage(data: ParentToWhiteboardMessage) {
  if (forwardAcademicParentMessage(runtime, data)) return;
  switch (data.type) {
    case "init":
      applyDocumentTheme(data.payload.theme);
      pendingSnapshot = data.payload.snapshot ?? null;
      deferredLabels.receive(data.payload.labels);
      runtime?.setTheme(data.payload.theme);
      if (data.payload.snapshot) runtime?.loadSnapshot(data.payload.snapshot);
      break;
    case "setTheme":
      applyDocumentTheme(data.payload.theme);
      runtime?.setTheme(data.payload.theme);
      break;
    case "loadSnapshot":
      pendingSnapshot = data.payload.snapshot;
      runtime?.loadSnapshot(data.payload.snapshot);
      break;
    case "requestSnapshot":
      postToParent({
        type: "snapshot",
        payload: {
          requestId: data.payload.requestId,
          rev,
          snapshot:
            runtime?.getSnapshot() ?? pendingSnapshot ?? emptyCanvasDocument(),
        },
      });
      break;
    case "command":
      if (data.payload.command === "undo") runtime?.undo();
      if (data.payload.command === "redo") runtime?.redo();
      break;
    case "saveState":
      runtime?.setSaveState(data.payload.state);
      break;
    case "focus":
      window.focus();
      document.getElementById("whiteboard-root")?.focus();
      break;
    case "destroy":
      runtime = null;
      deferredLabels.detach();
      break;
    default:
      break;
  }
}

function onWindowMessage(event: MessageEvent) {
  if (event.source !== window.parent) return;
  if (!isWhiteboardProtocolMessageForChannel(event.data, channel)) return;
  try {
    handleParentMessage(event.data as ParentToWhiteboardMessage);
  } catch (error) {
    postToParent({
      type: "error",
      payload: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function boot() {
  const host = document.getElementById("whiteboard-root");
  if (!host) {
    postToParent({
      type: "error",
      payload: { message: "Missing #whiteboard-root" },
    });
    return;
  }
  applyDocumentTheme("light");
  window.addEventListener("message", onWindowMessage);
  window.addEventListener("keydown", (event) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      postToParent({ type: "save" });
      return;
    }
    if (key === "z") {
      event.preventDefault();
      if (event.shiftKey) runtime?.redo();
      else runtime?.undo();
      return;
    }
    if (key === "y") {
      event.preventDefault();
      runtime?.redo();
    }
  });
  createRoot(host).render(
    <WhiteboardApp
      theme={theme}
      labels={deferredLabels.current}
      initialSnapshot={pendingSnapshot ?? undefined}
      onReady={(next) => {
        runtime = next;
        deferredLabels.attach(next);
        if (pendingSnapshot) next.loadSnapshot(pendingSnapshot);
        next.setTheme(theme);
      }}
      onChange={(nextRev) => {
        rev = nextRev;
        postToParent({ type: "change", payload: { rev } });
      }}
      onError={(message) =>
        postToParent({ type: "error", payload: { message } })
      }
      onSave={() => postToParent({ type: "save" })}
      onPickAcademicSource={(requestId, nodeId, kind) =>
        postToParent({
          type: "pickAcademicSource",
          payload: { requestId, nodeId, kind },
        })
      }
      onOpenItem={(payload) => postToParent({ type: "openItem", payload })}
      onDropAcademicSources={(requestId, nodeId, raw) =>
        postToParent({
          type: "dropAcademicSources",
          payload: { requestId, nodeId, raw },
        })
      }
      onResolveAcademicSources={(requestId, generation, priority, sources) =>
        postToParent({
          type: "resolveAcademicSources",
          payload: { requestId, generation, priority, sources },
        })
      }
      onOpenAcademicSource={(requestId, source) =>
        postToParent({
          type: "openAcademicSource",
          payload: { requestId, source },
        })
      }
      onListLiteratureAnnotations={(requestId, source) =>
        postToParent({
          type: "listLiteratureAnnotations",
          payload: { requestId, source },
        })
      }
      onRefreshZoteroNote={(requestId, nodeId, source) =>
        postToParent({
          type: "refreshZoteroNote",
          payload: { requestId, nodeId, source },
        })
      }
      onExportFile={(payload) => postToParent({ type: "exportFile", payload })}
    />,
  );
  postToParent({ type: "ready" });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
