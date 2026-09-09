# GYMRUN — Stage 4.5

A browser-based seeded Pokémon roguelike. This is Stage 4.5: **an eight-gym
randomizer run with a party, held items, shops and events — and a battle screen
that finally shows you the mechanics it has been resolving all along.**

Stage 0 proved the battle engine. Stage 1 made it a run. Stage 2 made it a
*randomizer* and built the instrument that says whether the randomizer is
playable. Stage 3 added tiers, rewards, items, shops and events. Stage 4 added
party slots and switching. Stage 4.5 adds no mechanics at all — it makes the
existing ones legible.

There is still no battle engine here. GYMRUN wraps [Pokémon
Showdown](https://pokemonshowdown.com) via `@pkmn/sim` — see
[`docs/engine-notes.md`](docs/engine-notes.md) for the measurements that
retired that risk.

## Quick start

```sh
npm install
npm run dev      # play it
npm run check    # lint + typecheck + tests, including the strict trim run
npm run build    # static bundle in dist/, deploys to any static host
```

After a build:

```sh
npm run smoke    # play a whole run in a real Chromium, fail on any error
npm run sim      # play N runs headless and report the balance
npm run measure  # per-dependency gzipped bundle sizes
```

## What Stage 4.5 adds

Nothing you can play. **No mechanics, no state, no randomness, and no balance
change** — the 1000-seed report is byte identical across the stage, which is
the stage's headline result rather than a footnote to it.

What it adds is sight. The physical/special split has been resolving correctly
since Stage 0, Choice Band has been finding Attack and Choice Specs Special
Attack since Stage 3, and none of it was on screen — so the decisions those
mechanics create were invisible and the game read as a coin flip with sprites.

- **A six-stat panel for both actives**, in Showdown order. The opponent's
  numbers are *exact*, not estimated: the protocol never sends them, but GYMRUN
  has no EVs, IVs or natures, so one fixed spread makes the formula in
  `core/battle/stats.ts` an answer rather than a guess.
- **Stat stages as base / stage / effective** — `Atk 152 +1 228` — and nothing
  but the bare number when a stage is zero, so the panel is quiet until
  something changes.
- **A speed readout.** Which side moves first, marked on the faster Speed row.
  Three states and no fourth: no percentage, no probability, and a tie reported
  as a tie because the sim rolls it. This is the highest-value single number on
  the screen and the reason the stat panel is worth building.
- **Move category badges** and **live type effectiveness** computed against
  whatever is actually standing there, printed only when it is not neutral.
- **A tap-first tooltip layer** over types, statuses, volatiles, abilities,
  items and move categories, plus a **type reference wheel** reachable from any
  type badge — generated from the dex chart in both directions.

Ability randomization is what makes the last two load-bearing. Abilities come
off the **full** pool rather than a species' legal set, so Levitate on a Rhydon
is routine, and a UI that showed `2x` on that Earthquake would train the player
to distrust every number it prints. The rule is that ability effects are folded
into the badge only when the ability is *visible*; otherwise the naive chart
result is shown, which is exactly what a player reasoning from types alone would
conclude.

`tuning.revealOpponentAbility` and `revealOpponentItem` both default to **true**.
With abilities drawn off-species there is no legal set to narrow and no meta
knowledge to infer from, so hiding one does not create a deduction — it converts
a skill decision into a coin flip. Same reasoning Stage 1 used to clear status
between encounters. Both are flags so the opposite can be playtested cheaply.

Everything earlier still holds: the seed is shown, editable and in the URL; the
same seed plus the same decisions gives an identical run on any machine; HP and
PP carry across encounters; the run log is the seed plus the decision sequence
and nothing else, so closing the tab mid-run and reopening it puts you back
where you were.

## Balance

**The centrepiece is not a game feature. It is the simulator** — you cannot
balance a roguelike by playing it. Fifty runs is an afternoon and three
anecdotes; a thousand runs is forty seconds and a distribution, and a difficulty
curve is a distribution.

At 1000 seeds, the `greedy` policy:

| gym | leader | type | team | reached | clear rate | drop |
|---|---|---|---|---|---|---|
| 1 | Garnet | Rock | 1 | 969 | 95.0% | — |
| 2 | Marina | Water | 2 | 836 | 83.1% | -12pt |
| 3 | Volta | Electric | 3 | 658 | 75.8% | -7pt |
| 4 | Fern | Grass | 4 | 483 | 84.9% | +9pt |
| 5 | Cinder | Fire | 4 | 387 | 73.6% | -11pt |
| 6 | Solene | Psychic | 5 | 271 | 72.0% | -2pt |
| 7 | Vesper | Ghost | 5 | 189 | 74.1% | +2pt |
| 8 | Draven | Dragon | 5 | 134 | 72.4% | -2pt |

Run completion **9.7%**, mean 3.24 gyms of 8, worst gym-to-gym drop 12 points.
A `random` policy completes 0.1% of runs and clears gym 6 in 0.7% of them, which
is the depth test: if a random policy cleared gym 6, move choice would not
matter.

The randomizer draws from 635 species, 397 damaging moves and all 310
abilities, and across 24,673 encounters the sweep saw **every one of them** —
635 distinct species and 310 distinct abilities. That is the diversity claim
worth making, because win rate cannot measure it at all: a narrow pool that
happened to be balanced would pass every other number in the report.

Note the clear rates are per *arrival*, not per run — 72.4% of the 134 runs that
reached Draven beat him. The population thins faster than the gyms get harder,
which is what the `reached` column is there to show.

[`docs/balance.md`](docs/balance.md) has the full report and the findings that
moved the numbers — including §7.2, where the largest error in a tuning pass
turned out to be a premise rather than a number, and §8, the Stage 4.5
non-result and how it was checked.

```sh
npm run sim                              # 200 seeds, both policies
npm run sim -- --seeds 1000              # the report above
npm run sim -- --nodes all               # compare node-choice playstyles
npm run sim -- --policy switching        # Stage 4's headline pair
npm run sim -- --set stepsPerSegment.min=6
npm run sim -- --help
```

## Layout

```
src/core/      pure, deterministic, zero DOM, unit tested
  rng.ts       seeded streams: map, rewards, battle, randomizer, policy
  types.ts     the vocabulary every layer shares
  randomizer.ts  how a Pokémon is rolled; pure, explicit Rng, no globals
  party.ts     what persists between nodes, and the rules that change it
  encounters.ts  map and encounter generation, all of it eager
  run.ts       the run state machine, RunPolicy, and playRun
  acquisition.ts how a Pokemon joins the party, and what it costs
  economy.ts, rewards.ts, items.ts, events.ts   Stage 3's four systems
  battle/
    format.ts    generation, format id, clauses; the gen-lock lives here
    driver.ts    THE ONLY @pkmn/sim adapter
    stats.ts     the stat formula, pure, checked against the engine
    view.ts      BattleUiView — what the battle screen renders, derived
    policy.ts, switching.ts, ai.ts
src/data/      what a Pokémon is rolled *from*, and every balance number
  scaling.ts     the curve: eight rows, and what party the curve assumes
  partyTuning.ts PARTY_SIZE, join level, and what a faint costs
  gyms.ts        eight leaders and their type identities
  starters.ts    what the player begins with; Stage 5's unlock seam
  blacklists.ts  the exceptions, each with the evidence that earned it
  statusInfo.ts  what every condition does, and what to do about it
  abilityEffects.ts, abilityOverrides.ts, categoryInfo.ts   tooltip data
  speciesPools.ts, movePools.ts, abilities.ts   generated; npm run gen:pools
src/ui/        a thin DOM layer: ten screens and a router
  scene.ts     the battlefield; reads BattleUiView and nothing else
  tooltips.ts  one delegated tap-first layer; all content from data/
scripts/sim.ts the balance simulator
test/          determinism, generation, the randomizer's promises, replay,
               boundaries, stats, the projection, tooltip coverage
docs/          architecture, generation rules, balance, engine notes
```

Read [`docs/architecture.md`](docs/architecture.md) before adding to this,
[`docs/generation.md`](docs/generation.md) before touching generation — the
order of the generation passes is a compatibility contract, not an
implementation detail — and [`docs/balance.md`](docs/balance.md) before moving
a number.

## The four seams that matter

**`Policy`** is `(view) => Promise<Choice>`: the human, the AI and a scripted
bot are the same shape.

**`RunPolicy`** is the same idea one level up — a starter pick, a node pick and
a battle policy. `src/ui/app.ts` is a `RunPolicy` whose promises resolve on
clicks. `scripts/sim.ts` builds two of them. A recorded log replayed back is
one. `playRun` takes one and cannot tell which it has, so there is no separate
interactive run loop to keep in sync with the headless one.

That is what makes `npm run sim` a loop around the same function players use,
rather than a second implementation that drifts.

**`BattleUiView`** is what the battle screen renders from, and it is deliberately
*not* the `BattleView` a policy decides from. That one is restricted to what a
player could know, with `foe.ability` always null, because a bot with hidden
information would make the balance sweep measure the wrong thing. The screen is
allowed to know more — `data/tuning.ts` decides what it then shows.

Keeping them apart is why Stage 4.5 moved no balance number. The shortcut was to
widen the policy view; it would have handed the greedy AI an ability no player
has seen and shifted every number in the table above for a reason that had
nothing to do with balance.

**The logic/data split.** `core/randomizer.ts` is *how* a Pokémon is rolled;
`data/` is *what it is rolled from*. If a balance pass ever needs to edit the
first, the split has failed — that is the bug to fix before touching the
numbers.

## The architecture rules

All five are enforced by [`test/boundaries.test.ts`](test/boundaries.test.ts).
Rules 1, 2 and 4 are enforced by ESLint as well — two mechanisms, because lint
is easy to disable inline and easy to skip in CI, and those three are the ones
a single stray import or call can break:

1. `core/` never imports from `ui/`.
2. The platform's unseeded RNG is banned anywhere under `src/`.
3. `core/` is DOM-free and runs headless under Node.
4. Only `core/battle/driver.ts` and `core/battle/format.ts` import `@pkmn/sim`.
5. The battle UI reads `BattleUiView` and nothing else — no `core/run` import,
   no `RunState`, no `PokemonSpec`.

Rules 3 and 5 are test-only, and for the same reason: both are about what a
*file* may name rather than about a package or a call, and the ESLint form of
either would be a per-file override list that the next file quietly joins.

The fifth arrived with Stage 4.5, because putting the opponent's ability on
screen made reaching into the run for it the obvious shortcut — and that
shortcut would have passed every other test in the suite, since nothing else
asserts on where a screen got a number from.

## Determinism, and the thing that silently breaks it

A `RunLog` carries a seed, an engine version, and a **randomizer version**. The
third one is separate because a tuning pass leaves a decision sequence perfectly
replayable and quietly reinterprets it as a different run — the worst available
outcome for a game whose whole promise is that a shared seed is a shared run.
A mismatch throws, with a message that names both versions.

Bump `RANDOMIZER_VERSION` in `src/core/randomizer.ts` for a regenerated pool, a
moved band window, a changed curve, or a new draw inside the randomizer.

Randomizer draws come from their own RNG stream, so adding a draw in one system
cannot shift another's. `test/randomizer.test.ts` asserts that directly rather
than trusting it to the construction.

## Bundle

`@pkmn/sim` is most of it, and that is the shape of this project: we ship a
Pokémon engine, and the engine is mostly data.

| | JS gzipped | CSS gzipped |
|---|---|---|
| Stage 4 | 731.62 kB | 4.74 kB |
| Stage 4.5 | 744.19 kB | 5.36 kB |

Ability descriptions turned out to cost **nothing**. `@pkmn/sim`'s `Dex`
statically imports its text tables and `build-config/trim-sim-data.ts` only
trims learnsets, legality and pokemongo — so every `shortDesc` in the generation
was already in the Stage 4 bundle before the tooltip layer read one.
[`docs/engine-notes.md`](docs/engine-notes.md) §4 has the method and the
`@pkmn/client` decision.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then static bundle to `dist/` |
| `npm test` | Vitest, headless |
| `npm run test:trim-strict` | Tests with the bundle trim's stubs set to throw on any access |
| `npm run check` | Lint, typecheck, both test runs |
| `npm run sim` | Play N runs headless and report the balance |
| `npm run gen:pools` | Regenerate the species, move and ability tables from the dex |
| `npm run smoke` | Browser smoke test against `dist/` (build first) |
| `npm run measure` | Gzipped bundle size per dependency (build first) |
| `GYMRUN_FULL_DEX=1 npm run build` | Build without the bundle trim |

## Open questions for later

1. **Fights are short early.** Late fights have a shape; early ones are an
   exchange. One of the two causes is gone — there is a party and a switch to
   make from Stage 4 — and the other, no EV or IV spreads, is still structural.
   Note that it is no longer *only* a gap: one fixed spread is what lets
   `core/battle/stats.ts` compute the opponent's stats exactly rather than
   estimate them, so the exclusion is now load-bearing for a feature.
2. **`random` clears gym 3 in 16.8% of runs**, against a target of "rarely".
   Tightening the early gyms would push `greedy`'s completion out of its band,
   so the trade was declined; the depth test that matters passes at 0.7%.
3. **Gym 1 clears at 95.0%** against a 90% target — the one MISS on the greedy
   run. A first gym that almost never stops anyone is a tutorial, which may be
   the right thing for it to be; it has not been argued either way yet.
4. **The blacklist is nearly empty**, which is correct after one tuning pass and
   not permanent. Nothing in the report dominated an outcome distribution.
5. **Nuzlocke interpretation.** The build spec's section 3 is read here as *no*
   nuzlocke ruleset: no per-Pokémon permadeath, no forced first-encounter rule.
   Wipe — every party member fainted — is the only death rule.
6. **Switching does not pay yet, and that is Stage 4's unmet done-condition.**
   `switch-aware` completes 9.7% of runs against `no-switch`'s 10.6% — a gap in
   the wrong direction, inside noise. It is not a tuning oversight: the first
   scoring model made it *worse* in all twelve weight combinations tried, and
   replacing the one-turn horizon with a multi-turn matchup race only brought it
   back to parity. `docs/balance.md` §7.6 has the data and the three untried
   levers, the strongest being that the opponent outnumbers the player at every
   gym, so switching to answer a matchup loses to a side with more answers.

   Stage 4.5 is a quiet lever on this one. The bot's difficulty was never the
   whole story — a *human* could not see the speed order or a move's category
   either, and both are inputs to "should I switch". Whether that moves player
   switch rates is a playtest question, not a simulator one.
7. **Party size stays at 3.** 43% of losses happen with a full, standing party —
   those runs were beaten by a single wall, not by running out of Pokémon, and a
   fourth slot would not have saved one of them. That is the spec's own
   condition for testing 4, and it says do not, yet. `docs/balance.md` §7.7.
8. **`data/abilityOverrides.ts` is empty on purpose.** The dex's own one-line
   descriptions are the tooltip text for all 310 abilities, and they are usually
   good. Where they fail they fail for one reason — written for someone who
   already knows the vocabulary — and guessing which ones is how you rewrite
   forty and miss the ones that actually confused someone. It grows from
   playtest.
