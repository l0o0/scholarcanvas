import { resolveEditorTheme } from "../markdown/editor";
import { getString } from "../../utils/locale";
import { ensureDOMGlobals } from "../../utils/dom";
import { createWhiteboardEditor } from "./editor";
import { readCanvasFile, writeCanvasFile } from "./file-io";
import { parseCanvasDocument, type CanvasDocument } from "./snapshot";
import { whiteboardChannel } from "./protocol";
import { WhiteboardSaveCoordinator } from "./save-coordinator";
import { whiteboardRegistry, type WhiteboardSession } from "./session-registry";
import { WHITEBOARD_TAB_TYPE } from "./tabHooks";
import { isWhiteboardAttachment } from "./detect";
import { createZoteroSourceGateway } from "./source-gateway";

const AUTOSAVE_MS = 800;

function newCanvasId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `wb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function isDirty(session: WhiteboardSession) {
  return session.saveCoordinator?.dirty ?? false;
}

function applyShellTheme(root: HTMLElement | undefined, dark: boolean) {
  if (!root) return;
  root.classList.toggle("theme-dark", dark);
  root.classList.toggle("theme-light", !dark);
}

function bindSessionTheme(
  win: _ZoteroTypes.MainWindow,
  session: WhiteboardSession,
) {
  session.unbindTheme?.();
  const sync = () => {
    const theme = resolveEditorTheme(win);
    applyShellTheme(session.view?.root, theme === "dark");
    session.editor?.setTheme(theme);
  };
  let mql: MediaQueryList | null = null;
  const onMql = () => sync();
  try {
    mql = win.matchMedia?.("(prefers-color-scheme: dark)") || null;
    mql?.addEventListener?.("change", onMql);
  } catch {
    // ignore
  }
  session.unbindTheme = () => {
    try {
      mql?.removeEventListener?.("change", onMql);
    } catch {
      // ignore
    }
  };
  sync();
}

function attachmentTitle(item: Zotero.Item) {
  return (
    item.attachmentFilename ||
    item.getField("title") ||
    getString("whiteboard-tab-title")
  );
}

function refreshTabTitle(session: WhiteboardSession) {
  const dirty = isDirty(session) ? " *" : "";
  const { tab } = session.win.Zotero_Tabs._getTab(session.tabID) || {};
  if (!tab) return;
  tab.title = `${session.title}${dirty}`;
  try {
    (session.win.Zotero_Tabs as any)._update?.();
  } catch {
    // ignore
  }
}

function toast(message: string, type: "success" | "fail" = "fail") {
  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({ text: message, type })
    .show();
}

function pickZoteroItem(
  win: Window,
  opts: { onlyRegularItems?: boolean } = {},
): number[] | null {
  const Services = ztoolkit.getGlobal("Services") as {
    ww: {
      openWindow: (
        parent: Window | null,
        url: string,
        name: string,
        features: string,
        args: unknown,
      ) => void;
    };
  };
  const io: {
    dataOut?: number[] | null;
    singleSelection: boolean;
    onlyRegularItems?: boolean;
    multiSelect: boolean;
  } = {
    dataOut: null,
    singleSelection: true,
    onlyRegularItems: opts.onlyRegularItems,
    multiSelect: false,
  };
  Services.ww.openWindow(
    null,
    "chrome://zotero/content/selectItemsDialog.xhtml",
    "",
    "chrome,modal,centerscreen,resizable=yes",
    io,
  );
  return io.dataOut?.length ? io.dataOut : null;
}

function dataUrlToBytes(
  dataUrl: string,
): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1] || "image/png";
  const payload = match[3];
  let bytes: Uint8Array;
  if (match[2]) {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  return { bytes, mimeType };
}

function canvasStorageDir(session: WhiteboardSession): string {
  try {
    const item = Zotero.Items.get(session.itemID);
    if (item) {
      const dir = Zotero.Attachments.getStorageDirectory(item);
      if (dir?.path) return dir.path;
    }
  } catch {
    // ignore
  }
  return PathUtils.parent(session.path) ?? session.path;
}

async function handlePickAcademicSource(
  session: WhiteboardSession,
  requestId: string,
  nodeId: string,
  kind: "literature",
) {
  const editor = session.editor;
  if (!editor) return;
  try {
    const itemIDs = pickZoteroItem(session.win, { onlyRegularItems: true });
    if (!itemIDs) {
      editor.rejectAcademicRequest(
        requestId,
        nodeId,
        "No Zotero item was selected.",
      );
      return;
    }
    const item = Zotero.Items.get(itemIDs[0]);
    if (!item) throw new Error("Item not found");
    if (kind !== "literature" || !item.isRegularItem()) {
      throw new Error("Selected item is not a regular item");
    }
    const gateway = createZoteroSourceGateway();
    const acquisition = gateway.acquireItem(item);
    editor.resolveAcademicAcquisition(requestId, nodeId, acquisition);
  } catch (error) {
    editor.rejectAcademicRequest(
      requestId,
      nodeId,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function openZoteroItem(payload: {
  itemID?: number;
  attachmentID?: number;
  pdfPage?: number;
}) {
  const pane = Zotero.getActiveZoteroPane();
  if (!pane) return;
  if (payload.attachmentID) {
    const attachment = Zotero.Items.get(payload.attachmentID);
    if (attachment) {
      if (payload.pdfPage) {
        try {
          const reader = (Zotero as any).Reader;
          if (reader?.open) {
            void reader.open(attachment.id, { pageIndex: payload.pdfPage });
            return;
          }
        } catch {
          // fall back to the default file handler
        }
      }
      void Zotero.FileHandlers.open(attachment);
      return;
    }
    pane.selectItem(payload.attachmentID);
    return;
  }
  if (payload.itemID) {
    pane.selectItem(payload.itemID);
  }
}

export function parseDroppedItemIDs(raw: Record<string, string>): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  const add = (value: unknown): void => {
    if (typeof value === "number") {
      if (Number.isInteger(value) && value > 0 && !seen.has(value)) {
        seen.add(value);
        ids.push(value);
      }
      return;
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      add(Number(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) add(entry);
      return;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (Object.hasOwn(record, "itemID")) add(record.itemID);
      if (Object.hasOwn(record, "id")) add(record.id);
    }
  };
  for (const value of Object.values(raw)) {
    if (!value) continue;
    try {
      add(JSON.parse(value));
    } catch {
      const list = value.trim();
      if (/^\d+(?:[\s,;]+\d+)*$/.test(list)) {
        for (const entry of list.split(/[\s,;]+/)) add(Number(entry));
      }
    }
  }
  return ids;
}

async function handleDropAcademicSources(
  session: WhiteboardSession,
  requestId: string,
  nodeId: string,
  raw: Record<string, string>,
) {
  const editor = session.editor;
  if (!editor) return;
  try {
    const itemIDs = parseDroppedItemIDs(raw);
    if (!itemIDs.length) throw new Error("Could not parse dropped item");
    const items = itemIDs
      .map((itemID) => Zotero.Items.get(itemID))
      .filter((item): item is Zotero.Item => !!item);
    const item = items.find((candidate) => candidate.isRegularItem());
    for (const unsupported of items.filter(
      (candidate) => !candidate.isRegularItem(),
    )) {
      toast(
        unsupported.isAttachment()
          ? "Zotero attachments cannot be added to the canvas."
          : "This Zotero item type cannot be added to the canvas.",
      );
    }
    if (!item) throw new Error("Drop a regular Zotero item to add Literature");
    const gateway = createZoteroSourceGateway();
    const acquisition = gateway.acquireItem(item);
    editor.resolveAcademicAcquisition(requestId, nodeId, acquisition);
  } catch (error) {
    editor.rejectAcademicRequest(
      requestId,
      nodeId,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function handleExportFile(
  session: WhiteboardSession,
  payload: {
    requestId: string;
    format: "png" | "svg" | "md";
    mimeType: string;
    dataUrl?: string;
    text?: string;
  },
) {
  try {
    const extension =
      payload.format === "png"
        ? "png"
        : payload.format === "svg"
          ? "svg"
          : "md";
    const picked = await new ztoolkit.FilePicker(
      getString("whiteboard-export-title"),
      "save",
      [[`${payload.format.toUpperCase()} (*.${extension})`, `*.${extension}`]],
      `whiteboard.${extension}`,
      session.win,
    ).open();
    if (!picked) return;
    if (payload.dataUrl) {
      const parsed = dataUrlToBytes(payload.dataUrl);
      if (!parsed) throw new Error("Invalid image data");
      await IOUtils.write(picked, parsed.bytes);
    } else if (payload.text != null) {
      await Zotero.File.putContentsAsync(picked, payload.text);
    } else {
      throw new Error("Nothing to export");
    }
    toast(getString("whiteboard-exported"), "success");
  } catch (error) {
    toast(
      `${getString("whiteboard-export-failed")}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function scheduleAutosave(session: WhiteboardSession) {
  if (session.autosaveTimer) {
    session.win.clearTimeout(session.autosaveTimer);
  }
  session.autosaveTimer = session.win.setTimeout(() => {
    session.autosaveTimer = undefined;
    void saveSession(session, { silent: true });
  }, AUTOSAVE_MS);
}

