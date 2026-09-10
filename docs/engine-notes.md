# Engine notes

Standing facts about the Pokemon Showdown engine as GYMRUN drives it. Things
that were established by experiment, are unlikely to change, and would
otherwise have to be rediscovered.

Each entry says how it was established. A claim about an engine is worth what
the evidence behind it is worth, and "we think so" is worth nothing.

---

## Custom Game runs no validator, and `isNonstandard` is not a gate

Established 2026-09-09, by running it.

`@pkmn/sim` marks a move `isNonstandard` when the current generation cannot
obtain it — gen 9 marks Cut `Unobtainable` and Flash `Past`, because Scarlet
and Violet removed them. **That is a legality verdict, and the battle engine
does not consult it.** A team built with either move resolves normally.

Gastly, which learns neither move in any generation, against Snorlax:

```
|move|p1a: Gastly|Cut|p2a: Snorlax
|-damage|p2a: Snorlax|221/235

|move|p1a: Gastly|Flash|p2a: Snorlax
|-unboost|p2a: Snorlax|accuracy|1
```

No `|-fail|`, no `|-immune|`, no `cant`. Cut deals damage, Flash lands its
accuracy drop. Both were also run under `GYMRUN_TRIM_STRICT=1`, which replaces
the stripped learnset and legality tables with proxies that throw on any read —
so nothing consulted a learnset to decide whether a Gastly may swing a blade.
The tables are not merely empty-tolerant; they are never touched.

This is the same claim `build-config/trim-sim-data.ts` rests on, verified from
the other direction. The trim drops ~450 kB gzipped on the grounds that those
tables exist for `TeamValidator` and GYMRUN never validates a team.
`test/trimmed-data.test.ts` holds the trim to it for the moves that acquire
another move at runtime — Metronome, Mimic, Sketch, Transform, Copycat, Assist.

**Why this is prose and not a test.** It was a test, briefly:
`test/nonstandard-moves.test.ts` asserted both protocol lines while Cut and
Flash were admitted to the move pools ahead of Stage 4.6c. Capabilities became
relics, no move proves a capability any more, and the two moves went back out of
the pools — so the test's subject no longer exists in the game and a test that
generates its own team to prove a property of a move nothing rolls is testing
the sim rather than GYMRUN.

The finding is durable even though the feature was not. If a later stage wants
a move the current generation calls nonstandard, this is the note that says the
engine will run it, and the exclusion in `scripts/gen-pools.ts` is a curation
choice rather than a constraint.

## The engine assigns gender by coin flip, ignoring `genderRatio`

Established during Stage 4.5.1, by measurement. Recorded here because it is the
exact shape of bug the version guards exist for, and because the prompt that
found it asked for the opposite of what the measurement showed.

Showdown assigns a gender that a team does not name with
`battle.sample(['M', 'F'])`, a **flat coin flip that ignores the species'
`genderRatio`**, taken from the battle PRNG at team construction. Three
consequences, all measured rather than assumed:

- Combee, 87.5% male in its own data, came out 206/194 over 400 seeds.
- The same party member was male in one fight and female in the next, and
  nothing outside a battle had a gender at all, so a party screen had nothing
  to show.
- Every gendered body on both sides cost one battle draw before turn one.

GYMRUN now rolls gender itself, from the ratio in `SpeciesEntry.maleChance`, and
hands the sim a concrete value. That short-circuits the sample the engine was
already making, so it is a **relocated draw rather than a new one**: the run
makes one fewer battle draw per Pokemon and one more randomizer draw. Two
version axes moved as a result, `RANDOMIZER_VERSION` because specs changed and
`ENGINE_VERSION` because every battle stream is offset from the first turn.

## Charge moves are excluded by scoring, not by the engine

`scripts/gen-pools.ts` drops moves with `flags.charge` — Fly, Dive, Solar Beam
and the rest. The engine runs them; the exclusion is that `@smogon/calc` scores
one turn of a two-turn move, so a policy that picks them looks twice as strong
as it plays. Fly and Dive are otherwise standard gen 9 moves and would need no
other change to admit. Whether to admit them belongs to the AI pass, alongside
priority-blindness and speed-blindness, because it is a scoring question.
