import assert from "node:assert/strict";
import test from "node:test";
import {
  WhiteboardSessionRegistry,
  type WhiteboardSession,
} from "../src/modules/whiteboard/session-registry.ts";

function session(
  tabID: string,
  win: Window,
  itemID: number,
  canvasId = tabID,
): WhiteboardSession {
  return {
    tabID,
    canvasId,
    itemID,
    path: `/tmp/${canvasId}.canvas`,
    win: win as WhiteboardSession["win"],
    title: "Whiteboard",
  };
}

test("registers canvases by tab and item id and isolates windows", () => {
  const registry = new WhiteboardSessionRegistry();
  const winA = {} as Window;
  const winB = {} as Window;
  registry.register(session("tab-a", winA, 11, "canvas-1"));
  registry.register(session("tab-b", winA, 12, "canvas-2"));
  registry.register(session("tab-c", winB, 13, "canvas-3"));

  assert.equal(registry.get("tab-a")?.canvasId, "canvas-1");
  assert.equal(registry.findByItem(12)?.tabID, "tab-b");
  assert.equal(registry.sessionsForWindow(winA).length, 2);
  assert.equal(registry.sessionsForWindow(winB).length, 1);

  registry.unregister("tab-a");
  assert.equal(registry.get("tab-a"), undefined);
  assert.equal(registry.findByItem(11), undefined);
  assert.equal(registry.sessionsForWindow(winA).length, 1);
});

test("unregistering a session disposes its scheduler and template subscription", () => {
  const registry = new WhiteboardSessionRegistry();
  let disposed = 0;
  let unsubscribed = 0;
  const current = session("tab-source", {} as Window, 21);
  current.sourceScheduler = {
    dispose: () => {
      disposed += 1;
    },
  } as WhiteboardSession["sourceScheduler"];
  current.unsubscribeTemplates = () => {
    unsubscribed += 1;
  };
  registry.register(current);

  registry.unregister(current.tabID);
  registry.unregister(current.tabID);

  assert.equal(disposed, 1);
  assert.equal(unsubscribed, 1);
});