async function cleanupUnusedAssets(
  session: WhiteboardSession,
  document: CanvasDocument,
) {
  try {
    const root = canvasStorageDir(session);
    const assetsDir = PathUtils.join(root, "assets");
    if (!(await IOUtils.exists(assetsDir))) return;
    const referenced = new Set<string>();
    for (const node of document.nodes) {
      const asset = node.kind === "pdf" ? node.data.asset : undefined;
      if (typeof asset === "string") {
        referenced.add(asset.split("/").pop() || asset);
      }
    }
    const children = await IOUtils.getChildren(assetsDir);
    for (const name of children) {
      if (referenced.has(name)) continue;
      const full = PathUtils.join(assetsDir, name);
      try {
        const info = await IOUtils.stat(full);
        if (info.type !== "directory") await IOUtils.remove(full);
      } catch (error) {
        ztoolkit.log("cleanup asset failed", name, error);
      }
    }
  } catch (error) {
    ztoolkit.log("cleanup unused whiteboard assets failed", error);
  }
}

async function saveSession(
  session: WhiteboardSession,
  opts: { silent?: boolean } = {},
): Promise<boolean> {
  const saveCoordinator = session.saveCoordinator;
  if (!saveCoordinator) return false;
  if (!isDirty(session) && opts.silent) return true;
  try {
    await saveCoordinator.request({ force: !opts.silent });
    if (!opts.silent) toast(getString("whiteboard-saved"), "success");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ztoolkit.log("Failed to save whiteboard", error);
    if (!opts.silent) {
      toast(`${getString("whiteboard-save-failed")}: ${message}`);
    }
    return false;
  }
}

