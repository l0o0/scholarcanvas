# First-run Tutorial Whiteboard Design

- Date: 2026-09-07
- Status: Confirmed
- Scope: Create and open one localized tutorial whiteboard on first successful startup
- Depends on:
  - `2026-09-03-academic-canvas-schema-design.md`
  - `2026-09-04-zotero-academic-source-workflows-design.md`
  - `2026-09-06-unified-note-templates-design.md`

## 1. Goal

Give a new Bamboo user an immediately usable introduction to the academic
whiteboard. The tutorial itself is a normal, editable `.canvas` attachment, so
learning the interface also demonstrates the real visual result and persistence
model.

The tutorial is created once in the Zotero user-library root and opens
automatically. It uses a real user-library Item when a suitable one can be found
cheaply and safely; otherwise it remains a complete static tutorial.

## 2. Confirmed product behavior

- Create the tutorial on the first successful plugin startup.
- Store it as a standalone attachment in the user-library root, never in the
  currently selected collection.
- Open it automatically after creation.
- Localize its content from the current Zotero interface locale at creation
  time. Later locale changes do not rewrite it.
- Record completion after the attachment is created successfully and before
  attempting to open it.
- Do not recreate it if the user later deletes it.
- If attachment creation fails, leave the completion marker unset and retry on
  a later startup.
- Never block the rest of plugin startup on tutorial discovery, creation, or
  opening.

## 3. Tutorial layout

The tutorial uses a left-to-right guided path rather than a dashboard or a set
of documentation cards:

```text
Welcome
  -> add Literature
  -> browse and add Quote
  -> write a Note from Question or Claim template
  -> connect evidence and thought
  -> organize with a Frame
```

The canvas demonstrates dragging, zooming, editing, Note badges and templates,
Frames, arrows, and semantic relationships. A clearly bounded practice area
invites the user to drag in another Zotero Item and continue editing.

The instructional copy must remain short enough to scan spatially. Notes and
badges carry meaning as well as color, and the document uses the existing light
and dark compatible canvas style model.

## 4. Real sample selection

The sample is selected deterministically, not randomly.

### 4.1 Scope and bounds

- Search only the current Zotero user library.
- Consider only a fixed-size set of recently modified candidates.
- A primary candidate must be a Regular Item.
- Do not use group-library data.
- Do not choose an attachment, standalone Note, or Annotation as the primary
  sample.
- Do not mutate, move, tag, or otherwise save any source Item.

The production selector may use a bounded Zotero database query to obtain recent
Item IDs, then resolve those IDs through `Zotero.Items`. This keeps work bounded
without loading or sorting the entire library in JavaScript. The database query
must select only IDs and rely on public Item methods and the existing source
gateway for all semantic classification and conversion.

### 4.2 Ranking

Candidates are ranked by available tutorial value:

1. a Regular Item with at least one supported PDF annotation and at least one
   child Note;
2. a Regular Item with supported PDF annotations;
3. a Regular Item with child Notes;
4. any other Regular Item.

Within the same tier, the most recently modified Item wins, with Item ID as the
final stable tie-breaker. The first implementation considers at most 50 recent
Item IDs. This is a fixed product constant rather than a preference.

### 4.3 Materialized sample

The chosen source contributes at most:

- one Literature acquisition;
- two supported, non-empty PDF highlight or underline Quote acquisitions;
- one child Note acquisition.

The implementation reuses `ZoteroSourceGateway.acquireItem()` and
`listAnnotations()` so library references, native keys, Note conversion,
annotation filtering, and snapshots have one authority. A failure in one child
record does not discard other valid sample data.

The tutorial states that sample cards come from the user's own library and that
Bamboo does not modify the source Items. The copied snapshot and excerpt text
become ordinary canvas content and may synchronize wherever the user's Zotero
attachments already synchronize.

If no valid Regular Item exists, or discovery throws, the builder receives no
sample and produces the static guided tutorial.

## 5. Architecture

The feature adds three focused units.

### 5.1 Tutorial document builder

`tutorialCanvasDocument(labels, sample?)` is a pure function. It creates a
complete canonical schema-v2 `CanvasDocument` from localized strings and an
optional, already validated sample. It has no Zotero dependency and can be
parsed, saved, reopened, exported, and edited like any other canvas.

The builder creates final nodes and styles. It does not persist tutorial-only
flags, renderer modes, template dependencies, or fake Zotero keys.

### 5.2 Sample selector

`selectTutorialSample()` is host-only. It performs the bounded recent-ID query,
resolves Zotero Items, classifies candidates, and returns acquisitions ready for
the pure builder. It does not save any source Item.

