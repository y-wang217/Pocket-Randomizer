# Patch: the browser suite and the engine CI runs it on

Filed 2026-09-21 on `claude/epic-knuth-7w4g6f`, before any work on it, per
[`README.md`](README.md) rule 7. It follows the 4.10 Tiers 0 and 1 handoff,
[`../handoff/4.10-tiers-0-1.md`](../handoff/4.10-tiers-0-1.md), which named the
load-sensitive browser walk as "one item that does not exist yet and probably
should". This is that item, widened by what the CI logs actually said.

---

## The prompt, verbatim

> okay these tests have been ruining the CI. what's the path to resolving those
> browser suite tests?

Answered with an assessment before any code. Its finding was that the red on
`main` is not mainly the walker: every `check` run since 2026-09-18 fails the
same chip-contrast assertion, Ghost at 3.81:1 on battle against a floor of 4.5,
identically in both chromium legs, and that file passes on the pinned local
Chromium 141 while CI runs Chromium 153 from the Playwright 1.63 image. The
walker miss (`visual-move-cards` never reaching `result`) appeared once, in
strict trim only. The path proposed was five steps: one engine everywhere; fix
the sampler, not the colour, unless the fill really samples under the floor;
make the walk state-based; cap browser workers in CI as the node half already
is; file this as a patch prompt first.

The instruction:

> okay let's tackle steps 1-4 which don't affect codebase, and only change the
> CI tests

---

## Scope as read

Steps 1 to 4. Nothing under `src/` changes unless step 2 finds the Ghost fill
genuinely under the floor on the chosen engine, in which case that is reported
here and not built. No version axis moves. `contentHash` holds.