function promptUnsaved(win: Window): "save" | "discard" {
  try {
    const Services = ztoolkit.getGlobal("Services") as {
      prompt: {
        BUTTON_POS_0: number;
        BUTTON_POS_1: number;
        BUTTON_TITLE_SAVE: number;
        BUTTON_TITLE_DONT_SAVE: number;
        confirmEx: (
          parent: Window,
          title: string,
          text: string,
          flags: number,
          b0: string | null,
          b1: string | null,
          b2: string | null,
          check: string | null,
          state: { value: boolean },
        ) => number;
      };
    };
    const flags =
      Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_SAVE +
      Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_DONT_SAVE;
    const result = Services.prompt.confirmEx(
      win,
      getString("whiteboard-unsaved-title"),
      getString("whiteboard-unsaved-prompt"),
      flags,
      null,
      null,
      null,
      null,
      { value: false },
    );
    return result === 0 ? "save" : "discard";
  } catch {
    return win.confirm(getString("whiteboard-unsaved-prompt"))
      ? "save"
      : "discard";
  }
}

function mountWhiteboardUI(
  win: _ZoteroTypes.MainWindow,
  container: HTMLElement,
  session: WhiteboardSession,
  initialSnapshot: CanvasDocument,
) {
  const doc = container.ownerDocument;
  const root = doc.createElement("div");
  root.className = "zotero-whiteboard-root zotero-markdown-root";

  const host = doc.createElement("div");
  host.className = "zotero-whiteboard-host";

  root.appendChild(host);
  container.appendChild(root);

  session.view = { root, host };
  session.saveCoordinator = new WhiteboardSaveCoordinator({
    getSnapshot: async () => {
      if (!session.editor) throw new Error("Canvas editor is unavailable");
      await session.editor.ready;
      const shot = await session.editor.requestSnapshot();
      return {
        rev: shot.rev,
        document: parseCanvasDocument(shot.snapshot).document,
      };
    },
    write: async ({ document }) => {
      const item = Zotero.Items.get(session.itemID);
      if (!item || !isWhiteboardAttachment(item)) {
        throw new Error("Canvas attachment is gone");
      }
      const path = (await item.getFilePathAsync()) || session.path;
      if (!path) throw new Error("Canvas file not found");
      session.path = await writeCanvasFile(path, document);
      await cleanupUnusedAssets(session, document);
      session.title = attachmentTitle(item);
    },
    onStateChange: (state) => {
      session.editor?.setSaveState(state);
      refreshTabTitle(session);
    },
  });
  session.editor = createWhiteboardEditor(host, {
    win,
    channel: whiteboardChannel(session.tabID, session.canvasId),
    snapshot: initialSnapshot,
    labels: {
      canvas: getString("whiteboard-canvas"),
      select: getString("whiteboard-select"),
      hand: getString("whiteboard-hand"),
      addItem: getString("whiteboard-add-item"),
      addNote: getString("whiteboard-add-note"),
      addQuestion: getString("whiteboard-add-question"),
      addClaim: getString("whiteboard-add-claim"),
      addFrame: getString("whiteboard-add-frame"),
      addPdf: getString("whiteboard-add-pdf"),
      addFile: getString("whiteboard-add-file"),
      addText: getString("whiteboard-add-text"),
      addRect: getString("whiteboard-add-rect"),
      addEllipse: getString("whiteboard-add-ellipse"),
      addLine: getString("whiteboard-add-line"),
      addArrow: getString("whiteboard-add-arrow"),
      kindLiterature: getString("whiteboard-kind-literature"),
      kindQuote: getString("whiteboard-kind-quote"),
      kindNote: getString("whiteboard-kind-note"),
      kindQuestion: getString("whiteboard-kind-question"),
      kindClaim: getString("whiteboard-kind-claim"),
      kindFrame: getString("whiteboard-kind-frame"),
      annotationColor: getString("whiteboard-annotation-color"),
      annotations: {
        one: getString("whiteboard-annotations", { args: { count: 1 } }),
        other: getString("whiteboard-annotations", { args: { count: 2 } }),
      },
      eraser: getString("whiteboard-eraser"),
      undo: getString("whiteboard-undo"),
      redo: getString("whiteboard-redo"),
      save: getString("whiteboard-save"),
      editText: getString("whiteboard-edit-text"),
      copy: getString("whiteboard-copy"),
      delete: getString("whiteboard-delete"),
      openItem: getString("whiteboard-open-item"),
      alignLeft: getString("whiteboard-align-left"),
      alignRight: getString("whiteboard-align-right"),
      alignTop: getString("whiteboard-align-top"),
      alignBottom: getString("whiteboard-align-bottom"),
      alignHorizontal: getString("whiteboard-align-horizontal"),
      alignVertical: getString("whiteboard-align-vertical"),
      distributeHorizontal: getString("whiteboard-distribute-horizontal"),
      distributeVertical: getString("whiteboard-distribute-vertical"),
      fitView: getString("whiteboard-fit-view"),
      autoLayout: getString("whiteboard-auto-layout"),
      edgeColor: getString("whiteboard-edge-color"),
      edgeDash: getString("whiteboard-edge-dash"),
      edgeArrow: getString("whiteboard-edge-arrow"),
      saved: getString("whiteboard-save-saved"),
      saving: getString("whiteboard-save-saving"),
      saveFailed: getString("whiteboard-save-failed-short"),
      exportPng: getString("whiteboard-export-png"),
      exportSvg: getString("whiteboard-export-svg"),
      exportMarkdown: getString("whiteboard-export-markdown"),
      more: getString("whiteboard-more"),
      shortcutsTitle: getString("whiteboard-shortcuts-title"),
      close: getString("whiteboard-close"),
      stroke: getString("whiteboard-stroke"),
      background: getString("whiteboard-background"),
      style: getString("whiteboard-style"),
      solid: getString("whiteboard-solid"),
      dashed: getString("whiteboard-dashed"),
      corners: getString("whiteboard-corners"),
      format: getString("whiteboard-format"),
      color: getString("whiteboard-color"),
      size: getString("whiteboard-size"),
      alignment: getString("whiteboard-alignment"),
      textAlignment: getString("whiteboard-text-alignment"),
      verticalAlignment: getString("whiteboard-vertical-alignment"),
      fontSystem: getString("whiteboard-font-system"),
      fontGeorgia: getString("whiteboard-font-georgia"),
      fontTimes: getString("whiteboard-font-times"),
      fontInter: getString("whiteboard-font-inter"),
      fontMenlo: getString("whiteboard-font-menlo"),
      fontSerifSc: getString("whiteboard-font-serif-sc"),
      weightRegular: getString("whiteboard-weight-regular"),
      weightBold: getString("whiteboard-weight-bold"),
      commonColors: getString("whiteboard-colors-common"),
      recentColors: getString("whiteboard-colors-recent"),
      shortcutSelect: getString("whiteboard-shortcut-select"),
      shortcutHand: getString("whiteboard-shortcut-hand"),
      shortcutRect: getString("whiteboard-shortcut-rect"),
      shortcutEllipse: getString("whiteboard-shortcut-ellipse"),
      shortcutArrow: getString("whiteboard-shortcut-arrow"),
      shortcutLine: getString("whiteboard-shortcut-line"),
      shortcutText: getString("whiteboard-shortcut-text"),
      shortcutQuestion: getString("whiteboard-shortcut-question"),
      shortcutClaim: getString("whiteboard-shortcut-claim"),
      shortcutFrame: getString("whiteboard-shortcut-frame"),
      shortcutEraser: getString("whiteboard-shortcut-eraser"),
      shortcutConstrain: getString("whiteboard-shortcut-constrain"),
      shortcutCancel: getString("whiteboard-shortcut-cancel"),
      shortcutDelete: getString("whiteboard-shortcut-delete"),
      shortcutUndo: getString("whiteboard-shortcut-undo"),
      shortcutRedo: getString("whiteboard-shortcut-redo"),
    },
    onChange(rev) {
      session.saveCoordinator?.markChanged(rev);
      refreshTabTitle(session);
      scheduleAutosave(session);
    },
    onSave() {
      void saveSession(session);
    },
    onError(message) {
      toast(message);
    },
    onPickAcademicSource(requestId, nodeId, kind) {
      void handlePickAcademicSource(session, requestId, nodeId, kind);
    },
    onOpenItem(payload) {
      openZoteroItem(payload);
    },
    onDropAcademicSources(requestId, nodeId, raw) {
      void handleDropAcademicSources(session, requestId, nodeId, raw);
    },
    onExportFile(payload) {
      void handleExportFile(session, payload);
    },
  });
  bindSessionTheme(win, session);
}

