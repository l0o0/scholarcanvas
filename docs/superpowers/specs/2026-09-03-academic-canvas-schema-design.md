# Academic Canvas Schema Design

- Date: 2026-09-03
- Status: Confirmed for specification review
- Scope: Academic object model, persistence, and basic rendering
- Product state: Unreleased; experimental board formats do not require migration

## 1. Goal

Establish a small, stable academic schema for Bamboo Research Canvas before
building deeper Zotero integration. The schema must represent academic sources,
research thoughts, spatial grouping, and semantic relationships while preserving
the existing basic drawing objects.

This phase defines what a canvas can express. It does not implement the complete
Literature to Quote to Claim product workflow.

## 2. Decisions

The design uses these confirmed decisions:

- Keep one canvas containing both basic and academic objects.
- Model nodes and connections as TypeScript discriminated unions.
- Preserve the existing object capabilities and kind names:
  `item`, `note`, `pdf`, `attachment`, `text`, `rect`, `ellipse`, `line`, and
  `arrow`.
- Reclassify `note` as the academic Note representation rather than introducing
  a second Note kind. The other retained kinds remain basic objects.
- Add Literature, Quote, Question, Claim, and Frame, producing six academic
  object kinds when Note is included.
- Add `related`, `supports`, and `contradicts` academic relationships.
- Permit human users to apply academic relationships to any endpoints.
- Keep future AI constraints outside the persisted schema.
- Persist Zotero native library identity and object keys, not local integer item
  IDs and not Better BibTeX citation keys.
- Store minimal typed source snapshots for detached display.
- Give each node at most one Frame and do not support nested Frames.
- Start a new schema version without migrating the unreleased `.board` and
  `.zmdboard` experimental formats.

## 3. Architecture

The runtime document remains a single graph:

```ts
interface CanvasDocument {
  version: number;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  viewport?: CanvasViewport;
  metadata?: CanvasMetadata;
  extensions?: Record<string, unknown>;
}

type CanvasNode = BasicNode | AcademicNode;
type CanvasConnection = BasicConnection | AcademicConnection;
```

React Flow remains a rendering and interaction engine. It consumes an adapter
representation and does not define the domain model or persisted file format.
Zotero APIs remain in the plugin host. Everything under the whiteboard package's
model boundary stays pure TypeScript and can be tested without Zotero.

Recommended module ownership:

```text
packages/whiteboard/src/model/
├── core.ts          # Geometry, visual style, shared extension fields
├── basic.ts         # Existing basic objects
├── academic.ts      # Academic objects, source references, snapshots
├── connection.ts    # Basic and academic connections
├── document.ts      # CanvasDocument and runtime parsing
└── canvas-file.ts   # JSON Canvas encoding and decoding
```

Compatibility re-exports may remain at the existing package and plugin import
paths, but the new modules own the canonical definitions.

## 4. Shared Node Model

Every node has stable graph identity and absolute canvas geometry:

```ts
interface CanvasNodeBase {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  frameId?: string;
  style?: CanvasNodeStyle;
  extensions?: Record<string, unknown>;
}
```

`frameId` is available to node kinds that can be grouped. A Frame itself cannot
have a `frameId`. Absolute positions remain authoritative even for Frame members,
which avoids nested coordinate conversion and keeps JSON Canvas geometry direct.

Basic nodes retain their existing visual and source-card behavior. In the type
system, `item`, `pdf`, and `attachment` remain basic source cards, while `note`
becomes an Academic Node. Their data is split into explicit discriminated types
instead of the current index-signature object. This phase must not add a second
generic payload alongside the typed payloads.

## 5. Academic Objects

### 5.1 Literature

```ts
interface LiteratureNode extends CanvasNodeBase {
  kind: "literature";
  source: LiteratureSource;
  snapshot: LiteratureSnapshot;
}
```

Literature represents a Zotero regular item. Its persisted source is authoritative
for identity. Its snapshot exists only to render a useful card while the source
cannot be resolved.

### 5.2 Quote

```ts
interface QuoteNode extends CanvasNodeBase {
  kind: "quote";
  source: QuoteSource;
  snapshot: QuoteSnapshot;
}
```

Quote represents a Zotero PDF annotation. It retains enough parent context to
resolve the bibliographic item, PDF attachment, and annotation independently.

### 5.3 Note

```ts
interface NoteNode extends CanvasNodeBase {
  kind: "note";
  content: string;
  source?: NoteSource;
  sourceSnapshot?: NoteSourceSnapshot;
}
```

