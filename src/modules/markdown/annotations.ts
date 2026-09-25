import { getString } from "../../utils/locale";
import { createMarkdownAttachment } from "./create";

export interface MarkdownAnnotation {
  key: string;
  attachmentKey: string;
  attachmentTitle: string;
  groupID?: number;
  pageLabel: string;
  page?: number;
  text: string;
  comment: string;
}
const escape = (value: string) => value.replace(/([\\`*_{}[\]<>#!|])/g, "\\$1");
export function annotationMarkdown(
  title: string,
  annotations: readonly MarkdownAnnotation[],
): string {
  const parts = [`# ${escape(title).replace(/\n/g, " ")}`, ""];
  let attachmentKey = "";
  for (const annotation of annotations) {
    if (
      !/^[A-Za-z0-9]{8}$/.test(annotation.attachmentKey) ||
      !/^[A-Za-z0-9]{8}$/.test(annotation.key)
    )
      throw new Error("Invalid annotation identity");
    if (
      annotation.groupID !== undefined &&
      (!Number.isSafeInteger(annotation.groupID) || annotation.groupID <= 0)
    )
      throw new Error("Invalid group identity");
    if (attachmentKey !== annotation.attachmentKey) {
      parts.push(
        `## ${escape(annotation.attachmentTitle).replace(/\n/g, " ")}`,
        "",
      );
      attachmentKey = annotation.attachmentKey;
    }
    const scope = annotation.groupID
      ? `groups/${annotation.groupID}`
      : "library";
    const page =
      annotation.page &&
      Number.isInteger(annotation.page) &&
      annotation.page > 0
        ? `page=${annotation.page}&`
        : "";
    const href = `zotero://open-pdf/${scope}/items/${annotation.attachmentKey}?${page}annotation=${annotation.key}`;
    if (annotation.text)
      parts.push(
        escape(annotation.text)
          .split(/\r?\n/)
          .map((line) => `> ${line}`)
          .join("\n"),
        "",
      );
    if (annotation.comment) parts.push(escape(annotation.comment), "");
    parts.push(`[${escape(annotation.pageLabel || "PDF")}](${href})`, "");
  }
  return parts.join("\n");
}

export async function showAnnotationExport(win: Window, item: Zotero.Item) {
  if (!item.isEditable())
    throw new Error(getString("annotation-export-read-only"));
  const attachments = item.isAttachment()
    ? [item]
    : item.getAttachments().map((id) => Zotero.Items.get(id));
  const annotations: MarkdownAnnotation[] = [];
  const library = Zotero.Libraries.get(item.libraryID);
  const groupID =
    library && library.libraryType === "group"
      ? Zotero.Groups.getGroupIDFromLibraryID(item.libraryID)
      : undefined;
  for (const attachment of attachments) {
    if (
      !attachment ||
      attachment.deleted ||
      attachment.attachmentContentType !== "application/pdf"
    )
      continue;
    for (const annotation of [...attachment.getAnnotations()].sort((a, b) =>
      (a.annotationSortIndex || "").localeCompare(b.annotationSortIndex || ""),
    )) {
      if (
        annotation.deleted ||
        (!annotation.annotationText?.trim() &&
          !annotation.annotationComment?.trim())
      )
        continue;
      let page: number | undefined;
      try {
        const position = JSON.parse(annotation.annotationPosition);
        if (Number.isInteger(position.pageIndex) && position.pageIndex >= 0)
          page = position.pageIndex + 1;
      } catch {
        /* The annotation key still identifies its location. */
      }
      annotations.push({
        key: annotation.key,
        attachmentKey: attachment.key,
        attachmentTitle:
          attachment.getField("title") ||
          attachment.attachmentFilename ||
          "PDF",
        groupID,
        page,
        pageLabel: annotation.annotationPageLabel || "",
        text: annotation.annotationText || "",
        comment: annotation.annotationComment || "",
      });
    }
  }
  const doc = win.document;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K) =>
    doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      tag,
    ) as HTMLElementTagNameMap[K];
  const dialog = element("dialog");
  dialog.style.cssText =
    "width:min(760px,85vw);max-height:85vh;padding:24px;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:10px";
  dialog.setAttribute("aria-label", getString("menuitem-annotations-md"));
  const heading = element("h2");
  heading.textContent = getString("menuitem-annotations-md");
  const status = element("p");
  status.setAttribute("role", "status");
  status.textContent = getString(
    annotations.length ? "annotation-export-hint" : "annotation-export-empty",
  );
  const list = element("div");
  list.style.cssText = "overflow:auto;max-height:50vh;display:grid;gap:12px";
  const selected = new Set(annotations.map((_, index) => index));
  const submit = element("button");
  submit.type = "button";
  submit.textContent = getString("annotation-export-create");
  submit.disabled = !selected.size;
  const all = element("button");
  all.type = "button";
  all.textContent = getString("annotation-export-toggle");
  const checks: HTMLInputElement[] = [];
  annotations.forEach((annotation, index) => {
    const label = element("label");
    const check = element("input");
    check.type = "checkbox";
    check.checked = true;
    checks.push(check);
    check.addEventListener("change", () => {
      if (check.checked) selected.add(index);
      else selected.delete(index);
      submit.disabled = !selected.size;
    });
    const text = element("span");
    text.textContent = `${annotation.attachmentTitle} · ${annotation.pageLabel}\n${annotation.text}\n${annotation.comment}`;
    text.style.whiteSpace = "pre-wrap";
    label.append(check, text);
    list.append(label);
  });
  all.addEventListener("click", () => {
    const enable = selected.size !== annotations.length;
    selected.clear();
    checks.forEach((check, index) => {
      check.checked = enable;
      if (enable) selected.add(index);
    });
    submit.disabled = !selected.size;
  });
  submit.addEventListener("click", () => {
    submit.disabled = true;
    const title = item.getField("title") || "Annotations";
    void createMarkdownAttachment(
      item.isRegularItem() ? item : item.parentItem,
      {
        libraryID: item.libraryID,
        initialContent: annotationMarkdown(
          title,
          annotations.filter((_, index) => selected.has(index)),
        ),
      },
    )
      .then((created) => {
        if (created) dialog.close();
        else {
          status.textContent = getString("annotation-export-failed");
          submit.disabled = !selected.size;
        }
      })
      .catch((error) => {
        status.textContent = String(error);
        submit.disabled = !selected.size;
      });
  });
  const close = element("button");
  close.type = "button";
  close.textContent = getString("file-history-close");
  close.addEventListener("click", () => dialog.close());
  const previous = doc.activeElement as HTMLElement | null;
  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      previous?.focus();
    },
    { once: true },
  );
  dialog.append(heading, status, all, list, submit, close);
  doc.documentElement.append(dialog);
  dialog.showModal();
}
