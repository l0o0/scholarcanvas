# Zotero Academic Source Workflows Design

- Date: 2026-09-04
- Status: Confirmed
- Scope: Connect the existing Academic Canvas schema to Zotero Literature,
  Note, and PDF Annotation sources
- Depends on: `2026-09-03-academic-canvas-schema-design.md`
- Product state: Unreleased; protocol and unreleased file behavior do not
  require compatibility shims

## 1. Goal

Complete the first usable Zotero research loop on top of the schema-v2 canvas:

```text
Regular Zotero Item
  -> Literature
  -> browse PDF annotations
  -> Quote
  -> arrange beside local Note, Question, and Claim nodes
  -> save, reopen, resolve, and return to Zotero
```

This phase connects existing academic types to Zotero. It does not introduce
additional canvas node kinds or relationship kinds.

## 2. Confirmed Product Decisions

- Literature represents only a Zotero Regular Item.
- Runtime classification uses `item.isRegularItem()` instead of a maintained
  item-type allowlist. Zotero currently defines a Regular Item as an item that
  is not a Note, Attachment, or Annotation.
- A Zotero Note imports as an Academic Note.
- A supported Zotero PDF Annotation imports as a Quote.
- A Zotero Attachment does not create a new node.
- Existing basic `item`, `pdf`, and `attachment` node kinds remain in the model,
  parser, and renderer, but their toolbar, picker, drag-and-drop, and collection
  generation entry points are hidden or retired.
- Repeated placements of the same Literature source are allowed. Canvas node
  identity represents a placement; Zotero native keys represent its source.
- The first Quote acquisition UI is an annotation browser opened from a
  Literature node. Reader commands and cross-tab annotation dragging come
  later.
- Adding Quotes does not create automatic visual or academic connections.
- Note contents never update automatically. A manual refresh overwrites the
  local Note only after an explicit warning and confirmation.
- Source resolution is progressive and lazy. Persisted snapshots render first;
  Zotero lookups never block initial canvas display.

## 3. Zotero Item Boundary

The host applies this dispatch order to every selected, dropped, or generated
Zotero object:

```text
item.isRegularItem() -> Literature acquisition
item.isNote()        -> Note acquisition
item.isAnnotation()  -> Quote acquisition when explicitly requested
item.isAttachment()  -> unsupported input; create no node
otherwise            -> unsupported input; create no node
```

Annotation acquisition is not exposed through generic Zotero item drag-and-drop
in this phase. It is initiated by the Literature annotation browser and is
limited further in section 8.

The collection-to-canvas command follows the same rules: Regular Items become
Literature nodes, Zotero Notes already included by that command become
source-backed Academic Notes, and child PDF or file attachments do not become
nodes.

## 4. Architecture and Ownership

```text
Zotero APIs
  -> Zotero Academic Source Gateway (plugin host)
  -> typed postMessage protocol
  -> whiteboard acquisition and resolution state (iframe)
  -> canonical Academic Canvas document
```

### 4.1 Plugin host

The host owns all Zotero-dependent work:

- map between Zotero library IDs and persisted `ZoteroLibraryRef` values;
- resolve a user or group library reference back to a local library;
- resolve Zotero native keys without title, DOI, or text matching;
- classify resolved objects and validate their parent chain;
- create Literature, Note-source, and Quote snapshots;
- list supported PDF annotations for a Literature source;
- convert Zotero Note HTML to plain Markdown-compatible text;
- open a resolved Zotero Item, Note, or PDF Annotation;
- schedule, cache, and cancel source lookups.

These operations live behind one source-gateway boundary. UI handlers do not
repeat library/key conversion or snapshot construction.

### 4.2 Whiteboard package

The isolated whiteboard package owns:

- source acquisition requests initiated by canvas interactions;
- loading placeholders and acquisition failure recovery;
- progressive resolution priorities based on selection and viewport;
- transient per-node source availability state;
- application of current source snapshots without creating editing history;
- explicit user edits, refresh confirmation, undo, and save revision changes;
- the annotation browser and placement of acquired Quotes.

The package does not import or assume Zotero globals.

### 4.3 Persisted model

The existing schema remains authoritative. It stores only native keys and
minimal snapshots:

```ts
type ZoteroLibraryRef = { type: "user" } | { type: "group"; groupID: number };

interface LiteratureSource {
  library: ZoteroLibraryRef;
  itemKey: string;
}

interface NoteSource {
  library: ZoteroLibraryRef;
  noteKey: string;
  itemKey?: string;
}

interface QuoteSource extends LiteratureSource {
  attachmentKey: string;
  annotationKey: string;
}
```

Local integer item IDs, Better BibTeX keys, resolution state, and scheduler
state are never persisted.

