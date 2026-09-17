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
report asks the author for the structure, and whatever they answer is appended
below this line verbatim, the way the idle-sprites and map-drawer prompts
record the answers their own open questions needed.

## Scope, from the brief's own last line

- No baseline is re-recorded. `docs/visual/baseline/` is untouched, which
  includes `heights.json`.
- `src/` is not changed. The patch is `scripts/`, `package.json`, `.github/`
  and `docs/`.
- No version axis moves: not `contentHash` (nothing under `src/data/`),
  not `RUN_LOG_VERSION`, not `RANDOMIZER_VERSION`, not `AI_VERSION`.
