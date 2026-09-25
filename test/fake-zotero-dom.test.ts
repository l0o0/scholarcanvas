import assert from "node:assert/strict";
import test from "node:test";
import { createFakeZotero } from "@zotero-plugin/fake-zotero";
import { ensureDOMGlobals } from "../src/utils/dom.ts";

test("the browser host does not assign its own readonly Window globals", () => {
  const fake = createFakeZotero();
  const restore = fake.install();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    get: () => globalThis,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    get: () => ({}),
  });
  try {
    const host = globalThis as unknown as Window;
    assert.equal(ensureDOMGlobals(host), host);
    assert.equal(
      Object.getOwnPropertyDescriptor(globalThis, "window")?.set,
      undefined,
    );
  } finally {
    for (const [key, previous] of [
      ["window", previousWindow],
      ["document", previousDocument],
    ] as const) {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    }
    restore();
  }
});
