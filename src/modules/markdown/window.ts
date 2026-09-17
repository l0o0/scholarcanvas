import { ensureDOMGlobals } from "../../utils/dom";
import { getString } from "../../utils/locale";
import { injectMarkdownStyles } from "./styles";
import {
  closeMarkdownSession,
  mountMarkdownEditorSurface,
  openMarkdownTab,
  refreshMarkdownSessionOnFocus,
} from "./tab";
import { resolveMarkdownTabTitle } from "./tabHooks";
import { sessionRegistry, type OpenSession } from "./session-registry";
import { MarkdownWindowRegistry } from "./window-registry";

type StandaloneWindow = Window & {
  closed: boolean;
  focus: () => void;
  close: () => void;
};

const windows = new MarkdownWindowRegistry<StandaloneWindow, OpenSession>();
let windowSequence = 0;

function waitForWindowDocument(win: Window): Promise<void> {
  if (
    (win.document.readyState === "interactive" ||
      win.document.readyState === "complete") &&
    win.document.getElementById("bamboo-markdown-window-root")
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = win.setTimeout(() => {
      win.removeEventListener("load", loaded);
      reject(new Error(getString("error-open-window")));
    }, 8000);
    const loaded = () => {
      win.clearTimeout(timer);
      resolve();
    };
    win.addEventListener("load", loaded, { once: true });
  });
}

async function readMarkdown(item: Zotero.Item) {
  const path = await item.getFilePathAsync();
  if (!path) throw new Error(getString("error-attachment-gone"));
  const raw = await Zotero.File.getContentsAsync(path);
  return {
    path,
    content: typeof raw === "string" ? raw : String(raw ?? ""),
    storageLabel: item.isStoredFileAttachment?.()
      ? "stored"
      : item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_FILE
        ? "linked"
        : "file",
  };
}

async function updateWindowTitle(win: Window, itemID: number) {
  try {
    win.document.title = await resolveMarkdownTabTitle(itemID);
  } catch {
    win.document.title = addon.data.config.addonName;
  }
}

async function closeWindowEntry(
  itemID: number,
  value: { window: StandaloneWindow; session: OpenSession },
) {
  const state = value.window as StandaloneWindow & {
    __bambooAllowClose?: boolean;
  };
  await closeMarkdownSession(value.session.tabID, {
    flush: true,
    throwOnSaveError: true,
  });
  state.__bambooAllowClose = true;
  if (!state.closed) state.close();
  ztoolkit.log("Closed standalone Markdown window", { itemID });
}

/** Open or focus the one standalone editor window owned by this attachment. */
export async function openMarkdownWindow(
  item: Zotero.Item,
  options: { opener?: _ZoteroTypes.MainWindow } = {},
): Promise<Window | null> {
  const opener =
    options.opener ||
    (Zotero.getMainWindow() as _ZoteroTypes.MainWindow | undefined);
  if (!opener) return null;

  const existing = windows.get(item.id);
  if (existing) {
    existing.window.focus();
    await refreshMarkdownSessionOnFocus(existing.session);
    return existing.window;
  }

  return windows.open(item.id, async () => {
    // Include pending edits when opening from the attachment context menu.
    for (const session of sessionRegistry.all()) {
      if (session.itemID === item.id) await session.save.request();
    }
    const source = await readMarkdown(item);
    const win = opener.openDialog(
      `chrome://${addon.data.config.addonRef}/content/markdownWindow.xhtml`,
      "_blank",
      "chrome,dialog=no,centerscreen,resizable,width=1024,height=760,minwidth=640,minheight=480",
    ) as StandaloneWindow | null;
    if (!win) throw new Error(getString("error-open-window"));

    const state = win as StandaloneWindow & { __bambooAllowClose?: boolean };
    state.__bambooAllowClose = false;
    win.addEventListener("close", (event) => {
      if (state.__bambooAllowClose) return;
      event.preventDefault();
      void windows
        .close(item.id, (value) => closeWindowEntry(item.id, value))
        .catch((error) => {
          ztoolkit.log("Failed to close standalone Markdown window", error);
          new ztoolkit.ProgressWindow(addon.data.config.addonName)
            .createLine({
              text: getString("status-save-failed"),
              type: "fail",
            })
            .show();
        });
    });
    try {
      await waitForWindowDocument(win);
    } catch (error) {
      state.__bambooAllowClose = true;
      win.close();
      throw error;
    }
    ensureDOMGlobals(win);
    injectMarkdownStyles(win);
    const root = win.document.getElementById(
      "bamboo-markdown-window-root",
    ) as HTMLElement | null;
    if (!root) {
      state.__bambooAllowClose = true;
      win.close();
      throw new Error(getString("error-open-window"));
    }
    root.classList.add("zotero-markdown-tab-content");

    const sessionID = `window-${item.id}-${++windowSequence}`;
    let session: OpenSession;
    try {
      session = mountMarkdownEditorSurface({
        sessionID,
        surface: "window",
        item,
        ...source,
        win,
        container: root,
        isActive: () => !win.closed && win.document.hasFocus(),
        updateTitle: () => void updateWindowTitle(win, item.id),
      });
      await session.editor?.ready;
      await session.editor?.requestSnapshot();
    } catch (error) {
      await closeMarkdownSession(sessionID);
      state.__bambooAllowClose = true;
      win.close();
      throw error;
    }

    win.focus();
    return { window: win, session };
  });
}

export async function closeAllMarkdownWindows(): Promise<void> {
  await windows.closeAll((value) =>
    closeWindowEntry(value.session.itemID, value),
  );
}

const transfers = new WeakMap<OpenSession, Promise<void>>();

/** Move the active editor only after its destination has opened successfully. */
export function switchMarkdownSurface(session: OpenSession): Promise<void> {
  const pending = transfers.get(session);
  if (pending) return pending;
  const transfer = (async () => {
    const root = session.view?.root;
    if (root) root.inert = true;
    try {
      const item = Zotero.Items.get(session.itemID);
      if (!item) throw new Error(getString("error-attachment-gone"));
      await session.save.request({ force: true });
      if (session.surface === "window") {
        const tabID = await openMarkdownTab(item);
        if (!tabID) throw new Error(getString("error-open-window"));
        const target = sessionRegistry.get(tabID);
        await target?.editor?.ready;
        await target?.editor?.requestSnapshot();
        await windows.close(item.id, (value) =>
          closeWindowEntry(item.id, value),
        );
        Zotero.getMainWindow()?.focus();
      } else {
        const win = await openMarkdownWindow(item, {
          opener: session.win as _ZoteroTypes.MainWindow,
        });
        if (!win) throw new Error(getString("error-open-window"));
        await closeMarkdownSession(session.tabID, {
          flush: true,
          throwOnSaveError: true,
        });
        (session.win as _ZoteroTypes.MainWindow).Zotero_Tabs.close(
          session.tabID,
        );
        win.focus();
      }
    } finally {
      if (root) root.inert = false;
      transfers.delete(session);
    }
  })();
  transfers.set(session, transfer);
  return transfer;
}
