import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WhiteboardApp } from "./whiteboard/app";
import { demoCanvasDocument } from "./model/document";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <WhiteboardApp
      theme="light"
      initialSnapshot={demoCanvasDocument()}
      onReady={() => undefined}
      onChange={() => undefined}
      onError={(message) => console.error(message)}
      onSave={() => console.info("save")}
      onPickAcademicSource={(requestId, nodeId, kind) => {
        console.info("pickAcademicSource", { requestId, nodeId, kind });
      }}
      onOpenItem={(payload) => console.info("openItem", payload)}
      onDropAcademicSources={(requestId, nodeId) => {
        console.info("dropAcademicSources", { requestId, nodeId });
      }}
      onRefreshZoteroNote={(requestId, nodeId, source) => {
        console.info("refreshZoteroNote", { requestId, nodeId, source });
      }}
      onExportFile={(payload) => console.info("exportFile", payload.format)}
    />
  </StrictMode>,
);
