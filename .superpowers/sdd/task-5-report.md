# Task 5 Ponytail Cleanup Report

## Outcome

Applied both evidence-backed simplifications from
`task-5-ponytail-review.md` and no others:

- Replaced `copyLiteratureSource` / `copyLibrarySource` and source-field
  reconstruction at the Literature, Quote, and Note sample call sites with one
  typed shallow `copySource` helper. It preserves every source key while cloning
  the nested library object for isolation.
- Reduced the host whiteboard barrel's tutorial surface to the sole runtime
  consumer, `ensureTutorialWhiteboard`. Selector tests continue to import the
  implementation module directly.

No module-level tutorial exports, validation, fixed bounds, lifecycle/error
handling, or existing tests were removed.

## Consumer Evidence

- `src/hooks.ts` is the only production consumer through
  `src/modules/whiteboard/index.ts`, and imports only
  `ensureTutorialWhiteboard`.
- `test/whiteboard-tutorial-sample.test.ts` imports
  `selectTutorialSample`, `TUTORIAL_CANDIDATE_LIMIT`, and
  `TutorialSampleDependencies` directly from `tutorial.ts`.
- `test/whiteboard-tutorial-onboarding.test.ts` imports
  `TutorialOnboardingDependencies` directly from `tutorial.ts`.

## RED / GREEN

Added a focused assertion that an additional source key survives the tutorial
sample copy. Before the cleanup:

```text
pnpm exec tsx --test test/whiteboard-tutorial-document.test.ts
exit 1: 1 passed, 1 failed
actual extension: undefined; expected: "preserved"
```

After the generic copier:

```text
pnpm exec tsx --test test/whiteboard-tutorial-document.test.ts
exit 0: 2 passed, 0 failed
```

The existing assertions continue to verify top-level source, nested library,
snapshot, tag-array, and Note snapshot isolation across all sample kinds.

## Complete Verification Gate

Fresh final runs after formatting:

```text
pnpm exec tsx --test test/whiteboard-*.test.ts
exit 0: 404 passed, 0 failed

pnpm exec tsc --noEmit
exit 0

pnpm lint:check
exit 0: Prettier matched all files; ESLint passed

pnpm build
exit 0: production build finished; bundled TypeScript check passed

git diff --check
exit 0
```

The first combined gate exposed only a Prettier wrapping difference in
`packages/whiteboard/src/model/tutorial.ts`; the file was formatted before the
fresh final gate above.

## Line Delta From `9f9c5a9`

Production:

```text
packages/whiteboard/src/model/tutorial.ts  +8 -23
src/modules/whiteboard/index.ts             +1  -9
Production subtotal                         +9 -32 = -23 lines
```

Tests:

```text
test/whiteboard-tutorial-document.test.ts   +9  -0 = +9 lines
```

Net production + test delta: **-14 lines** (`+18`, `-32`). The report itself is
excluded from this requested production/test calculation.

## Concerns

None. The extra-key regression assertion removes its synthetic key before the
existing strict canvas round-trip check, so it tests copy behavior without
changing the persisted schema under test.
