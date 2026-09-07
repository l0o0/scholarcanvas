# Whiteboard Dark Cards and Template Menu Design

## Goal

Fix two visual inconsistencies in the academic whiteboard:

- real sample cards in the generated tutorial must remain readable and native-looking in both light and dark themes;
- the Note template selector in the top toolbar must use the same compact visual language as the rest of the toolbar instead of the platform's mismatched native select chrome.

## Root Causes

The tutorial builder persists a fixed pale-blue fill and dark text color on its sample Literature, Quote, and Note cards. Those explicit values override the renderer's theme variables, so the cards remain light in dark mode.

The toolbar uses a styled native `<select>`. On macOS, the browser still paints its own disclosure button and popup styling, producing a nested grey button and a menu that does not match Bamboo's dark surface.

## Card Styling

Tutorial sample cards will retain a blue accent stroke, two-pixel width, and existing radius. Their persisted style will not specify `fill` or `textColor`. The ordinary card renderer will therefore supply the current theme's surface and text colors.

This change applies only when generating a new tutorial. It does not reinterpret explicit colors on normal user-created cards and does not add a tutorial flag, renderer exception, migration, or schema field. Existing generated tutorial files keep their stored appearance until recreated.

## Template Menu

Replace the native template `<select>` with a compact toolbar button and an anchored menu built from existing toolbar/menu primitives.

- The trigger shows the active template name and a small downward chevron.
- It uses a transparent resting surface, the standard toolbar hover state, a visible focus ring, and theme variables for all colors.
- The popup shares the existing More menu's border, radius, surface, and restrained shadow.
- Each template is a full-width menu row. The active row has `aria-checked="true"` and a visible check mark.
- Choosing a row updates the active template, activates the Note tool, closes the menu, and returns focus to the trigger.
- Clicking outside or pressing Escape closes the menu. Keyboard users can open the trigger and reach every row without relying on pointer input.
- The existing More menu and template menu are mutually exclusive.

This changes only the toolbar presentation. Template IDs, custom-template storage, keyboard shortcuts, and the Canvas document remain unchanged.

## Testing

Tests will first reproduce both defects:

- tutorial sample styles must omit fixed `fill` and `textColor` while retaining their accent stroke;
- toolbar markup must no longer contain the native template `<select>` and must expose a labelled menu trigger, checked current item, and menu items;
- CSS must use Bamboo theme variables and include focus, hover, active, and popup states;
- interaction tests cover selection, outside dismissal, Escape dismissal, and mutual exclusion with More.

The focused toolbar/tutorial tests, complete whiteboard suite, TypeScript checks, lint, and production build must pass.

## Non-goals

- No migration or automatic rewrite of an already-created tutorial.
- No general redesign of the toolbar.
- No new color system, menu framework, dependency, or persisted setting.
- No change to user-selected explicit card colors.
