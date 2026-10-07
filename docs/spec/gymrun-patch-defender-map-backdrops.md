# Patch: a defender rank stands on a painted map

2026-10-06, on `claude/eager-galileo-8vqf47`, from `main` at `22fb781`. Filed
**before any change to `src/`**, verbatim, as [`README.md`](README.md) rule 7
asks. Three asks in one message; the first two are questions and were answered
as an assessment in the session, and only the third is built here.

---

## The message, verbatim

> for pocket randomizer, what's the smallest lift on adding a looping music and some more animations in battle? for example, pokemon swaps happen invisibly especially if the swap happens and i attack it, making it fiant in 1 move.
>
> Also, the moves don't follow speed. i want to see the effects of each individual move.
>
> then, the defender maps are empty. fix that

## The session's reading

Reproduced in the built bundle with `scripts/smoke-defender.mjs` on
`DEF-SMOKE-1`. The map is not blank: the doors, the intermission, the boss, the
edges and the trainer all draw. What is missing is everything a locale brings.
A defender rank is a `Segment` whose one route carries `locale: null`
(`core/defender/waves.ts`, `generation.md` 106.5), so `localeOf(state)` is null
for the whole run and:

- the map graph asks the manifest for no backdrop and shows the flat
  placeholder tint at its own size (D60's fallback);
- the heading's region line is hidden;
- `data-locale` is never written, so the World behind the frame and the battle
  backdrop behind every door fight stay at their placeholders too.

The attacker's map is a painting with a route on it. The defender's is a grey
box with the same route. That is what "empty" is.

The fix: each rank is set in a locale, from a fixed table in `data/defender.ts`
(`DEFENDER_RANK_LOCALES`, one per rank, every region once), written onto the
rank's route by `generateRank`. Nothing is drawn: a rank's region is a lookup,
not a draw, so `RANDOMIZER_VERSION` holds, and `contentHash` moves because a
data table moved. No decision is added, so `RUN_LOG_VERSION` holds. Door nodes
keep `locale: null`: a locale on a node is what an event or a wild draw reads,
and a defender rank has neither.

On the heading, a defender run shows the region's name and not its four type
chips. The chips say what a region's wild nodes hold, and a door's challengers
come from its trainer class, not the region; a chip row there would be a claim
about the fight that the fight does not honour.

The first two asks are recorded in the session's reply and carried as open
items in [`../README.md`](../README.md) section 5. They are not built here.
