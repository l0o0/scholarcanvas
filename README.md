# Scholar Canvas

**Markdown & Whiteboard for Zotero**

[![Zotero compatibility](https://img.shields.io/badge/Zotero-9%2F10-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![version](https://img.shields.io/badge/version-0.1.7-blue?style=flat-square)](https://github.com/l0o0/bamboo/releases)
[![license](https://img.shields.io/badge/license-AGPL--3.0-orange?style=flat-square)](./LICENSE)

**Write Markdown and connect your research on a visual whiteboard, inside Zotero.** Create, edit, and preview native `.md` attachments, then organize literature, quotes, and notes on `.canvas` whiteboards.

[English](README.md) | [简体中文](doc/README-zhCN.md)

---

## Why

Zotero is excellent for collecting and organizing research. In the AI era, **plain Markdown files** are the common currency of knowledge tools (Obsidian, LLMs, static sites, git).

[Better Notes](https://github.com/windingwind/zotero-better-notes) greatly improves Zotero's built-in **Notes**, but those notes are still Zotero notes — not native `.md` files on disk. **Scholar Canvas** fills that gap: it complements Better Notes without touching Notes, and its Markdown files are drop-in plain text for Obsidian and AI workflows.

---

## Features

- **Open** `.md` / `.markdown` attachments in a main-window **tab** (not the system app)
- **Edit** in a fast built-in editor — line numbers, Tab indentation, word/char counts, and toolbar shortcuts for common Markdown syntax (bold, italic, headings, links)
- **Preview** rendered Markdown (toggle Edit / Preview)
- **Autosave** (debounced) + **Ctrl/Cmd+S**
- **New Markdown…** from the item context menu (stored attachment by default)
- Supports **stored** and **linked** attachments
- Preference to enable/disable intercepting open
- Kebab menu with document info, safe renaming, folder reveal, and plugin settings
- Import remote Markdown images into the note's local `assets/` directory for offline use
- Resize images in Live mode using corner handles, size presets, or an exact pixel width; view originals from the image toolbar or reading preview
- **Multiple monitors**: open Markdown and Canvas in a resizable standalone window from **More → Open in standalone window** or the attachment context menu. Use **More → Return to Zotero tab** to move back. Changes are saved before switching or closing.

### Canvas whiteboards

- Create a blank whiteboard or start from a Zotero collection
- Drag literature onto the canvas and add useful excerpts from source cards
- Create Note, Question, Viewpoint, Evidence, and Summary cards with writing prompts; group cards in Frames and connect ideas
- Save boards as `.canvas` attachments and reopen them inside Zotero
- Learn with an example whiteboard featuring an offline image, an editable Markdown attachment, and color styling
- Export the whole board as PNG at 1×, 2×, or 4×, preserving rendered cards, images, colors, and connection labels

### Planned

- Wiki-links `[[...]]` and in-library jump
- YAML frontmatter ↔ Zotero fields
- Export PDF annotations / highlights → `.md`
- Auto-reload when a linked file changes externally
- Session restore for Markdown tabs

---

## Install

Download the latest `bamboo-v{version}.xpi` from [Releases](https://github.com/l0o0/bamboo/releases), then in Zotero: **Tools → Plugins → gear → Install Plugin From File…** and restart if prompted.

### Development build

```bash
pnpm install
pnpm run build
# XPI: .scaffold/build/bamboo-v{version}.xpi
```

---

## Usage

1. Select a library item → right-click → **New Markdown…**  
   A stored `.md` attachment is created and opened.
2. Edit in the tab. Changes autosave; use **Ctrl/Cmd+S** to save immediately.
3. Click **Preview** to render; **Edit** to return to source.
4. Double-click any `.md` attachment later to reopen the editor.
5. Or right-click a `.md` attachment → **Open with Markdown Editor**.

Use the tab's kebab menu for document metadata, renaming, opening the containing
folder, and Markdown-specific settings. **Import external images** downloads
`http(s)` image references into the attachment's `assets/` directory and
rewrites the Markdown links to local paths, so the document remains usable
offline.

In **Live** mode, click an image to show its size controls. Drag a corner to resize proportionally, choose **Small / Medium / Large**, or enter a width in pixels. **Auto** restores the natural size, capped to the reading column. Each occurrence keeps its own width; the original file is unchanged. One undo reverses a complete drag.

Sizes are saved in the `.md` file as `<img src="assets/figure.png" alt="Description" width="480">` and are respected in reading preview and HTML export. Narrow windows fit images to the available width. **View original** opens a temporary viewer with Fit and 100% views; clicking an image in reading preview opens the same viewer.

Drag existing `.md` files into Zotero (or attach linked files) — double-click still opens them here.

---

### Whiteboards

1. Choose **Tools → New Whiteboard…** or **New Whiteboard from Collection…**.
2. Drag a Zotero item onto the canvas, browse its excerpts, and add notes.
3. Group related cards in Frames and connect them to organize your argument.
4. Reopen boards from **Tools → Recent Whiteboards** or their `.canvas` attachments.

For a guided introduction, choose **Help → Scholar Canvas: Create Example Whiteboard**. This creates a new board and a **Start writing.md** notebook with three hands-on exercises: summarize a reading, add a task, and insert an image. It also explains Live / Source modes and saving, then guides you back to the whiteboard to connect evidence and share your work. Existing tutorial boards are kept as they are.

To share a board, use the toolbar **Export PNG** button (2×), or right-click empty canvas space and choose **Export PNG · 1× / 2× / 4×**. The image includes the entire board with padding, uses the current theme, and excludes editor controls. Very large exports ask you to choose a lower resolution instead of silently reducing quality.

---

## Requirements

- Zotero **9** or **10**
- Desktop app (not Zotero Web)

---

## Development

Uses [zotero-plugin-scaffold](https://github.com/northword/zotero-plugin-scaffold) and [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit). Package manager: **pnpm**.

### Setup

```bash
# Copy env and point at your Zotero binary / profile / data dir (see .env.example)
cp .env.example .env

pnpm install
pnpm start          # build + launch Zotero with hot reload
```

China mainland users: project `.npmrc` already uses [npmmirror](https://npmmirror.com/).

### Scripts

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `pnpm start`          | Dev server + hot reload      |
| `pnpm run build`      | Production build + typecheck |
| `pnpm test`           | Plugin tests                 |
| `pnpm run lint:check` | Prettier + ESLint            |
| `pnpm run lint:fix`   | Auto-fix lint                |

---

## Configuration

**Edit → Settings → Scholar Canvas**

- **Enable Markdown editor for .md attachments** — when off, Zotero opens `.md` with the system handler again

---

## API for other plugins

Scholar Canvas was previously named Bamboo. The repository, XPI filename, add-on ID, preference keys, and `Zotero.Bamboo` API namespace retain their existing names for update and integration compatibility.

Scholar Canvas exposes its in-process API at `Zotero.Bamboo.api.markdown`
for other plugins / MCP bridges to create and edit `.md` documents inside Zotero.
All methods are async, JSON-friendly, and reject with `MarkdownApiError`
(`error.code` is stable).

```js
const md = Zotero.Bamboo.api.markdown;

// List markdown attachments in the user library
const docs = await md.list({ q: "note" });

// Read one
const { content } = await md.read(docs[0].itemID);

// Create under a literature item, then edit
const created = await md.create({
  parentItemID: 123,
  initialContent: "# Title",
});
await md.update(created.itemID, { content: "# New\n\nupdated" });

// Patch frontmatter only
await md.patchFrontmatter(created.itemID, {
  set: { tags: ["ai", "draft"] },
  delete: ["old-key"],
});

// Open / flush / close editor tabs
await md.openTab(created.itemID);
await md.flush(created.itemID);
await md.closeTab(tabID);
```

Methods: `list`, `stat`, `read`, `create`, `createLinked`, `update`,
`patchFrontmatter`, `rename`, `trash`, `openTab`, `closeTab`, `sessions`,
`flush`, `toHtml`, `render`, `documentTitle`.

Error codes: `ITEM_NOT_FOUND`, `NOT_MARKDOWN`, `WRITE_CONFLICT`,
`WRITE_FAILED`, `INVALID_ARGUMENT`, `NOT_OPEN`.

Notes:

- All writes go through the same persistence path as the editor (file write,
  image-asset cleanup, item-title sync, Zotero file-sync marking).
- `update` rejects with `WRITE_CONFLICT` when an open editor tab has unsaved
  changes — pass `force: true` to overwrite.
- `rename` renames the underlying file; for linked attachments this renames
  the file on disk.
- API version: `Zotero.Bamboo.api.version` (currently `2`).

---

## FAQ

**Does this replace Better Notes?**  
No. Better Notes improves Zotero Notes. Scholar Canvas handles **real Markdown files** and **Canvas whiteboards** as attachments. Install both if you want.

**Where are files stored?**

- _New Markdown…_ creates a **stored** attachment under Zotero's storage.
- You can also attach **linked** files pointing at an Obsidian vault or any folder.

**Will Zotero sync my `.md` files?**  
Stored attachments follow Zotero file sync (if enabled). Linked files do not upload with Zotero file sync.

**Which extensions are recognized?**  
`.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn`, plus `text/markdown` content type.

---

## Contributing

Issues and PRs welcome. For larger features, open an issue first so we can align on scope.

---

## Acknowledgments

- Built on [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
- [markdown-it](https://github.com/markdown-it/markdown-it)
- Inspired by the knowledge workflows of Obsidian and the Zotero community

---

## License

[AGPL-3.0-or-later](./LICENSE)
