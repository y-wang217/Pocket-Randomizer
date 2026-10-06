# GYMRUN Stage 6.0, checkpoint 9: the bundle seam

Filed before any work, under [`README.md`](README.md) rule 1. Closes the
open item [`../README.md`](../README.md) section 5 has carried since
checkpoint 5: the library costs about 180 kB gzipped on the wire, above the
~150 kB line [`../generation.md`](../generation.md) section 107 set, and the
compact encoding (section 108) did not move it.

---

## PROMPT, verbatim

> checkpoint 9 next. bundle seam

---

## The ruling this builds (from checkpoint 6's rulings, not part of the prompt)

Ruling 6 of [`gymrun-stage6.0-checkpoint6-challengers.md`](gymrun-stage6.0-checkpoint6-challengers.md),
taken 2026-10-05: a host-filled registry for the Gen 1 to 4 route trainers,
with `core/` throwing loudly on an unfilled one, is acceptable against the
no-side-effects rule. The host installs, `core/` never fetches, and a run
generated before the install throws before any draw, so no seed can be
silently reinterpreted.

## What the tree says at filing (not part of the prompt)

- 4,839 of the library's 5,921 records are Gen 1 to 4 route trainers, which
  only route nodes draw; they are 1.31 MB of the directory's 1.51 MB of
  source. Every challenger, villain and leader stays in the main chunk.
- `src/data/encounters/index.ts` decodes and sorts the whole library at
  module load; `library.ts` reads it only inside `encounterCandidates`, at
  call time. The app's first run is generated inside the async `start()`
  in `src/ui/app.ts`, never at module load, so there is a place to await.
- No draw moves: the same records reach the candidate windows in the same
  id order. `RANDOMIZER_VERSION` holds; `contentHash` moves for the split
  files, which stay hashed by `build-config/content-hash.ts`'s default rule.
