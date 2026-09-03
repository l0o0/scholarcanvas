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
      onPickItem={(requestId, nodeId, kind) => {
        console.info("pickItem", { requestId, nodeId, kind });
      }}
      onOpenItem={(payload) => console.info("openItem", payload)}
      onDropItems={(requestId, nodeId) => {
        console.info("dropItems", { requestId, nodeId });
      }}
      onExportFile={(payload) => console.info("exportFile", payload.format)}
    />
  </StrictMode>,
);
