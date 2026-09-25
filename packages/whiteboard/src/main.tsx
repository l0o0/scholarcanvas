import { useState } from "react";
import { createRoot } from "react-dom/client";
import { WhiteboardApp } from "./whiteboard/app";
import { emptyCanvasDocument } from "./model/document";
import { createBrowserDemo } from "./devHost";
import "./dev.css";

let report = (_message: string) => {};
let storage: Storage | undefined;
try {
  storage = window.localStorage;
} catch {
  /* Save reports unavailable storage. */
}
const demo = createBrowserDemo({
  storage,
  report: (message) => report(message),
});
let initialSnapshot = emptyCanvasDocument();
let initialMessage = "Demo fixtures · no Zotero installation required";
try {
  initialSnapshot = demo.readSaved() ?? initialSnapshot;
} catch (error) {
  initialMessage = `Saved board could not be loaded: ${String(error)}`;
}

// Dev-only observation API for browser automation. Not bundled by Zotero.
Object.assign(window, { __fakeZoteroDemo: demo });
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    demo.dispose();
    Reflect.deleteProperty(window, "__fakeZoteroDemo");
  });

function BrowserDemo() {
  const [message, setMessage] = useState(initialMessage);
  const [ready, setReady] = useState(false);
  report = setMessage;
  return (
    <div className="fake-demo">
      <header className="fake-demo-toolbar">
        <strong>Fake Zotero lab</strong>
        <a href="/markdown.html">Markdown</a>
        <button disabled={!ready} onClick={() => demo.importItem(1)}>
          Import paper
        </button>
        <button disabled={!ready} onClick={() => demo.importItem(4)}>
          Import note
        </button>
        <button disabled={!ready} onClick={() => demo.importItem(2)}>
          Import PDF
        </button>
        <button disabled={!ready} onClick={() => demo.importItem(5)}>
          Import attachment
        </button>
        <button disabled={!ready} onClick={() => void demo.updateNote()}>
          Change library note
        </button>
        <button disabled={!ready} onClick={demo.save}>
          Save board
        </button>
        <button disabled={!ready} onClick={demo.reload}>
          Reload saved
        </button>
        <button disabled={!ready} onClick={demo.reset}>
          Reset fixture
        </button>
        <span role="status">{message}</span>
      </header>
      <main className="fake-demo-board">
        <WhiteboardApp
          {...demo.callbacks}
          theme="light"
          initialSnapshot={initialSnapshot}
          onReady={(api) => {
            demo.callbacks.onReady(api);
            setReady(true);
          }}
        />
      </main>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(<BrowserDemo />);
