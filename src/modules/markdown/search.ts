import { getString } from "../../utils/locale";
import { readLibraryNotes } from "./note-library";
import { formatNoteLink, type NoteDocument } from "./note-links";
import { openDocumentLink } from "./document-links";

export function searchNotes(notes: readonly NoteDocument[], query: string) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu"),
    );
  if (!terms.length) return [];
  return notes
    .filter(
      (note) =>
        !note.readError &&
        terms.every((term) =>
          term.test(`${note.title}\n${note.filename}\n${note.content}`),
        ),
    )
    .map((note) => {
      const position =
        terms
          .map((term) => term.exec(note.content)?.index)
          .find((index) => index !== undefined) ?? 0;
      const from = Math.max(0, position - 60);
      return {
        note,
        position,
        snippet: `${from ? "…" : ""}${note.content.slice(from, position + 180).replace(/\s+/g, " ")}`,
      };
    });
}

export async function showNoteSearch(win: Window, currentItem: Zotero.Item) {
  const doc = win.document;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K) =>
    doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      tag,
    ) as HTMLElementTagNameMap[K];
  const dialog = element("dialog");
  dialog.style.cssText =
    "width:min(760px,85vw);max-height:80vh;padding:24px;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:10px";
  dialog.setAttribute("aria-label", getString("more-search-library"));
  const title = element("h2");
  title.textContent = getString("more-search-library");
  const query = element("input");
  query.type = "search";
  query.placeholder = getString("note-search-placeholder");
  query.setAttribute("aria-label", query.placeholder);
  query.style.cssText = "width:100%;box-sizing:border-box;padding:8px";
  const status = element("p");
  status.setAttribute("role", "status");
  const results = element("div");
  results.style.cssText = "max-height:50vh;overflow:auto;display:grid;gap:8px";
  const close = element("button");
  close.type = "button";
  close.textContent = getString("file-history-close");
  close.addEventListener("click", () => dialog.close());
  let sequence = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const search = async () => {
    const token = ++sequence;
    results.replaceChildren();
    if (!query.value.trim()) {
      status.textContent = getString("note-search-hint");
      return;
    }
    status.textContent = getString("note-search-loading");
    try {
      const notes = await readLibraryNotes(currentItem.libraryID);
      if (token !== sequence || !dialog.isConnected) return;
      const matches = searchNotes(notes, query.value);
      status.textContent = getString("note-search-count", {
        args: { count: matches.length },
      });
      for (const match of matches.slice(0, 100)) {
        const button = element("button");
        button.type = "button";
        button.style.cssText =
          "text-align:start;white-space:normal;padding:10px";
        const heading = element("strong");
        heading.textContent = match.note.title || match.note.filename;
        const snippet = element("div");
        snippet.textContent = match.snippet;
        button.append(heading, snippet);
        button.addEventListener("click", () => {
          void openDocumentLink(formatNoteLink(match.note), {
            currentItem,
            win,
            position: match.position,
          })
            .then((result) => {
              if (result.status === "opened") dialog.close();
              else status.textContent = getString("document-link-unresolved");
            })
            .catch((error) => {
              status.textContent = String(error);
            });
        });
        results.append(button);
      }
    } catch (error) {
      if (token === sequence) status.textContent = String(error);
    }
  };
  query.addEventListener("input", () => {
    sequence++;
    clearTimeout(timer);
    timer = setTimeout(() => void search(), 150);
  });
  query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      results.querySelector("button")?.click();
    }
  });
  const previous = doc.activeElement as HTMLElement | null;
  dialog.addEventListener(
    "close",
    () => {
      sequence++;
      clearTimeout(timer);
      dialog.remove();
      previous?.focus();
    },
    { once: true },
  );
  dialog.append(title, query, status, results, close);
  doc.documentElement.append(dialog);
  dialog.showModal();
  query.focus();
  await search();
}
