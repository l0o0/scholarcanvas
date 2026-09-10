import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import {
  registerWhiteboardMenus,
  unregisterWhiteboardMenus,
} from "../src/modules/whiteboard/menu.ts";

test("Help example menu registers once and is removed on window cleanup", () => {
  const window = new Window();
  window.document.body.innerHTML =
    '<menupopup id="menu_HelpPopup"></menupopup>';
  Object.assign(window.document, {
    createXULElement: window.document.createElement.bind(window.document),
  });
  const globals = globalThis as Record<string, unknown>;
  const previousAddon = globals.addon;
  const previousToolkit = globals.ztoolkit;
  globals.addon = { data: { config: { addonRef: "bamboo" } } };
  globals.ztoolkit = { log: () => {} };
  const win = window as unknown as _ZoteroTypes.MainWindow;
  try {
    registerWhiteboardMenus(win);
    registerWhiteboardMenus(win);
    const items = window.document.querySelectorAll(
      "#menu_HelpPopup > menuitem",
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "bamboo-help-example-whiteboard");
    assert.ok(items[0].getAttribute("label"));
    unregisterWhiteboardMenus(win);
    assert.equal(
      window.document.querySelector("#menu_HelpPopup")?.children.length,
      0,
    );
  } finally {
    unregisterWhiteboardMenus(win);
    if (previousAddon === undefined) delete globals.addon;
    else globals.addon = previousAddon;
    if (previousToolkit === undefined) delete globals.ztoolkit;
    else globals.ztoolkit = previousToolkit;
    window.close();
  }
});
