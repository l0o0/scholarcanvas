# Task 6 Report — Add Frame Membership and Group Movement

## Result

Task 6 adds explicit, immutable Frame membership operations, direct-member
movement, unified deletion semantics, and Frame-aware app transitions. It does
not infer membership from overlap and does not add the Inspector assignment UI
reserved for Task 7.

## TDD record

### Pure operations RED/GREEN

The first `whiteboard-frame` run failed at module loading because
`whiteboard/frame.ts` did not exist. The minimal implementation then made the
new behavior tests pass for assignment/detachment, Frame movement, and deletion.

Follow-up behavior tests drove the interaction edge cases:

- A batch-movement test first failed because `moveNodesInDocument()` was absent;
  GREEN routes multiple Frame and ordinary-node positions through one immutable
  document transition.
- A multi-selection, two-step drag test first failed because `beginFrameDrag()`
  was absent; GREEN tracks every directly dragged Frame and applies only each
  incremental delta to its direct members.
- A prototype-key regression first moved a Frame named `toString` to an invalid
  position; GREEN uses own-property checks for drag-session IDs.

The resulting tests prove that coordinates remain absolute, overlap alone does
not establish membership, Frames cannot become members, only direct members
move, input documents are unchanged, and root/node metadata and extensions are
retained.

### App integration RED/GREEN

App-state and renderer tests were added before integration. Their initial RED
identified missing Frame drag orchestration, shared deletion, Frame hit regions,
and Frame-aware routing for calculated movement.

GREEN provides these interaction sequences:

1. `onNodeDragStart` pushes one history snapshot and records every selected
   Frame participating in the drag.
2. Each React Flow position batch is converted to a canonical document update.
   Frame deltas move direct members incrementally while explicit ordinary-node
   positions remain authoritative.
3. Normal drag stop clears the session and emits one `changed`. Escape and
   deletion first mark the drag as ending; terminal React Flow position changes
   are suppressed until the physical drag stops, preventing a second `changed`
   or Frame/member separation. Escape emits the drag notification, while
   deletion relies on its own single snapshot/change transition.
4. Alignment, distribution, auto-layout, and keyboard nudging all use the same
   canonical position transition, so none bypass Frame member movement.

Every deletion entry point now uses one canonical transition. Deleting a Frame
detaches and preserves its members; deleting any node removes its incident
connections. React Flow's built-in delete shortcut is disabled so it cannot
race that transition.

### Review hardening RED/GREEN

Internal review found two important integration gaps: single-node drag tracking
did not cover multi-selection ordering, and alignment/distribution/layout/nudge
could bypass Frame rules. Behavior tests reproduced both before the shared batch
transition and multi-Frame drag session were introduced.

A second review found competing Arrow-key owners. A zero-dependency test using
real `EventTarget` propagation now proves that the canvas capture boundary calls
the canonical nudge exactly once and prevents the downstream React Flow handler.
The same test proves that input and contenteditable targets are left alone. The
narrow capture helper is used by both the React Flow boundary and the window
fallback, retaining keyboard accessibility without disabling React Flow's other
keyboard support.

Final review then reproduced React Flow's terminal position event after Escape
or deletion. A lifecycle behavior test first failed because there was no
`beginFrameDragState()` export. GREEN adds explicit `active`, `ending`, and
stopped transitions: ending ignores terminal positions, active stop notifies,
and ending stop only clears state. This removes the duplicate notification and
keeps the Frame/member relationship canonical through interruption.

## Implementation

- `assignNodeToFrame()` validates both IDs and the Frame kind, rejects Frame
  members, and supports explicit detachment.
- `moveFrame()` calculates one absolute delta and applies it to the Frame plus
  only nodes whose stored `frameId` directly matches.
- `moveNodesInDocument()` composes multiple Frame moves and explicit node
  targets without mutating the source document.
- `beginFrameDrag()`/`updateFrameDrag()` preserve previous Frame positions so
  successive React Flow absolute updates produce incremental member movement.
- `deleteNodeFromDocument()` removes incident connections and detaches direct
  members only when their Frame is deleted.
- The Frame renderer remains the Quiet Research Desk transparent dashed
  boundary. Its React Flow layer is below normal nodes, its interior ignores
  pointer events, and only the title and four thin border rails are interactive.

## Scope

No overlap hit-testing, automatic membership, nested Frame membership,
Inspector assignment controls, persistence migration, or Task 7 behavior was
added. No package dependency or lockfile change was needed for the keyboard
event behavior coverage.

## Verification

The first complete gate passed 75 behavior tests and the package typecheck, then
stopped at Prettier warnings in the two newly changed app/test files. After the
mechanical formatting pass, the same fresh gate completed with 75 tests, package
typecheck, full lint, and diff checks passing. The terminal-drag review fix was
added afterward, so the final pre-commit gate below supersedes those interim
results.

The fresh final pre-commit gate, including that lifecycle fix, completed with:

- focused Task 6 plus affected Task 5 renderer/localization/toolbar/draw tests:
  76 passed, 0 failed;
- `pnpm --filter @zotero-markdown/whiteboard exec tsc --noEmit`: exited 0;
- `pnpm lint:check`: exited 0;
- `git diff --check`: exited 0.

The final independent review reported no remaining Critical, Important, or
Minor issue and marked the task ready.
