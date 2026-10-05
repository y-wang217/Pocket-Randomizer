# GYMRUN Stage 6.0: the encounter library

Filed before any work, under [`README.md`](README.md) rule 1.

---

## PROMPT, verbatim

> for the gymrun defender, we should generate teams that are coherent and not just rely on seed gen on run time.
>
> for example, find a list of the possible sprites in the smogon cdn, and find trainer data of possible mon teams and and their levels. would be fun to actually cite which trainer is from which game.
>
> start by doing the research for what is a nice long list (should be able to do 500+) encounters in any of the games, and we can show references to encounters in each game.
>
> Then, create a queryable encoding of the library of encounters to easily map to seeds.
> we're going to have as many content strings of encounters that feel nostalgic as possible.

---

## Rulings taken at filing (not part of the prompt)

Four questions were put to the author before any work and answered on
2026-10-05. They are recorded here because each one changes what is built.

1. **Gyms draw canonical leaders of the gym's type, per seed.** The type stays
   the gym's identity (`data/gyms.ts`, "the type is the gym"). The leader, the
   sprite variant, the team shape and the game citation come from the library.
   The eight fictional leaders and their blurbs retire.
2. **Headless first.** This stage builds the library, the encoding, the seed
   mapping and the tests. The player-facing half (an opponent name on the
   battle header, a trainer sprite, a citation line) touches ruling D61 and
   rules the bible does not yet have, so the stage files the amendment and
   stops. The UI lands in a follow-up after the author rules.
3. **Fit, don't force.** A drawn encounter is level-shifted by one constant so
   its ace lands in the segment's window, keeping the canonical spread.
   Oversized parties are trimmed from the front, keeping the ace. Balance stays
   on the current curve.
4. **Sources.** Gen 1 to 4 are imported programmatically from the pret
   decompilations. Gen 5 to 9 gym leaders, Elite Four, champions, rivals and
   villain bosses are hand-curated with Bulbapedia citations.

## What the tree says at filing (not part of the prompt)

- Opponent teams are rolled species-by-species in `src/core/randomizer.ts`
  (`generateTrainerTeam`, `generateGymTeam`) from the banded pool, one keyed
  sub-stream per node (`nodeKey`). Trainers carry no name, class or sprite.
  Gym identity is the eight rows of `src/data/gyms.ts`.
- `RANDOMIZER_VERSION` is `gymrun-randomizer-25`, `RUN_LOG_VERSION` is
  `gymrun-run-23`, `contentHash` is `1ba856`.
- The prompt says "start by doing the research", so the first checkpoint is a
  report and not code. That report is
  [`../research/encounter-sources.md`](../research/encounter-sources.md).
