import assert from "node:assert/strict";
import test from "node:test";
import {
  attachmentIconName,
  registerAttachmentIcons,
  unregisterAttachmentIcons,
} from "../src/modules/attachment-icons.ts";

test("attachment icons distinguish file types and cleanly restore host rendering", async (t) => {
  class Item {
    constructor(
      public attachmentFilename: string,
      public attachmentLinkMode = 0,
      public attachmentContentType = "",
      public attachment = true,
    ) {}
    isAttachment() {
      return this.attachment;
    }
    getItemTypeIconName(skipLinkMode = false) {
      if (!this.attachment) return "journalArticle";
      return !skipLinkMode && this.attachmentLinkMode === 2
        ? "attachmentLink"
        : "attachmentFile";
    }
    getImageSrc() {
      return `host://${this.getItemTypeIconName()}.svg`;
    }
  }
  const item = (filename: string, mode = 0, mime = "", attachment = true) =>
    new Item(filename, mode, mime, attachment) as unknown as Zotero.Item & {
      getItemTypeIconName(skipLinkMode?: boolean): string;
    };
  const sheets = new Set<string>();
  const observers = new Set<unknown>();
  const redraws: unknown[][] = [];
  const rowIcons: string[] = [];
  const nextRowIcons: string[] = [];
  const errors: unknown[] = [];
  let closingWindow = false;
  const markdown = item("research.MD");
  const canvas = item("theme.canvas");
  const linked = item("linked.markdown", 2);
  const canvasLinked = item("linked.CANVAS", 2, "application/json");
  const service = {
    AUTHOR_SHEET: 2,
    sheetRegistered: (uri: { spec: string }) => sheets.has(uri.spec),
    loadAndRegisterSheet: (uri: { spec: string }) => sheets.add(uri.spec),
    unregisterSheet: (uri: { spec: string }) => sheets.delete(uri.spec),
  };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    Zotero: {
      Item,
      Attachments: { LINK_MODE_LINKED_FILE: 2, LINK_MODE_LINKED_URL: 3 },
      Notifier: { trigger: async (...args: unknown[]) => redraws.push(args) },
      Plugins: {
        addObserver: (observer: unknown) => observers.add(observer),
        removeObserver: (observer: unknown) => observers.delete(observer),
      },
      getMainWindows: () => [
        {
          document: {
            querySelectorAll: () => [
              {
                render: () => {
                  if (closingWindow) throw new Error("Window is closing");
                  rowIcons.push(markdown.getItemTypeIconName());
                },
              },
              { render: () => nextRowIcons.push(linked.getItemTypeIconName()) },
            ],
          },
        },
      ],
      debug: () => {},
      logError: (error: unknown) => errors.push(error),
    },
    Components: {
      utils: { getGlobalForObject: () => ({ Function }) },
      classes: {
        "@mozilla.org/content/style-sheet-service;1": {
          getService: () => service,
        },
      },
      interfaces: { nsIStyleSheetService: {} },
    },
    Services: { io: { newURI: (spec: string) => ({ spec }) } },
    addon: {
      data: { config: { addonRef: "bamboo", addonID: "bamboo@@linxzh.com" } },
    },
    ztoolkit: { log: (...args: unknown[]) => errors.push(args) },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  t.mock.method(console, "groupCollapsed", () => {});
  t.mock.method(console, "groupEnd", () => {});
  t.mock.method(console, "trace", () => {});
  t.after(async () => {
    await unregisterAttachmentIcons();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  assert.equal(attachmentIconName(markdown), "bamboo-attachment-markdown");
  assert.equal(attachmentIconName(canvas), "bamboo-attachment-canvas");
  assert.equal(attachmentIconName(linked), "bamboo-attachment-markdown-link");
  assert.equal(
    attachmentIconName(canvasLinked),
    "bamboo-attachment-canvas-link",
  );
  assert.equal(attachmentIconName(linked, true), "bamboo-attachment-markdown");
  for (const extension of ["md", "markdown", "mdown", "mkd", "mkdn"]) {
    assert.equal(
      attachmentIconName(item(`note.${extension}`)),
      "bamboo-attachment-markdown",
    );
  }
  assert.equal(
    attachmentIconName(item("note", 0, "text/markdown")),
    "bamboo-attachment-markdown",
  );
  const ordinary = [
    item("paper.pdf", 0, "application/pdf"),
    item("data.json", 0, "application/json"),
    item("photo.png", 2, "image/png"),
    item("remote.md", 3, "text/markdown"),
    item("remote.canvas", 3),
    item("Title.md", 0, "", false),
  ];
  const originals = ordinary.map((entry) => [
    entry.getItemTypeIconName(),
    entry.getImageSrc(),
  ]);
  for (const entry of ordinary)
    assert.equal(attachmentIconName(entry), undefined);

  await registerAttachmentIcons();
  assert.equal(sheets.size, 1);
  assert.equal(observers.size, 2);
  assert.equal(markdown.getItemTypeIconName(), "bamboo-attachment-markdown");
  assert.equal(canvas.getItemTypeIconName(), "bamboo-attachment-canvas");
  assert.equal(
    canvasLinked.getItemTypeIconName(true),
    "bamboo-attachment-canvas",
  );
  assert.equal(
    linked.getImageSrc(),
    "chrome://bamboo/content/icons/attachment-markdown-link.svg",
  );
  assert.equal(
    canvasLinked.getImageSrc(),
    "chrome://bamboo/content/icons/attachment-canvas-link.svg",
  );
  assert.deepEqual(
    ordinary.map((entry) => [entry.getItemTypeIconName(), entry.getImageSrc()]),
    originals,
  );
  assert.equal(ordinary[2].getItemTypeIconName(true), "attachmentFile");
  assert.deepEqual(redraws, [["redraw", "item", []]]);
  assert.deepEqual(rowIcons, ["bamboo-attachment-markdown"]);
  await registerAttachmentIcons();
  assert.equal(redraws.length, 1, "registration is idempotent");

  // Another plugin can wrap our hook later; disabling ours must not erase it.
  const wrapped = Item.prototype.getItemTypeIconName;
  let outerCalls = 0;
  const outer = function (this: Item, skip?: boolean) {
    outerCalls++;
    return wrapped.call(this, skip);
  };
  Item.prototype.getItemTypeIconName = outer;
  await unregisterAttachmentIcons();
  assert.equal(Item.prototype.getItemTypeIconName, outer);
  assert.equal(markdown.getItemTypeIconName(), "attachmentFile");
  assert.equal(linked.getItemTypeIconName(), "attachmentLink");
  assert.equal(linked.getImageSrc(), "host://attachmentLink.svg");
  assert.ok(outerCalls > 0);
  assert.equal(sheets.size, 0);
  assert.equal(observers.size, 0);
  assert.deepEqual(rowIcons, ["bamboo-attachment-markdown", "attachmentFile"]);
  await unregisterAttachmentIcons();
  assert.equal(redraws.length, 2, "cleanup is idempotent");
  assert.deepEqual(errors, []);

  closingWindow = true;
  await registerAttachmentIcons();
  assert.equal(markdown.getItemTypeIconName(), "bamboo-attachment-markdown");
  await unregisterAttachmentIcons();
  assert.equal(markdown.getItemTypeIconName(), "attachmentFile");
  assert.equal(sheets.size, 0);
  assert.equal(observers.size, 0);
  assert.equal(
    errors.length,
    2,
    "closing windows must not block startup or cleanup",
  );
  assert.deepEqual(
    nextRowIcons.slice(-2),
    ["bamboo-attachment-markdown-link", "attachmentLink"],
    "a stale row must not prevent other attachment icons from refreshing",
  );
});