The selector depends on a narrow injected port in tests. Production wiring may
use Zotero's database only to retrieve bounded recent IDs; all Item semantics
remain behind normal Zotero Item methods and the existing source gateway.

### 5.3 Startup coordinator

`ensureTutorialWhiteboard()` owns the one-time lifecycle:

```text
completion marker absent
  -> discover optional sample
  -> build localized document
  -> create standalone attachment in user-library root
  -> set completion marker
  -> open attachment
```

`onStartup()` schedules the coordinator after Zotero and localization are ready
without awaiting it. The startup function therefore finishes even when sample
selection or tutorial creation is slow or fails.

## 6. Attachment creation boundary

The existing `createWhiteboardAttachment()` gains only the options needed to
avoid ambient UI selection:

- explicit `libraryID`;
- explicit `collections`, including an empty list;
- explicit filename/title;
- optional selection of the new attachment.

Ordinary menu creation keeps its current behavior. Tutorial creation passes the
user-library ID, an empty collection list, its localized filename, and disables
selection before opening the tab itself.

No tutorial-specific attachment MIME type, database field, collection, parent
Item, or hidden metadata is introduced.

## 7. Completion marker and concurrency

A Boolean plugin preference records that the tutorial attachment was created.
The marker means "onboarding was initialized", not "the attachment still
exists". The coordinator never searches for or recreates a deleted tutorial.

The marker is written immediately after attachment creation succeeds and before
opening. An in-memory promise coalesces repeated calls during the same startup,
so multiple Zotero windows cannot create duplicate tutorials.

If attachment creation fails, the marker remains absent and a later startup may
retry. If opening fails after creation, the marker remains set and the created
attachment remains available in the library.

## 8. Localization and UX copy

English and Simplified Chinese Fluent messages provide the filename and all
tutorial content. The builder receives resolved strings; it does not call the
localization service itself.

The tutorial uses concise imperative copy and existing canvas styles. Meaning
does not depend on color alone: cards retain visible titles or badges, arrows
retain labels where needed, and the practice Frame has an explicit instruction.

There is no welcome modal, multi-step wizard, progress animation, or separate
documentation surface.

## 9. Error handling

- Discovery errors are logged and converted to an empty optional sample.
- Individual Note or Annotation failures are skipped without rejecting the
  complete tutorial.
- Builder output is validated before it reaches attachment persistence.
- Attachment creation errors are logged, leave the marker unset, and do not
  reject plugin startup.
- Open errors are logged after the marker is set and do not recreate the
  tutorial.
- Failure does not show a repeated startup notification or modal.

## 10. Testing

Pure document tests cover:

- valid English and Chinese canonical documents;
- the left-to-right guided structure;
- sample and sample-free layouts;
- no fake Zotero sources;
- at most one Literature, two Quotes, and one source-backed Note;
- parse, JSON Canvas serialization, and reopen behavior.

Selector tests cover:

- the fixed candidate bound;
- user-library and Regular Item filtering;
- deterministic tier, modification-time, and Item-ID ordering;
- supported annotation filtering through the existing gateway;
- child Note limit;
- partial failures and no-result fallback;
- no calls that save or mutate source Items.

Coordinator tests cover:

- first startup creates and opens exactly once;
- an existing marker performs no discovery or creation;
- successful creation sets the marker before open;
- creation failure leaves the marker unset;
- open failure does not clear the marker or create a duplicate;
- concurrent calls share one operation;
- explicit root-library attachment options;
- coordinator failure never rejects plugin startup.

Regression verification includes all whiteboard tests, TypeScript checking,
lint, and the production plugin build.

## 11. Non-goals

This design does not add:

- a tutorial-specific canvas schema or renderer;
- a guided overlay, wizard, checklist state machine, or completion analytics;
- automatic recreation after deletion;
- group-library sampling;
- arbitrary or unbounded library scans;
- automatic source Item modification;
- preference UI for candidate limits or tutorial content;
- live links that rewrite the tutorial when templates or localization change.

## 12. Acceptance criteria

1. A fresh installation creates and opens one localized tutorial canvas in the
   user-library root.
2. The tutorial is an ordinary editable schema-v2 canvas and requires no
   special rendering support.
3. A suitable recent user-library Regular Item produces a real Literature card
   plus bounded available Quotes and child Note content.
4. Missing or malformed library data falls back to a complete static tutorial.
5. Startup work remains bounded and never blocks the rest of the plugin.
6. Source Zotero Items are never modified.
7. Successful creation is recorded once; deletion or opening failure does not
   trigger recreation.
8. English and Simplified Chinese variants, lifecycle behavior, and production
   packaging are covered by automated verification.
