import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { showFileHistory } from "../src/modules/file-history-ui.ts";

test("history previews text safely and recovery uses exclusive creation", async (t) => {
  const win = new Window();
  const previous = new Map(
    ["Zotero", "IOUtils", "PathUtils", "ztoolkit"].map((key) => [
      key,
      (globalThis as any)[key],
    ]),
  );
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete (globalThis as any)[key];
      else (globalThis as any)[key] = value;
    }
    win.happyDOM.abort();
  });
  const writes: unknown[][] = [];
  Object.assign(globalThis, {
    Zotero: { DataDirectory: { dir: "/data" } },
    PathUtils: { join: (...parts: string[]) => parts.join("/") },
    IOUtils: {
      exists: async () => true,
      getChildren: async () => ["/history/123.json"],
      readUTF8: async () =>
        JSON.stringify({
          id: "123",
          created: "2026-09-25T00:00:00Z",
          kind: "conflict",
          content: "<script>unsafe()</script>\nmy draft",
        }),
      writeUTF8: async (...args: unknown[]) => {
        writes.push(args);
        throw new Error("already exists");
      },
    },
    ztoolkit: {
      log() {},
      FilePicker: class {
        async open() {
          return "/existing.md";
        }
      },
    },
  });
  await showFileHistory(
    win as unknown as globalThis.Window,
    { libraryID: 1, key: "ABCD1234", attachmentFilename: "Note.md" } as any,
  );
  const dialog = win.document.querySelector("dialog")!;
  assert.ok(dialog.open);
  assert.equal(dialog.querySelector("script"), null);
  assert.match(dialog.querySelector("textarea")!.value, /my draft/);
  const button = dialog.querySelector("button")!;
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0][2], { mode: "create", flush: true });
  assert.match(
    dialog.querySelector('[role="status"]')!.textContent,
    /already exists/,
  );
  assert.equal(button.disabled, false);
  dialog.querySelectorAll("button")[1].click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(win.document.querySelector("dialog"), null);
});