## 5. Source Gateway Rules

### 5.1 Library mapping

- An item in `Zotero.Libraries.userLibraryID` maps to `{ type: "user" }`.
- An item in a group library maps to `{ type: "group", groupID }`.
- Unsupported library types fail acquisition explicitly; they are not coerced
  to the user library.
- Resolution reverses this mapping and then looks up the exact native object
  key in that library.

### 5.2 Integrity checks

- Literature must resolve to a Regular Item with the expected item key.
- Note must resolve to a Note. When `itemKey` exists, its parent must be the
  referenced Regular Item.
- Quote must resolve to an Annotation whose parent Attachment and grandparent
  Regular Item match all three persisted keys.
- A mismatch is reported as unavailable or changed source. Bamboo does not
  silently retarget by title, DOI, page, or similar excerpt text.

### 5.3 Cache

Resolution cache keys include the source kind, library discriminator, and all
native keys required by that source. Duplicate Literature placements share the
same host lookup and resolved snapshot while retaining independent node IDs and
canvas styles.

The cache belongs to the open whiteboard session. Closing the session releases
it. Zotero notifier-driven invalidation is not required in this phase.

## 6. Literature Workflow

### 6.1 Acquisition

Dragging or picking a single Regular Item creates a temporary visual placeholder
at the intended canvas position. The host returns a typed Literature acquisition
containing:

```ts
{
  source: { library, itemKey },
  snapshot: {
    title,
    creators?,
    year?,
    publicationTitle?,
    tags?,
    annotationCount?
  }
}
```

On success, the placeholder becomes a Literature node in one undoable canvas
operation. On failure, the placeholder is removed and a localized error is
shown. No incomplete source node is persisted.

Initial Literature acquisition omits `annotationCount`; counting annotations
requires traversing attachments and happens only when the annotation browser is
opened.

Single-item acquisition is completed and verified before multi-item drop is
added. Multi-item acquisition later reuses the same gateway operation and lays
out successful results as one undoable group while reporting individual
failures.

### 6.2 Presentation and actions

- The toolbar's former Zotero Item entry creates Literature and is labeled as
  Literature.
- Double-clicking or choosing **Open in Zotero** resolves the source and selects
  the Regular Item.
- **View annotations** opens the annotation browser described in section 8.
- **Refresh source** immediately schedules a high-priority resolution.
- A missing source retains its snapshot, layout, connections, styling, export,
  and deletion behavior.

## 7. Progressive Source Resolution

### 7.1 Startup behavior

Opening a canvas follows this order:

```text
parse document
  -> render every node from its persisted snapshot
  -> initialize source states without waiting for Zotero
  -> resolve selected or explicitly requested sources
  -> resolve visible source nodes
  -> resolve remaining sources in idle batches
```

There is no all-sources startup barrier.

### 7.2 Priority and concurrency

Resolution has three priorities:

1. selected nodes and explicit open/refresh actions;
2. source nodes intersecting the current viewport;
3. remaining source nodes in document order during idle periods.

The host runs no more than four source lookups concurrently. Results return in
small incremental batches so one slow or invalid source cannot delay unrelated
cards. Selection or an explicit action promotes an already queued source rather
than adding a duplicate job.

Closing a tab, loading another document into the session, or destroying the
iframe cancels queued work and ignores late results from the superseded request
generation.

### 7.3 Runtime state

Each source-backed node has transient state equivalent to:

```ts
type SourceResolutionState =
  | { status: "idle" | "loading" }
  | { status: "resolved" }
  | { status: "unavailable"; message: string };
```

This state is outside `CanvasDocument`. A failure affects only its node and does
not reject canvas loading.

### 7.4 Snapshot updates

- Literature and Quote display the latest successfully resolved Zotero data.
- Applying a background source snapshot does not increment the user-edit
  revision, add an undo entry, or immediately dirty the document.
- The refreshed snapshot is included the next time a real edit or explicit save
  writes the document.
- Export uses resolved data where available and the persisted fallback for
  sources not yet resolved. Export never waits for the idle queue.
- **Refresh source** requests immediate resolution. If Literature or Quote data
  changes, this explicit action advances the save revision and persists the new
  snapshot without adding an undo entry or changing canvas geometry and
  semantic relationships.

## 8. Zotero Note Workflow

### 8.1 Import

Standalone Notes and child Notes are accepted. Import creates an Academic Note
with local `content`, a `NoteSource`, and an optional source-title snapshot.
Child Notes include their Regular Item parent's native key. Standalone Notes do
not invent an `itemKey`.

The host uses Zotero's own text utilities for the fast first version:

