import { getString } from "../../utils/locale";
import {
  createWhiteboardAttachment,
  createWhiteboardFromCollection,
} from "./create";
import { isWhiteboardAttachment } from "./detect";
import { openWhiteboardAttachment, recentWhiteboardIDs } from "./open";
import { createExampleWhiteboard } from "./tutorial";
import { openWhiteboardWindow } from "./tab";

const itemCleanups = new Map<Window, () => void>();

function icon() {
  return `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
}

async function createAndOpen(parent?: Zotero.Item | null) {
  const attachment = await createWhiteboardAttachment(parent);
  if (attachment) await openWhiteboardAttachment(attachment);
}

export function registerWhiteboardMenus(win: _ZoteroTypes.MainWindow) {
  unregisterWhiteboardMenus(win);
  const doc = win.document;
  const tools =
    (doc.querySelector("#menu_ToolsPopup") as HTMLElement | null) ||
    (doc.querySelector("#menu_toolsPopup") as HTMLElement | null);
  const itemPopup = doc.querySelector("#zotero-itemmenu") as HTMLElement | null;

  const cleanups: Array<() => void> = [];

  const help = doc.querySelector("#menu_HelpPopup");
  if (help) {
    const example = doc.createXULElement("menuitem") as HTMLElement;
    example.id = `${addon.data.config.addonRef}-help-example-whiteboard`;
    example.setAttribute(
      "label",
      getString("menuitem-create-example-whiteboard"),
    );
    example.setAttribute("class", "menuitem-iconic");
    example.style.listStyleImage = `url(${icon()})`;
    example.addEventListener("command", async () => {
      if (example.getAttribute("disabled") === "true") return;
      example.setAttribute("disabled", "true");
      try {
        await createExampleWhiteboard();
      } catch (error) {
        ztoolkit.log("Create example whiteboard failed", error);
      } finally {
        example.removeAttribute("disabled");
      }
    });
    help.appendChild(example);
    cleanups.push(() => example.remove());
  }

  if (tools) {
    const item = doc.createXULElement("menuitem") as HTMLElement;
    item.id = `${addon.data.config.addonRef}-tools-whiteboard`;
    item.setAttribute("label", getString("menuitem-new-whiteboard"));
    item.setAttribute("class", "menuitem-iconic");
    item.style.listStyleImage = `url(${icon()})`;
    item.addEventListener("command", () => {
      void createAndOpen(null);
    });
    tools.appendChild(item);
    cleanups.push(() => item.remove());

    const fromCollection = doc.createXULElement("menuitem") as HTMLElement;
    fromCollection.id = `${addon.data.config.addonRef}-tools-whiteboard-collection`;
    fromCollection.setAttribute(
      "label",
      getString("menuitem-new-whiteboard-from-collection"),
    );
    fromCollection.setAttribute("class", "menuitem-iconic");
    fromCollection.style.listStyleImage = `url(${icon()})`;
    fromCollection.addEventListener("command", () => {
      void createWhiteboardFromCollection();
    });
    tools.appendChild(fromCollection);
    cleanups.push(() => fromCollection.remove());

    const recentMenu = doc.createXULElement("menu") as HTMLElement;
    recentMenu.id = `${addon.data.config.addonRef}-tools-whiteboard-recent`;
    recentMenu.setAttribute("label", getString("menuitem-recent-whiteboards"));
    recentMenu.setAttribute("class", "menuitem-iconic");
    recentMenu.style.listStyleImage = `url(${icon()})`;
    const recentPopup = doc.createXULElement("menupopup") as HTMLElement;
    recentMenu.appendChild(recentPopup);
    const refreshRecent = () => {
      while (recentPopup.firstChild) {
        (recentPopup.firstChild as HTMLElement).remove();
      }
      const ids = recentWhiteboardIDs();
      for (const id of ids) {
        const item = Zotero.Items.get(id);
        if (!item || !isWhiteboardAttachment(item)) continue;
        const recentItem = doc.createXULElement("menuitem") as HTMLElement;
        recentItem.setAttribute(
          "label",
          item.attachmentFilename || item.getField("title") || "Whiteboard",
        );
        recentItem.setAttribute("class", "menuitem-iconic");
        recentItem.style.listStyleImage = `url(${icon()})`;
        recentItem.addEventListener("command", () => {
          void openWhiteboardAttachment(item);
        });
        recentPopup.appendChild(recentItem);
      }
      if (!recentPopup.firstChild) {
        const empty = doc.createXULElement("menuitem") as HTMLElement;
        empty.setAttribute(
          "label",
          getString("menuitem-recent-whiteboards-empty"),
        );
        empty.setAttribute("disabled", "true");
        recentPopup.appendChild(empty);
      }
    };
    recentPopup.addEventListener("popupshowing", refreshRecent);
    tools.appendChild(recentMenu);
    cleanups.push(() => recentMenu.remove());
  } else {
    ztoolkit.log("Tools popup missing; whiteboard tools menu not registered");
  }

  if (itemPopup) {
    const openItem = doc.createXULElement("menuitem") as HTMLElement;
    openItem.id = `${addon.data.config.addonRef}-item-open-canvas`;
    openItem.setAttribute("label", getString("menuitem-open-whiteboard"));
    openItem.setAttribute("class", "menuitem-iconic");
    openItem.style.listStyleImage = `url(${icon()})`;
    const windowItem = doc.createXULElement("menuitem") as HTMLElement;
    windowItem.id = `${addon.data.config.addonRef}-item-open-canvas-window`;
    windowItem.setAttribute("label", getString("more-open-window"));
    const onOpenWindow = () => {
      const selected = win.ZoteroPane?.getSelectedItems?.() || [];
      if (selected.length !== 1 || !isWhiteboardAttachment(selected[0])) return;
      void openWhiteboardWindow(selected[0], { win }).catch((error) => {
        ztoolkit.log("Failed to open standalone Canvas window", error);
        new ztoolkit.ProgressWindow(addon.data.config.addonName)
          .createLine({
            text: getString("whiteboard-open-failed"),
            type: "fail",
          })
          .show();
      });
    };
    const onOpen = () => {
      const selected = win.ZoteroPane?.getSelectedItems?.() || [];
      const canvas = selected.find(isWhiteboardAttachment);
      if (canvas) void openWhiteboardAttachment(canvas);
    };
    const onShowing = () => {
      const selected = win.ZoteroPane?.getSelectedItems?.() || [];
      openItem.hidden = !(
        selected.length === 1 && isWhiteboardAttachment(selected[0])
      );
      windowItem.hidden = openItem.hidden;
    };
    openItem.addEventListener("command", onOpen);
    windowItem.addEventListener("command", onOpenWindow);
    itemPopup.addEventListener("popupshowing", onShowing);
    itemPopup.append(openItem, windowItem);
    cleanups.push(() => {
      itemPopup.removeEventListener("popupshowing", onShowing);
      windowItem.removeEventListener("command", onOpenWindow);
      windowItem.remove();
      openItem.remove();
    });
  }

  itemCleanups.set(win, () => {
    for (const cleanup of cleanups) cleanup();
  });
}

export function unregisterWhiteboardMenus(win: Window) {
  itemCleanups.get(win)?.();
  itemCleanups.delete(win);
}