export async function openWhiteboardTab(
  item: Zotero.Item,
  options: { win?: _ZoteroTypes.MainWindow } = {},
): Promise<string | null> {
  if (!isWhiteboardAttachment(item)) return null;
  const win =
    options.win ||
    (Zotero.getMainWindow() as _ZoteroTypes.MainWindow | undefined);
  if (!win) {
    ztoolkit.log("No main window for whiteboard tab");
    return null;
  }

  ensureDOMGlobals(win);

  const existing = whiteboardRegistry.findByItem(item.id);
  if (existing) {
    const existingWin = existing.win;
    const tabInfo = existingWin.Zotero_Tabs._getTab(existing.tabID);
    if (tabInfo?.tab) {
      if (existingWin !== win) {
        try {
          existingWin.focus();
        } catch {
          // ignore
        }
      }
      try {
        existingWin.Zotero_Tabs.select(existing.tabID);
      } catch {
        existingWin.Zotero_Tabs.select(existing.tabID);
      }
      existing.editor?.focus();
      return existing.tabID;
    }
    whiteboardRegistry.unregister(existing.tabID);
  }

  const path = await item.getFilePathAsync();
  if (!path) {
    toast(getString("whiteboard-open-failed"));
    return null;
  }

  let parsed;
  try {
    parsed = await readCanvasFile(path);
    for (const issue of parsed.issues) {
      ztoolkit.log("Canvas parse issue", {
        code: issue.code,
        objectId: issue.id,
        message: issue.message,
      });
    }
  } catch (error) {
    ztoolkit.log("Failed to read whiteboard file", error);
    toast(getString("whiteboard-open-failed"));
    return null;
  }

  const canvasId = newCanvasId();
  const title = attachmentTitle(item);
  const { id: tabID, container } = win.Zotero_Tabs.add({
    type: WHITEBOARD_TAB_TYPE,
    title,
    data: { itemID: item.id, canvasId },
    select: false,
    onClose: () => {
      void closeWhiteboardSession(tabID);
    },
  });

  const host = container as unknown as HTMLElement;
  host.classList.add("zotero-whiteboard-tab-content");
  try {
    host.setAttribute("flex", "1");
  } catch {
    // ignore
  }

  const session: WhiteboardSession = {
    tabID,
    canvasId,
    itemID: item.id,
    win,
    path,
    title,
  };
  whiteboardRegistry.register(session);

  try {
    mountWhiteboardUI(win, host, session, parsed.document);
  } catch (error) {
    ztoolkit.log("Failed to mount whiteboard", error);
    whiteboardRegistry.unregister(tabID);
    try {
      win.Zotero_Tabs.close(tabID);
    } catch {
      // ignore
    }
    throw error;
  }

  try {
    win.Zotero_Tabs.select(tabID);
  } catch (error) {
    ztoolkit.log("select whiteboard tab failed", error);
    refreshTabTitle(session);
    win.Zotero_Tabs.select(tabID);
  }
  win.setTimeout(() => session.editor?.focus(), 50);

  return tabID;
}