1. `Zotero.Utilities.cleanTags()` removes HTML while preserving paragraph and
   line-break boundaries supported by that utility.
2. `Zotero.Utilities.unescapeHTML()` decodes entities into user text.
3. Whitespace is normalized conservatively without collapsing paragraph
   breaks.

The result is plain text, which is valid Markdown. If a utility is unavailable
in a supported Zotero runtime, a DOM text-content fallback preserves readable
content rather than rejecting the Note.

### 8.2 Independence and manual refresh

- Import copies Note content once.
- Zotero changes never overwrite canvas `content` during background resolution.
- Canvas edits never write to the Zotero Note.
- Background resolution may update only availability and source-title display.
- A source-backed Note exposes **Refresh from Zotero** in the selection
  properties panel.
- Before refresh, Bamboo warns that Zotero's current Note will replace the local
  canvas content and that local content changes will be lost.
- After confirmation, the host resolves and converts the current Note. The
  content and source-title snapshot update as one undoable user edit and trigger
  normal saving.
- Cancel, missing source, conversion failure, or a changed parent chain leaves
  the existing local content untouched.

Local Notes without a `source` do not display the refresh action.

## 9. Literature Annotation Browser

### 9.1 Entry and layout

The Literature properties panel contains **View annotations**. The action opens
a dedicated canvas overlay rather than placing a long annotation list inside
the compact properties panel.

The browser:

- queries annotations only when opened;
- groups or identifies results by PDF attachment name;
- sorts attachments deterministically and annotations by their Zotero sort
  index/page order;
- shows excerpt text, optional comment, page label, and annotation color;
- provides text search, single selection, multi-selection, and **Add selected**;
- marks annotations already represented by a Quote in the current canvas.

Annotation counts are not recomputed during ordinary Literature resolution.
They are obtained lazily when the browser is opened, preventing attachment and
annotation traversal from slowing initial rendering.

### 9.2 Supported annotations

The first version accepts only non-empty `highlight` and `underline`
annotations whose parent is a PDF Attachment and whose grandparent is a Regular
Item. It excludes:

- standalone PDF annotations without a Regular Item parent;
- image and ink annotations;
- annotation notes without an excerpt;
- EPUB and webpage snapshot annotations;
- annotations whose three-object source chain cannot be verified.

### 9.3 Add behavior and duplicates

Selected annotations become Quote nodes laid out beside or below the originating
Literature. One batch is one undoable operation.

No connection is created automatically. The source keys already preserve
provenance, while academic connections remain explicit human judgments.

The browser prevents accidental re-acquisition of an annotation key already in
the canvas and can focus the existing Quote. This is an acquisition UI rule,
not a schema uniqueness constraint: copying a node or importing a valid graph
may still produce repeated Quote sources.

## 10. Quote Workflow

Each acquired Quote persists:

```ts
{
  source: {
    library,
    itemKey,
    attachmentKey,
    annotationKey
  },
  snapshot: {
    text,
    comment?,
    citation?,
    pageLabel?,
    color?
  }
}
```

Quote content is Zotero-owned source data, unlike Academic Note content.
Progressive resolution updates its displayed snapshot when current source data
is available. If the source becomes unavailable, the last saved snapshot
remains readable.

**Open source** resolves the full key chain, opens the PDF Attachment, and asks
the Zotero Reader to navigate to the Annotation. If exact annotation navigation
is unavailable in a supported Zotero version, Bamboo opens the PDF at the
resolved page as a defined fallback and reports no false exact-location state.

## 11. Protocol Evolution

The iframe protocol is internal and advances to version 2 without supporting the
unreleased version-1 academic workflow. It gains typed messages for:

- acquiring one or more dropped/selected Zotero sources;
- requesting prioritized source-resolution batches;
- returning incremental per-node resolution results;
- listing annotations for a Literature source;
- acquiring selected annotations as Quote payloads;
- refreshing a Zotero Note after confirmation;
- opening source-backed Academic nodes.

Every request carries a request ID and session channel. Resolution batches also
carry a document generation so late results cannot mutate a newly loaded
document. Payload unions remain discriminated; open-ended Zotero object bags and
integer IDs are not accepted in Academic messages.

## 12. Error Handling

- Canvas parsing and snapshot rendering complete before any source lookup.
- Acquisition failures remove only their temporary placeholder.
- Resolution failures preserve the canonical node and snapshot.
- One failed source or annotation does not fail its batch.
- Missing libraries, missing keys, wrong item kinds, and parent-chain mismatches
  have distinct diagnostic codes and localized user messages.
- The annotation browser has explicit loading, empty, partial-failure, and
  unavailable-source states.
- Manual Note refresh is transactional: failure cannot partially replace local
  content.
