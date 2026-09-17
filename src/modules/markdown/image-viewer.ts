/** A temporary reading view; zoom never changes the document or the image file. */
export function showImageViewer(
  image: HTMLImageElement,
  host: HTMLElement,
  labels: { original: string; auto: string; close: string },
): () => void {
  const doc = host.ownerDocument;
  const previousFocus = doc.activeElement as HTMLElement | null;
  const dialog = doc.createElement("dialog");
  dialog.className = "zmd-image-viewer";
  dialog.setAttribute("aria-label", image.alt || labels.original);
  Object.assign(dialog.style, {
    padding: "12px",
    boxSizing: "border-box",
    width: "92vw",
    maxWidth: "1200px",
    height: "88vh",
    maxHeight: "900px",
    borderRadius: "8px",
    border: "1px solid var(--zmd-menu-border, var(--zmd-border))",
    background: "var(--zmd-menu-bg, var(--zmd-surface))",
    color: "var(--zmd-menu-text, var(--zmd-text))",
  });
  const bar = doc.createElement("div");
  Object.assign(bar.style, {
    display: "flex",
    gap: "8px",
    height: "32px",
    marginBottom: "12px",
  });
  const area = doc.createElement("div");
  Object.assign(area.style, {
    overflow: "auto",
    height: "calc(100% - 44px)",
    textAlign: "center",
  });
  const full = doc.createElement("img");
  full.src = image.currentSrc || image.src;
  full.alt = image.alt;
  full.referrerPolicy = "no-referrer";
  full.style.objectFit = "contain";
  const fit = () =>
    Object.assign(full.style, {
      maxWidth: "100%",
      maxHeight: "100%",
      width: "auto",
      height: "auto",
    });
  fit();
  const button = (label: string, action: () => void) => {
    const el = doc.createElement("button");
    el.type = "button";
    el.textContent = label;
    Object.assign(el.style, {
      font: "inherit",
      fontSize: "13px",
      padding: "4px 10px",
      borderRadius: "4px",
      color: "inherit",
      background: "transparent",
      cursor: "pointer",
      border: "1px solid var(--zmd-menu-border, var(--zmd-border))",
    });
    el.addEventListener("click", action);
    bar.append(el);
    return el;
  };
  const fitButton = button(labels.auto, () => {
    fit();
    fitButton.setAttribute("aria-pressed", "true");
    actualButton.setAttribute("aria-pressed", "false");
  });
  const actualButton = button("100%", () => {
    Object.assign(full.style, { maxWidth: "none", maxHeight: "none" });
    fitButton.setAttribute("aria-pressed", "false");
    actualButton.setAttribute("aria-pressed", "true");
  });
  fitButton.setAttribute("aria-pressed", "true");
  actualButton.setAttribute("aria-pressed", "false");
  const close = button(labels.close, () => dialog.close());
  close.style.marginLeft = "auto";
  area.append(full);
  dialog.append(bar, area);
  // The editor's Cmd/Ctrl+S and undo handlers must not consume viewer keys.
  dialog.addEventListener("keydown", (event) => event.stopPropagation());
  dialog.addEventListener("close", () => {
    dialog.remove();
    previousFocus?.focus();
  });
  host.append(dialog);
  dialog.showModal();
  close.focus();
  return () => dialog.remove();
}
