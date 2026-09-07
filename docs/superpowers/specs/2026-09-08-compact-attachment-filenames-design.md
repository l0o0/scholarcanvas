# Compact Attachment Filenames Design

## Goal

Use short, sortable default names for newly created Bamboo Markdown and Canvas attachments while keeping their document type immediately visible.

## Naming Rules

New attachments use local time with second precision:

- `Note-YYYYMMDD-HHmmss.md`
- `Canvas-YYYYMMDD-HHmmss.canvas`

For example:

- `Note-20260908-002134.md`
- `Canvas-20260908-002134.canvas`

The compact timestamp sorts chronologically as plain text. Two attachments created within the same second may have the same visible title; Zotero item identity and isolated storage keep them distinct, so no random suffix is added to the user-facing name.

## Creation Behavior

Default Markdown and Canvas creation no longer incorporates a parent Zotero item's title. The generated filename is also used as the Zotero attachment title. A new Markdown document continues to derive its initial document title from the generated filename stem.

Explicit filenames remain authoritative. This preserves the localized `Bamboo Tutorial.canvas` onboarding name and any caller that intentionally supplies a filename.

Manual rename behavior is unchanged. Existing attachments are not migrated or renamed.

## Physical Storage

Canvas creation writes the intended filename inside a uniquely named temporary directory before importing it. The temporary uniqueness token must not become part of the imported attachment filename. This removes the current leaked `zotero-whiteboard-<milliseconds>-` prefix.

Markdown keeps its existing internal `zmd-` physical-storage prefix because the editor's create and rename paths already rely on that invariant. The prefix remains hidden from the Zotero attachment title and Bamboo UI. The visible Markdown title is therefore `Note-<timestamp>.md`, while its internal stored filename may be `zmd-Note-<timestamp>.md`.

## Scope Boundaries

- No schema or document-content changes.
- No compatibility migration because the product is unreleased, but existing user files remain untouched.
- No random suffix or collision registry in visible names.
- No change to imported files, explicitly named tutorial files, or user rename controls.
- No new dependency or shared naming abstraction unless existing small helpers can be reused directly.

## Verification

Tests cover the exact timestamp format for Markdown and Canvas, independence from parent titles, preservation of explicit filenames, isolation of the Canvas temporary path, and absence of the temporary prefix from the imported Canvas filename. Existing Markdown storage-prefix and rename tests continue to pass, followed by type checking, linting, and a production build.
