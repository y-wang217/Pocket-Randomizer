# GYMRUN patch: CI workflow, and a check runner that does not short-circuit

Filed 2026-09-17 on `claude/brave-hopper-th7one`, before any work, under
protocol 1 and 7 of [`README.md`](README.md).

## The brief, verbatim

> okay ci workflow development Add CI to this repo. Two parts, stop for review between them.
>
> 1. Replace the `&&` chain in `npm run check` with `scripts/check.mjs` that runs every leg, never short-circuits, prints a per-leg PASS/FAIL/SKIPPED table, exits 1 if any leg failed, and promotes SKIPPED to FAILED when `process.env.CI` is set. A missing browser binary is SKIPPED locally, FAILED in CI. Report which legs currently exist in `check` before you split them.
> 2. Add `.github/workflows/check.yml` per the structure above. Before writing it, report: which vitest tests are browser-dependent vs Node-only, which tests assert pinned pixel heights or read `docs/visual/baseline/`, and the exact Playwright version in the lockfile.
>
> Do not re-record any baseline. Do not change `src/`. No version axis moves.

## One referent does not resolve

Recorded rather than guessed at, and recorded here rather than by editing the
brief, because protocol 4 forbids the edit and because a guess at a workflow
shape is exactly the kind of reconstruction `README.md` warns about.

**Part 2 says "per the structure above" and there is no structure above.** The
brief arrived as a single message and its first line is "okay ci workflow
development"; nothing in it, and nothing in this directory, describes a job
layout, a matrix, a runner image, a trigger set or a caching strategy for
`check.yml`. The phrase points at something that was in the author's context
and not in the message.

So part 2 does not begin from an assumption about what it named. The part 1
report asked the author for the structure, and their answer is the next
section, verbatim, the way the idle-sprites and map-drawer prompts record the
answers their own open questions needed.

## The three answers, verbatim

Asked before any code, alongside the part 1 report. Two design questions the
brief left open, and the missing structure.

**Q1 — legs 3 and 5 each run all 135 test files, so a missing Chromium would
skip the 111 Node-only tests along with the 24 browser ones. How should
`check.mjs` treat them?**

> Split each into node + browser (Recommended)

**Q2 — `CLAUDE.md` lists build and smoke run as absolute gates, but
`npm run check` does not include them. Add them as legs?**

> Add both build and smoke (Recommended)

**Q3 — what structure should `.github/workflows/check.yml` have? Part 2's
"structure above" was not in the message.**

> here's the yaml you're looking for name: check
> ```yaml
> on: [push, pull_request]
> concurrency:
>   group: ${{ github.ref }}
>   cancel-in-progress: true
>
> jobs:
>   static:
>     runs-on: ubuntu-latest
>     steps: [checkout, setup-node w/ cache: npm, npm ci, npm run lint, npm run types]
>
>   unit:
>     runs-on: ubuntu-latest
>     steps: [..., npm run test:unit]     # non-browser vitest, 1798 tests
>
>   browser:
>     runs-on: ubuntu-latest
>     container: mcr.microsoft.com/playwright:v1.XX.X-noble
>     strategy:
>       fail-fast: false
>       matrix:
>         engine: [chromium, webkit]
>     steps: [..., npx playwright test --project=${{ matrix.engine }}]
>
>   strict-trim:
>     runs-on: ubuntu-latest
>     steps: [..., GYMRUN_TRIM_STRICT=1 npm run test:trim]
> ```

That answer is a skeleton with four names in it that this repo does not have —
`npm run types`, `npm run test:unit`, `npm run test:trim`, and
`npx playwright test --project=`, which is the Playwright Test runner and not
the vitest suite the browser tests are actually written in. The part 2 report
is where each one is reconciled against the tree; they are **not** silently
substituted here, because the skeleton is the record of what was asked.

## Scope, from the brief's own last line

- No baseline is re-recorded. `docs/visual/baseline/` is untouched, which
  includes `heights.json`.
- `src/` is not changed. The patch is `scripts/`, `package.json`, `.github/`
  and `docs/`.
- No version axis moves: not `contentHash` (nothing under `src/data/`),
  not `RUN_LOG_VERSION`, not `RANDOMIZER_VERSION`, not `AI_VERSION`.