Note stores local Markdown content. When created from a Zotero Note, Bamboo
copies its content once and may retain a source reference. Later Zotero changes
must not overwrite `content`, and Canvas edits must not write back to the Zotero
Note.

### 5.4 Question and Claim

```ts
interface QuestionNode extends CanvasNodeBase {
  kind: "question";
  content: string;
}

interface ClaimNode extends CanvasNodeBase {
  kind: "claim";
  content: string;
}
```

Both store Markdown content. Their kind supplies their research meaning. This
phase does not add status, confidence, evidence counts, conclusions, or creator
fields.

### 5.5 Frame

```ts
interface FrameNode extends Omit<CanvasNodeBase, "frameId"> {
  kind: "frame";
  title: string;
}
```

Frame is a named, single-level spatial group. It does not modify Zotero
collections, tags, or item relationships.

## 6. Zotero References

References use Zotero native object keys. They do not use Better BibTeX citation
keys and do not persist local SQLite item IDs.

```ts
type ZoteroLibraryRef = { type: "user" } | { type: "group"; groupID: number };

interface LiteratureSource {
  library: ZoteroLibraryRef;
  itemKey: string;
}

interface QuoteSource {
  library: ZoteroLibraryRef;
  itemKey: string;
  attachmentKey: string;
  annotationKey: string;
}

interface NoteSource {
  library: ZoteroLibraryRef;
  noteKey: string;
  itemKey?: string;
}
```

The user-library discriminator means the current account's personal library.
`groupID` identifies a Zotero group library. The parser requires each key to be a
non-empty string but does not embed assumptions about the current Zotero key
format.

Source resolution and local item-ID caching are host concerns and are outside
the persisted schema.

## 7. Minimal Source Snapshots

```ts
interface LiteratureSnapshot {
  title: string;
  creators?: string;
  year?: string;
  publicationTitle?: string;
  tags?: string[];
  annotationCount?: number;
}

interface QuoteSnapshot {
  text: string;
  comment?: string;
  citation?: string;
  pageLabel?: string;
  color?: string;
}

interface NoteSourceSnapshot {
  title?: string;
}
```

Snapshots are display fallbacks, not a second Zotero database. When a source is
available, current Zotero data is used and the snapshot may be refreshed. When a
source is unavailable, Bamboo keeps the node, content, layout, and connections
and renders the snapshot.

`resolved` and `missing` are derived runtime states. They are not persisted,
because a temporary synchronization or library availability problem must not
permanently mark the document as detached.

`annotationCount` is a disposable display cache. It never participates in
identity, validation, or research logic.

## 8. Connections and Human Freedom

```ts
interface CanvasConnectionBase {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: CanvasConnectionStyle;
  extensions?: Record<string, unknown>;
}

interface BasicConnection extends CanvasConnectionBase {
  kind: "basic";
}

interface AcademicConnection extends CanvasConnectionBase {
  kind: "academic";
  relation: "related" | "supports" | "contradicts";
}
```

Basic connections express visual structure. Academic connections express
research meaning and default to `related` when created interactively.

The persisted schema allows an Academic Connection between any two existing
nodes. It does not require `supports` or `contradicts` to target a Claim. This
keeps human use expressive and prevents imported documents from becoming
invalid because of a semantic opinion.

A future AI integration must apply a separate policy at its tool boundary. That
policy may prefer Claims as targets, restrict permitted source kinds, attach
provenance, and require confirmation before changing human-authored structure.
Those rules are not part of this phase.

## 9. Frame Semantics

- A node can reference at most one Frame through `frameId`.
- Frames cannot reference another Frame.
- Moving a Frame updates the Frame and every direct member in one undoable
  transaction.
- Deleting a Frame clears its members' `frameId` values and preserves the
  members.
- Deleting any node deletes all incident connections.
- Parsing an unknown or non-Frame `frameId` clears the reference and reports a
  recoverable warning.
- Parsing a Frame with a `frameId` clears that reference and reports a
  recoverable warning.
- Membership is explicit. Merely moving a node visually inside a Frame does not
  assign it during this phase.

## 10. JSON Canvas Mapping

The `.canvas` file remains readable as standard JSON Canvas where possible:

- Literature, Quote, Note, Question, and Claim encode as standard `text` nodes.
  Their standard text contains a readable fallback representation.
- Frame encodes as a standard `group` node with its title as the label.
- Basic text and group-like objects use standard JSON Canvas fields directly
  where the formats agree.