- Errors visible to users appear in the canvas UI or host notification, not only
  in the developer console.

## 13. History and Save Semantics

- Successful user acquisition is one undoable edit.
- A multi-Quote acquisition is one undoable edit.
- Confirmed Note refresh is one undoable edit.
- Background resolution and availability changes are not undoable edits and do
  not independently dirty the document.
- An explicit Literature or Quote source refresh that changes its snapshot
  advances the save revision but does not add an undo entry.
- User edits made while resolution is running remain authoritative for local
  content, geometry, style, Frame membership, and relationships.
- Saving always serializes canonical schema-v2 objects and never runtime
  resolution or queue state.

## 14. Testing Strategy

### 14.1 Pure gateway tests

- user and group library mapping;
- Regular Item classification across representative Zotero item types;
- rejection of Attachment, Note, and Annotation in Literature acquisition;
- exact-key lookup and wrong-kind rejection;
- Literature snapshot normalization;
- Note source and parent-key construction;
- official-utility Note text conversion and DOM fallback;
- Quote three-level parent-chain verification.

### 14.2 Protocol tests

- every new request and response discriminator;
- rejection of malformed Academic acquisition payloads;
- session channel, request ID, and document-generation isolation;
- incremental partial success and failure.

### 14.3 Scheduler tests

- selected before visible before idle priorities;
- no more than four concurrent lookups;
- duplicate source coalescing;
- priority promotion;
- cancellation and stale-result rejection;
- continued progress after an individual failure.

### 14.4 Canvas interaction tests

- Literature placeholder success and cleanup on failure;
- single and batch acquisition history behavior;
- snapshots render before resolution;
- background resolution does not dirty history;
- Note refresh warning, cancel, failure, overwrite, undo, and save;
- annotation browser loading, search, selection, duplicate state, and batch add;
- no automatic connection creation;
- missing sources remain editable and exportable.

### 14.5 Host integration and Zotero smoke tests

- personal and group libraries;
- representative Regular Item kinds;
- standalone and child Notes;
- multiple PDFs and ordered highlight/underline annotations;
- deleted items, deleted annotations, missing group libraries, and changed
  parent chains;
- a large canvas opening interactively while progressive resolution continues;
- save, close, restart Zotero, reopen, source navigation, and export.

## 15. Implementation Sequence

1. Retire Attachment-facing entry points and make every Regular Item entry
   produce Literature.
2. Add the source gateway, library mapping, source validation, snapshots, and
   typed protocol payloads.
3. Complete the single-Literature acquire/save/reopen/open/unavailable vertical
   slice.
4. Add the progressive resolver, priority queue, cache, cancellation, and
   transient source states.
5. Add multi-Literature acquisition using the established gateway.
6. Complete standalone and child Note import plus confirmed manual refresh.
7. Add the on-demand Literature annotation browser.
8. Complete Quote acquisition, progressive resolution, and source navigation.
9. Run full automated verification and the real-Zotero smoke matrix.

Each step must leave the full test suite and production build passing. A later
step may not be used to conceal a broken earlier vertical slice.

## 16. Excluded Scope

- Zotero Reader **Add to current canvas** commands;
- cross-tab annotation drag-and-drop;
- image, ink, EPUB, and webpage annotations;
- standalone Attachment nodes as new user input;
- automatic academic or visual connections;
- automatic Zotero Note content updates or Canvas-to-Zotero Note writes;
- persisted source lifecycle flags;
- Zotero notifier-driven live updates;
- full rich HTML-to-Markdown conversion and embedded Note images;
- relationship editing UI and AI graph policy.

## 17. Completion Criteria

This phase is complete when a user can:

1. open a canvas immediately from persisted snapshots;
2. add a personal- or group-library Regular Item as Literature;
3. save, restart Zotero, reopen, and resolve it by native keys;
4. import a Zotero Note as independently editable content and manually refresh
   it only after an overwrite warning;
5. browse a Literature's supported PDF annotations and batch-add Quotes;
6. reopen a Quote and navigate back to its Zotero source;
7. retain useful cards and graph structure when any source is missing; and
8. use a large canvas while source resolution proceeds progressively without a
   startup freeze.

The phase does not require Reader UI integration or any new Academic object
kind.

## 18. References

- Zotero Regular Item behavior:
  <https://github.com/zotero/zotero/blob/main/chrome/content/zotero/xpcom/data/item.js>
- Zotero item type API: <https://api.zotero.org/itemTypes?locale=en-US>
- Zotero library item overview:
  <https://www.zotero.org/support/kb/library_items>
- Zotero text utilities:
  <https://github.com/zotero/utilities/blob/master/utilities.js>
