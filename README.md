# GYMRUN — Stage 2

A browser-based seeded Pokémon roguelike. This is Stage 2: **a full eight-gym
run against a randomizer — random species, random abilities, random movesets —
balanced against a thousand headless runs rather than against taste.**

Stage 0 proved the battle engine. Stage 1 made it a run. Stage 2 makes it a
*randomizer*, and adds the instrument that says whether the randomizer is
playable.

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

## What Stage 2 adds

- **A randomizer.** 639 species, 397 damaging moves and all 310 abilities.
  Ability is drawn from the **full** pool rather than a species' legal ones —
  your Magikarp can have Levitate and Garnet's Rhydon can have Wonder Guard —
  because the engine runs Custom Game with the team validator switched off.
  Movesets are type-plausible and always carry at least one attack.
- **Eight segments and eight gyms**, each with a type identity every member of
  its team matches, a difficulty curve across them, and a level and stat curve
  per segment.
- **A headless balance simulator.** `npm run sim -- --seeds 1000` plays a
  thousand full runs under two policies in about eighty seconds and reports
  clear rate per gym, cause of death, turns per battle, outlier seeds and
  diversity. It is the reason every number in `src/data/` is a measurement.
- **A run summary** with the seed (copyable), gyms cleared out of eight, the
  final team with its rolled ability and moves, what killed the run, and a
  rematch button on the same seed.

Everything Stage 1 did still holds: the seed is shown, editable and in the URL;
the same seed plus the same decisions gives an identical run on any machine;
HP and PP carry across encounters; the run log is the seed plus the decision
sequence and nothing else, so closing the tab mid-run and reopening it puts you
back where you were.

## Balance

**The centrepiece of Stage 2 is not a game feature. It is the simulator** — you
cannot balance a roguelike by playing it. Fifty runs is an afternoon and three
anecdotes; a thousand runs is forty seconds and a distribution, and a difficulty
curve is a distribution.

At 1000 seeds, the `greedy` policy:

| gym | leader | type | team | clear rate |
|---|---|---|---|---|
| 1 | Garnet | Rock | 1 | 92.4% |
| 2 | Marina | Water | 1 | 90.5% |
| 3 | Volta | Electric | 2 | 81.0% |
| 4 | Fern | Grass | 2 | 80.5% |
| 5 | Cinder | Fire | 2 | 78.1% |
| 6 | Solene | Psychic | 3 | 76.3% |
| 7 | Vesper | Ghost | 3 | 69.7% |
| 8 | Draven | Dragon | 3 | 66.7% |

Run completion **5.2%**, worst gym-to-gym drop 10 points, 635 distinct species
and all 310 abilities across 13,877 encounters. A `random` policy completes
0.1% of runs and clears gym 6 in 1.0% of them, which is the depth test: if a
random policy cleared gym 6, move choice would not matter.

[`docs/balance.md`](docs/balance.md) has the full report and the four findings
that moved the numbers — including the one that read as a level-curve problem
for three tuning passes and was actually the player's move pool being frozen at
segment 1 while the opponents' scaled.

```sh
npm run sim                              # 200 seeds, both policies
npm run sim -- --seeds 1000              # the report above
npm run sim -- --nodes all               # compare node-choice playstyles
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
  battle/      format, driver (the only @pkmn/sim adapter), policy, switching, ai
src/data/      what a Pokémon is rolled *from*, and every balance number
  scaling.ts     the curve: eight rows, and what party the curve assumes
  partyTuning.ts PARTY_SIZE, join level, and what a faint costs
  gyms.ts        eight leaders and their type identities
  starters.ts    what the player begins with; Stage 5's unlock seam
  blacklists.ts  the exceptions, each with the evidence that earned it
  speciesPools.ts, movePools.ts, abilities.ts   generated; npm run gen:pools
src/ui/        a thin DOM layer: ten screens and a router
scripts/sim.ts the balance simulator
test/          determinism, generation, the randomizer's seven promises, replay
docs/          architecture, generation rules, balance, engine notes
```

Read [`docs/architecture.md`](docs/architecture.md) before adding to this,
[`docs/generation.md`](docs/generation.md) before touching generation — the
order of the generation passes is a compatibility contract, not an
implementation detail — and [`docs/balance.md`](docs/balance.md) before moving
a number.

## The three seams that matter

**`Policy`** is `(view) => Promise<Choice>`: the human, the AI and a scripted
bot are the same shape.

**`RunPolicy`** is the same idea one level up — a starter pick, a node pick and
a battle policy. `src/ui/app.ts` is a `RunPolicy` whose promises resolve on
clicks. `scripts/sim.ts` builds two of them. A recorded log replayed back is
one. `playRun` takes one and cannot tell which it has, so there is no separate
interactive run loop to keep in sync with the headless one.

That is what makes `npm run sim` a loop around the same function players use,
rather than a second implementation that drifts.

**The logic/data split.** `core/randomizer.ts` is *how* a Pokémon is rolled;
`data/` is *what it is rolled from*. If a balance pass ever needs to edit the
first, the split has failed — that is the bug to fix before touching the
numbers.

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
2. **`random` clears gym 3 in a quarter of runs**, against a target of "rarely".
   Tightening the early gyms would push `greedy`'s completion below the 5%
   floor, so the trade was declined; the depth test that matters passes at 1.0%.
3. **The blacklist is nearly empty**, which is correct after one tuning pass and
   not permanent. Nothing in the report dominated an outcome distribution.
4. **Nuzlocke interpretation.** The build spec's section 3 is read here as *no*
   nuzlocke ruleset: no per-Pokémon permadeath, no forced first-encounter rule.
   Wipe — every party member fainted — is the only death rule.
5. **Switching does not pay yet, and that is Stage 4's unmet done-condition.**
   `switch-aware` completes 10.0% of runs against `no-switch`'s 11.2% — a gap in
   the wrong direction, inside noise. It is not a tuning oversight: the first
   scoring model made it *worse* in all twelve weight combinations tried, and
   replacing the one-turn horizon with a multi-turn matchup race only brought it
   back to parity. `docs/balance.md` §7.6 has the data and the three untried
   levers, the strongest being that the opponent outnumbers the player at every
   gym, so switching to answer a matchup loses to a side with more answers.
6. **Party size stays at 3.** 43% of losses happen with a full, standing party —
   those runs were beaten by a single wall, not by running out of Pokémon, and a
   fourth slot would not have saved one of them. That is the spec's own
   condition for testing 4, and it says do not, yet. `docs/balance.md` §7.7.
