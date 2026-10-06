# GYMRUN patch: a test for the tally the gate reads

Filed 2026-10-04 on `claude/sleepy-mccarthy-crfmqt`, before any work, under
protocol 1 and 7 of [`README.md`](README.md).

## The brief, verbatim

> Ok so we have what we think are the correct ci tests right? If so, we open a pr and check it now

and, when the answer turned out to be that `main` had already done the work:

> Close #93, keep only the gate test

## What this is the remainder of

[`gymrun-patch-ci-ansi-and-chip-instrument.md`](gymrun-patch-ci-ansi-and-chip-instrument.md)
was filed against `379c154` and overtaken: `main` moved 354 commits while it was
open, and sections 47 and 57 had already landed every part of it — the ANSI
strip (47.5), the wait for images before a box is measured (47.2), the
textless-chip skip (47.3), and real sprites through `GYMRUN_PROXY` (57.4), which
is strictly better than the local fixture that patch proposed. PR #93 is closed
with that comparison in its closing comment, and nothing from it is carried here
except the one thing `main` still lacks.

**`scripts/check.mjs` has no test of any kind.** The reporter-timeout tolerance
it grew at section 33 did not fire once between then and section 47.5 — every CI
run arrives coloured, because the legs are spawned onto pipes and tinyrainbow
treats `CI` as consent, so `ALL_FILES_PASSED` found no `\s+` between the label
and the count. The guard's own doc comment names the reason it survived:

> Locally, with no `CI`, vitest emits plain text and the same guard matched —
> which is exactly how a bug of this shape survives being tested.

A guard that is only ever exercised in the one environment where it cannot fail
is untested. This adds the coloured case.

## What it does

1. Moves the tally predicates — `REPORTER_RPC_TIMEOUT`, `ALL_FILES_PASSED`,
   `ANY_FAILED`, `ANSI`, `plain`, `everyTestPassedAnyway`, `tally` — into
   `scripts/check-tally.mjs`, **unchanged**, with their doc comments, and
   imports them back. `check.mjs` ends in `process.exit(await main())`, so a
   test that imported it would run the nine-leg gate; a module is the seam, and
   is preferred over an `import.meta.url` entry guard because a guard that fails
   open means a test run invokes the gate it belongs to.
2. Adds `scripts/check-tally.d.mts`, the convention
   `scripts/visual/contrast.d.mts` sets for an `.mjs` consumed from TypeScript.
3. Adds `test/check-gate.test.ts`: the coloured passing tally under an
   `onTaskUpdate` timeout is tolerated, the coloured **failing** tally is not,
   the uncoloured forms behave as before, and `tally()` reads counts out of
   both.

## Constraints

- **No behaviour change.** The regexes and both functions move byte-for-byte,
  the `eslint-disable` for `no-control-regex` with them. If the test passes
  against the moved code and the gate still runs, the move is sound.
- Nothing under `src/` is touched. No version axis moves. No baseline
  re-recorded.
- This does **not** fix `main`'s red, which is `test/visual-backdrop-contrast.test.ts`
  on the `cave` backdrop and the chip floor on `starter` and `locale`. Those are
  separate and are being diagnosed separately.
