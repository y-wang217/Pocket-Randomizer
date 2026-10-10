# GYMRUN patch: the CI fork cap, and the scene's leaked timer

Filed 2026-10-09 on `claude/sharp-ritchie-qb95px`, from `main` at `3d0847e`
(PR 107 merged), **before any change to the tree**.

## The brief, verbatim

> Yes start on those 2

## What "those 2" are

The two items left open when PR 107 merged, as the message before this one
named them:

1. **The two-fork CI cap.** `scripts/vitest-split.mjs` passes `--maxWorkers=2`
   under `CI` on both halves, added in `docs/generation.md` section 47 on the
   reading that the `onTaskUpdate` timeout was runner load. Section 126 found
   it was one test holding its worker's event loop past 60s, and the comment
   now says the reading is wrong. Removing the cap would likely speed up the
   Node leg.
2. **The leaked `scene.ts` timer.** Run 37928075949 failed `node suite` on
   `ReferenceError: document is not defined` from `Timeout.draw` in
   `src/ui/scene.ts:717`, after `test/species-label.test.ts`'s environment was
   torn down, with every test passing. With ERRORED retired (section 126a) an
   unhandled error of this kind fails the leg every time it fires.