export async function closeWhiteboardSession(tabID: string): Promise<boolean> {
  const session = whiteboardRegistry.get(tabID);
  if (!session || session.closing) return true;
  if (session.autosaveTimer) {
    session.win.clearTimeout(session.autosaveTimer);
    session.autosaveTimer = undefined;
  }
  if (isDirty(session)) {
    const choice = promptUnsaved(session.win);
    if (choice === "save") {
      const saved = await saveSession(session);
      if (!saved) return false;
      try {
        await session.saveCoordinator?.flush();
      } catch {
        return false;
      }
    }
  } else {
    try {
      await session.saveCoordinator?.flush();
    } catch {
      return false;
    }
  }
  session.closing = true;
  session.unbindTheme?.();
  session.editor?.destroy();
  whiteboardRegistry.unregister(tabID);
  return true;
}

export async function closeWhiteboardsForWindow(win: Window) {
  await Promise.all(
    whiteboardRegistry
      .sessionsForWindow(win)
      .map((session) => closeWhiteboardSession(session.tabID)),
  );
}

export async function closeAllWhiteboards() {
  await Promise.all(
    whiteboardRegistry
      .all()
      .map((session) => closeWhiteboardSession(session.tabID)),
  );
}

export async function flushAllWhiteboards(): Promise<void> {
  await Promise.all(
    whiteboardRegistry
      .all()
      .map((session) => session.saveCoordinator?.flush() ?? Promise.resolve()),
  );
}