- Other basic drawing objects retain their Bamboo extension data while exposing
  valid JSON Canvas geometry.
- Every connection writes standard `fromNode`, `toNode`, and optional `label`
  fields.
- Academic relationship kind and relation are stored under the node or edge's
  named `bamboo` extension.
- Academic payloads, Zotero references, snapshots, visual fields not represented
  by JSON Canvas, and `frameId` live under `bamboo`.
- Unknown root, node, edge, and Bamboo extension fields survive a Bamboo
  read/write round trip.

The codec writes a new Bamboo schema version. It does not migrate or preserve
the unreleased `.board` and `.zmdboard` runtime document formats. A standard JSON
Canvas file without Bamboo extensions remains importable as basic objects.

## 11. Parsing and Error Handling

The parser returns a document plus recoverable issues so the host can report
partial repairs without converting them into fatal open failures.

Fatal document errors include an invalid root, unsupported Bamboo schema
version, or missing node and edge arrays. Recoverable object errors include
dangling connections, invalid Frame references, and individual malformed
records.

Rules:

- Validate document version, IDs, kinds, coordinates, dimensions, required
  academic fields, and relationship enums.
- Require positive finite dimensions and finite coordinates.
- Require non-empty Zotero keys without enforcing a fixed character pattern.
- Drop malformed individual nodes and record an issue.
- Drop connections whose endpoints do not exist and record an issue.
- Clear invalid Frame membership and record an issue.
- Preserve unknown fields in explicit `extensions` records.
- Never silently replace a wholly invalid file with an empty canvas.

The UI behavior for displaying parse issues is not implemented in this phase,
but the model result must expose enough information for that later work.

## 12. Basic Rendering and Creation

This phase adds basic renderers for all six academic kinds:

- Literature shows the snapshot title and concise citation metadata.
- Quote shows excerpt text, citation, page label, and a small color indicator.
- Note, Question, and Claim show their Markdown content as plain readable text;
  full Markdown rendering is not required yet.
- Frame shows a restrained label and grouping boundary.

The toolbar exposes Note, Question, Claim, and Frame creation. Literature and
Quote receive programmatic creation functions but no placeholder picker flow;
their Zotero acquisition belongs to the next integration phase.

All new visible labels must be provided through the existing localization
protocol in English and Simplified Chinese. Node registry labels must not become
the user-facing localization authority.

## 13. Scope

### Included

- Discriminated basic and academic node models.
- Six academic objects.
- Basic and academic connections.
- Three academic relationship values.
- Single-level explicit Frame membership.
- Zotero native-key references.
- Minimal typed source snapshots.
- JSON Canvas and Bamboo extension encoding.
- Parser diagnostics and repair rules.
- Basic academic renderers and local creation entry points.
- Tests and existing package/plugin integration updates required by the model.

### Excluded

- Zotero key resolution and metadata observers.
- PDF Reader annotation commands and drag-and-drop Quote acquisition.
- Literature Inspector and annotation browsing.
- Relationship editing UI.
- AI policy, AI provenance, and AI-generated graph operations.
- Persisted lifecycle states for Question or Claim.
- Interactive detached-source recovery.
- Frame nesting and automatic spatial membership.
- Full Markdown rendering inside nodes.
- Migration from unreleased `.board` and `.zmdboard` documents.

## 14. Verification

The implementation must cover:

- Creation and parsing for every academic object kind.
- Required-field rejection for each discriminated payload.
- Zotero user and group library references.
- Minimal snapshot preservation.
- All three academic relationships with unrestricted valid endpoints.
- Basic and academic connection round trips.
- Frame membership, movement, deletion, invalid reference repair, and nesting
  rejection.
- Incident connection deletion with node deletion.
- JSON Canvas standard-field readability.
- Bamboo academic extension round trips.
- Unknown root, node, connection, and Bamboo field preservation.
- Standard JSON Canvas import as basic objects.
- Academic node registry and server-rendered component smoke tests.
- English and Simplified Chinese localization completeness.
- Existing whiteboard unit tests, TypeScript checks, standalone package build,
  and plugin production build.

## 15. Completion Criteria

This phase is complete when a `.canvas` document can create, validate, render,
save, reopen, and export all six academic object kinds, preserve the three
academic relationships and Frame membership, and retain readable standard JSON
Canvas fallbacks without requiring Zotero APIs in the model package.

Completion does not require the Zotero acquisition or Inspector workflows. The
next phase can rely on this schema as its stable boundary.
