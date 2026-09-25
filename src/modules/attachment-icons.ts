import { PatchHelper } from "zotero-plugin-toolkit";
import { isMarkdownAttachment } from "./markdown/detect";
import { isWhiteboardAttachment } from "./whiteboard/detect";

// Zotero 9/10 use these names in both the item tree and attachment rows.
// The typings omit skipLinkMode and only list Zotero's built-in icon names.
type ItemIconMethods = {
  getItemTypeIconName(skipLinkMode?: boolean): string;
  getImageSrc(): string;
};

const patches: PatchHelper[] = [];
let sheetURI: nsIURI | undefined;

export function attachmentIconName(
  item: Zotero.Item,
  skipLinkMode = false,
): string | undefined {
  const kind = isWhiteboardAttachment(item)
    ? "canvas"
    : isMarkdownAttachment(item)
      ? "markdown"
      : undefined;
  if (!kind) return undefined;
  const linked =
    !skipLinkMode &&
    item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_FILE;
  return `bamboo-attachment-${kind}${linked ? "-link" : ""}`;
}

function styleSheetService() {
  const classes = Components.classes as typeof Cc;
  return classes["@mozilla.org/content/style-sheet-service;1"].getService(
    Components.interfaces.nsIStyleSheetService,
  );
}

async function redrawAttachmentIcons(): Promise<void> {
  try {
    await Zotero.Notifier.trigger("redraw", "item", []);
  } catch (error) {
    ztoolkit.log("Attachment icon tree refresh failed", error);
  }
  // The item-pane attachment list does not subscribe to tree redraw events.
  for (const win of Zotero.getMainWindows()) {
    if (win.closed) continue;
    for (const row of win.document.querySelectorAll<
      Element & { render?: () => void }
    >("attachment-row")) {
      try {
        row.render?.();
      } catch (error) {
        // One stale row must not interrupt other windows or plugin cleanup.
        ztoolkit.log("Attachment icon row refresh failed", error);
      }
    }
  }
}

export async function registerAttachmentIcons(): Promise<void> {
  if (patches.length) return;
  const target = Zotero.Item.prototype as unknown as ItemIconMethods;
  if (
    typeof target.getItemTypeIconName !== "function" ||
    typeof target.getImageSrc !== "function"
  ) {
    ztoolkit.log("Attachment icon hooks unavailable; using Zotero icons");
    return;
  }

  try {
    const service = styleSheetService();
    sheetURI = Services.io.newURI(
      `chrome://${addon.data.config.addonRef}/content/attachment-icons.css`,
    );
    if (!service.sheetRegistered(sheetURI, service.AUTHOR_SHEET!)) {
      // Global registration also covers item pickers and windows opened later.
      service.loadAndRegisterSheet(sheetURI, service.AUTHOR_SHEET!);
    }
    const namePatch = new PatchHelper();
    patches.push(namePatch);
    namePatch.setData({
      target,
      funcSign: "getItemTypeIconName",
      enabled: true,
      pluginID: addon.data.config.addonID,
      patcher: (original) =>
        function (this: Zotero.Item, ...args: [skipLinkMode?: boolean]) {
          return (
            attachmentIconName(this, args[0]) ?? original.apply(this, args)
          );
        },
    });

    const imagePatch = new PatchHelper();
    patches.push(imagePatch);
    imagePatch.setData({
      target,
      funcSign: "getImageSrc",
      enabled: true,
      pluginID: addon.data.config.addonID,
      patcher: (original) =>
        function (this: Zotero.Item) {
          const name = attachmentIconName(this);
          // getImageSrc normally resolves names through ItemTypes, which has
          // no URLs for our custom icons. Keep legacy image consumers working.
          return name
            ? `chrome://${addon.data.config.addonRef}/content/icons/${name.slice("bamboo-".length)}.svg`
            : original.call(this);
        },
    });
    await redrawAttachmentIcons();
  } catch (error) {
    await unregisterAttachmentIcons();
    ztoolkit.log(
      "Attachment icon registration failed; using Zotero icons",
      error,
    );
  }
}

export async function unregisterAttachmentIcons(): Promise<void> {
  if (!patches.length && !sheetURI) return;
  for (const patch of patches.splice(0)) patch.unpatch();
  try {
    await redrawAttachmentIcons();
  } finally {
    try {
      if (sheetURI) {
        const service = styleSheetService();
        if (service.sheetRegistered(sheetURI, service.AUTHOR_SHEET!)) {
          service.unregisterSheet(sheetURI, service.AUTHOR_SHEET!);
        }
      }
    } catch (error) {
      ztoolkit.log("Attachment icon stylesheet cleanup failed", error);
    } finally {
      sheetURI = undefined;
    }
  }
}
