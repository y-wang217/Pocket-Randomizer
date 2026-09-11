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

## An omitted ability is the species default, not an unknown one

**`@smogon/calc`, found 2026-09-11 during the AI tiers patch.** The constructor
resolves its ability as `options.ability || species.abilities[0]`. Omitting the
field therefore does not mean "this Pokemon has no ability" and does not mean
"I do not know" — it means **the species' first ability**, silently.

In a game that ships species as they are, that is a reasonable default and
nobody notices. Under full ability randomization it is a false fact in the one
place the AI is least able to survive one:

```
new Pokemon(gen, 'Rotom', { level: 50 })            // ability: Levitate
calculate(gen, garchomp, that, earthquake).range()  // [0, 0]
new Pokemon(gen, 'Rotom', { level: 50, ability: '(unknown)' })
calculate(gen, garchomp, that, earthquake).range()  // [176, 210]
```

The opponent AI reasons about a foe whose ability is *not public information*,
so it had been passing nothing and being handed the species default for every
foe in every fight since Stage 0. Pass a sentinel string no real ability
matches, and every `hasAbility` check inside the calc answers false, which is
the "no ability effects" the estimate was always claiming to make. **It must be
non-empty**: the calc treats `''` as falsy, falls back to the species default
again, and separately uses `''` internally to mean *suppressed*.

## The reference matchup heuristics read species types, and a randomizer breaks that

**Recorded during the AI tiers patch, next to the finding above, because it is
the same class of mistake and it will be rediscovered by the next person
porting a bot from the literature.**

Every published Pokemon heuristic — `SimpleHeuristicsPlayer` in poke-env, the
score-stacking families in the Gen 3 lineage — estimates a matchup from the two
species' **types**, and assumes a Pokemon's STAB moves are the ones it will
attack with. That holds in a normal game, where a Fire type carries Fire moves.

**It is fiction here.** A Gyarados in GYMRUN may hold four Grass moves and no
Water one. This project has now paid for that assumption three times: the
playtest round 2 effectiveness hint read species typing where it meant per-move
typing, the 4.7 archetype labels derive from base stats and "lie sometimes under
full move randomization", and the AI tiers brief proposed porting the reference
matchup estimate verbatim.

The rule, implemented in `core/battle/matchup.ts` and asserted in
`test/ai-tiers.test.ts`:

- **Offence is read from the four slotted moves.** What a Pokemon can do to you
  is what it is actually carrying.
- **Defence is read from species types.** What it resists is a fact about what
  it is, and the randomizer does not touch it.

A Water type carrying only Grass moves therefore scores its offence at Grass
into Fire (0.5x) and its defence at Fire into Water (0.5x). The reference's
reading of the same board is 0.5 − 2 = −1.5, and it is wrong by the whole
difference.

## Charge moves are excluded by scoring, not by the engine

`scripts/gen-pools.ts` drops moves with `flags.charge` — Fly, Dive, Solar Beam
and the rest. The engine runs them; the exclusion is that `@smogon/calc` scores
one turn of a two-turn move, so a policy that picks them looks twice as strong
as it plays. Fly and Dive are otherwise standard gen 9 moves and would need no
other change to admit. Whether to admit them belongs to the AI pass, alongside
priority-blindness and speed-blindness, because it is a scoring question.
