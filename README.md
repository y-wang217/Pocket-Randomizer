# GYMRUN — Stage 4.7

A browser-based seeded Pokémon roguelike. This is Stage 4.7: **an eight-gym
randomizer run you can actually read** — the party visible on every screen that
asks you something, the moves saying what they do, and both Pokémon on the field
carrying a label for what their stat block is built for.

Stage 0 proved the battle engine. Stage 1 made it a run. Stage 2 made it a
*randomizer* and built the instrument that says whether the randomizer is
playable. Stage 3 added tiers, rewards, items, shops and events. Stage 4 added
party slots and switching. Stage 4.5 added no mechanics at all and made the
existing ones legible. Stage 4.5.1 put prices back on things. Stage 4.6a gave
the map a geography. Stage 4.6b turned the run into a ramp. Stage 4.6c added
relics. Stage 4.7 is a legibility pass and one balance change.

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

## What Stage 4.7 adds

**The player was making decisions without being able to see the state those
decisions act on, and could not read what was in front of them when they did.**

- **A party drawer on every screen that asks you something.** One drawer, not one
  panel per screen, in the same place every time. It is an overlay rather than a
  route, so closing it returns you to byte-identical screen state — nothing
  selected, nothing submitted, no RNG drawn. Asserted per surface, because those
  are properties of the *trigger* and a trigger placed inside a screen's own form
  fails on that screen alone.
- **A screen before each gym**, naming the leader and their type, where you choose
  who leads. It is not a node: no step from the budget, no tier, no reward, no
  RNG. Lead selection is a party *reorder*, so there is one source of truth for
  who is in front and it is the same one the party screen writes to.
- **Locale select shows the gym you are walking toward** and the party you are
  walking with. Both facts, side by side, and nothing on screen connects them —
  working out the relationship is the entire decision.
- **Move cards say what a move does.** A status move fills the three empty
  regions where base power and the effectiveness marker sit with a one-line
  effect readout. Every move carries tags: multi-hit with its range and per-hit
  power, priority bracket, STAB, recoil, drain, charge, and — the field most
  likely to make a player think the game cheated — accuracy, whenever it is
  under 100. Capped at three on a button face, because four buttons in a 2×2
  grid on a 390×844 phone cannot carry twelve tags and a 44px touch target.
- **Both Pokémon on the field carry an archetype label**, from base stats alone.
  Not from the moveset: that would leak the opponent's moveset, which the player
  is not shown. The label says what a Pokémon is *built* to do; working out what
  it is holding is the read. Under full randomization a physical attacker can
  roll four special moves, and the copy says so where the label is explained.
- **Contribution counters** per member — damage dealt and taken, KOs, faints,
  turns on the field — read off the battle protocol by a pure reducer. Raw
  counts, never a share and never a score.
- **A caught Pokémon is as usable as the one you started with.** See below.

### The balance change, and the hypothesis it did not support

Anything joining the party now arrives at the segment's player level. 4.6a's
"exactly as it was fought" read as generosity and was the opposite: wild
encounters are drawn 16 to 26 levels under the party, so a capture was a slot
that could not fight for the rest of the segment it was taken in — including
that segment's gym.

It was made on a hypothesis: that the tax suppressed swapping, so runs converged
on the starter. **The pre-patch numbers did not support it** and were checked
first — `catch-greedy` already beat `catch-averse`, and 37 gym-8 parties carried
81 distinct species between them. So it ships as a correctness fix with the swap
question open.

Measured at 400 seeds on the same prefix as the pinned 4.6c benchmark:
completion **5.25% → 9.8%**, mean gyms **3.03 → 3.41**, and the capture take rate
*down* slightly at 29.4%, so the feared "captures become strictly better than any
reward" did not happen. Two findings the report gave back that the patch did not
go looking for, both in `docs/balance.md` §13: the level tax turns out to have
been most of the punishment for indiscriminate catching, so removing it weakened
4.6a's "the value is in the declining" conclusion — and the pre-gym lead choice
does not measure at all (`lead-static` and `lead-swap` both reach 3.19 gyms at
200 seeds), which is exactly the thing the brief asked to find out before the
screen got polished.

## What Stage 4.6b added

**A run that starts with Tackle and Growl and ends with something that hits like
a truck.**

- **Every damaging move sits in one of four base-power bands**, cut at 55, 75
  and 95. A segment draws from a *weighted distribution* over bands rather than
  a flat window, so the ramp is a slope rather than a staircase — and each move
  slot draws its own band, so it is a property of a Pokémon rather than of the
  population it came from.
- **The starter opens at band 1 and climbs from there.** Rewards are what climb
  it: a normal card pays *in* the segment's band (a sidegrade — coverage, not
  power), a hard card one above, an elite card two. Gym leaders draw one band
  above the segment around them, which is the difficulty spike as a single
  number.
- **Berries**, fifteen of them, as the low denomination of the economy. They are
  held items the sim already resolves; the new work is that a fired berry is
  read off the battle's own `-enditem` line and **destroyed** — it does not
  restock. They occupy backpack slots, which is what makes dropping them a
  decision once the economy moves past them.
- **Species reward cards are gone.** Capture from 4.6a is the acquisition route,
  and it costs a step. Two routes was two sets of rules for what a joined
  Pokémon is.

Measured at 400 seeds: the player's mean move band entering each gym climbs
**1.03 → 2.89**, and it climbs *faster on the risky path*. Getting completion
back to 7.2% took one retune, and it was the level offsets rather than a band —
`docs/balance.md` §11 has the three passes and the two findings that turned out
to be about the simulator rather than the game.

## What Stage 4.6a added

**A map with places in it, and a party you catch rather than one you are
given.**

- **Eight locales, and a segment opens on a choice between two or three of
  them.** A locale decides which wild Pokémon that segment fields and nothing
  else — not the tiers, not the trainers, not the shops, not the gym. Four types
  each, all eighteen covered exactly, with Dragon, Psychic, Fairy and Steel
  appearing once. A locale is never offered twice in a row, and at 1000 seeds
  every locale is offered in every run.
- **Exactly one wild encounter per segment, and you cannot walk past it.** One
  step's options are all wild, at different tiers, so the encounter is
  guaranteed and the step is still a decision.
- **Capture, offered on every wild victory and guaranteed rather than rolled.**
  A capture roll on a seeded run is a punch with no counterplay; the cost is that
  the encounter occupies one of the segment's limited steps, and taking it costs
  a party slot or a party member. The caught Pokémon arrives exactly as it was
  fought — level, moveset, ability, held item.
- **Keyed RNG sub-streams**, which is the change nothing on screen shows and
  everything later depends on. See "Determinism" below and
  [`gymrun-seeds-and-mappability.md`](docs/spec/gymrun-seeds-and-mappability.md).

The measured result is that parties **fill by gym 2** and **diversify**: 94 runs
reached the eighth gym carrying 152 distinct species between them, and the most
common one held 4.3% of the slots.

## What Stage 4.5.1 added

**Three decisions that used to be rules, and one that used to be free.**

- **A backpack.** Items no longer land on a Pokemon and destroy what it was
  holding — they go in a bag, and who wears what is settled on the party screen
  for free, as often as you like, between fights. The bag is finite
  (`tuning.backpackCapacity`), so *acquiring* is still a choice; assigning is
  not. Nothing is ever destroyed except by an explicit discard.
- **You choose what a move costs you.** A move reward asks who learns it and
  then which of their four moves goes. There is no decline — the place to skip a
  move card is the reward screen, where you already picked it over two
  alternatives. The Stage 4.5 rule that a move reward could never leave you
  weaker is deliberately gone.
- **A coverage line on species cards.** One factual sentence — "adds Dragon,
  Steel. Loses Ghost." — with no score, no arrow and no colour that says which
  way is better.
- **Gender, rolled properly and shown.** Not the cosmetic change it looks like:
  the engine was rolling it off the *battle* PRNG with a flat coin flip, so the
  same Pokemon was male in one fight and female in the next and nothing outside
  a battle had a gender at all. See "Determinism" below.
- **A Simple / Detailed toggle**, and stat tooltips on every abbreviation,
  because `Atk` versus `SpA` is the one distinction a non-player cannot infer.

Rest nodes were also cut roughly in half. They were tuned for a world where
healing was free, and this is the stage that makes healing cost a node.

## What Stage 4.5 added

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

At 400 seeds, the `greedy` policy:

| gym | leader | type | team | reached | clear rate | drop |
|---|---|---|---|---|---|---|
| 1 | Garnet | Rock | 1 | 368 | 92.4% | — |
| 2 | Marina | Water | 2 | 334 | 86.5% | -6pt |
| 3 | Volta | Electric | 3 | 281 | 78.3% | -8pt |
| 4 | Fern | Grass | 4 | 211 | 74.9% | -3pt |
| 5 | Cinder | Fire | 4 | 145 | 54.5% | -20pt |
| 6 | Solene | Psychic | 5 | 76 | 59.2% | +5pt |
| 7 | Vesper | Ghost | 5 | 43 | 65.1% | +6pt |
| 8 | Draven | Dragon | 5 | 26 | 61.5% | -4pt |

Run completion **7.2%**, mean 3.27 gyms of 8, worst gym-to-gym drop 17 points.
400 seeds, `--prefix RETUNE`, greedy policy.

**A correction, recorded rather than quietly fixed.** An earlier version of this
section reported 4.0% completion and attributed a 3.2-point drop to admitting
Cut and Flash to the move pools ahead of Stage 4.6c. **That attribution was
wrong, and the comparison behind it was invalid**: the 7.2% baseline was
measured with `--prefix RETUNE` and the 4.0% with the default `--prefix SIM`.
Those are two different populations of 400 seeds, so the two numbers were never
comparable, and the difference between them was the seed set rather than
anything in the game.

Measured properly, on one population:

| build | prefix | completion | mean gyms |
|---|---|---|---|
| `randomizer-9`, Cut and Flash in | SIM | 4.0% | 2.94 |
| `randomizer-10`, Cut and Flash out | SIM | 4.0% | 2.82 |
| `randomizer-8`, before either | RETUNE | 7.2% | 3.27 |
| `randomizer-10`, Cut and Flash out | RETUNE | 7.2% | 3.27 |

**Admitting the two moves cost nothing measurable** — same completion, and mean
gyms moved by 0.12 in the noise. The `SIM` population simply sits lower than the
`RETUNE` one. The reasoning in the original note was plausible and it was
checked against a number that could not support it.

Cut and Flash have since been removed for an unrelated reason: capabilities are
satisfied by relics now, not by moves, so neither move has any special claim on
a pool slot. `randomizer-10`'s move tables are byte-identical to `randomizer-8`'s
— which is why the RETUNE rows match to every digit — but the version string
still moved forward, because two distinct content states must never share a
name.

Completion is inside the simulator's 5-15% target band. It is no longer a gate
either way; see [`docs/balance.md`](docs/balance.md) §0.

The player's mean move band entering each gym climbs **1.03 → 3.04** over those
eight fights, and climbs faster on the risky path. `docs/balance.md` §11 has
4.6b's retune — three measured passes, of which only the third moved anything —
and the two findings that turned out to be about the simulator rather than the
game. A `random` policy completes **0.0%** of runs and clears gym 6 in **0.0%**
of them, which is the depth test: if a random policy cleared gym 6, move choice
would not matter. Every Stage 2 target passes on both policies; the completion
band is the one miss.

The randomizer draws from 635 species, 398 damaging moves and all 310
abilities, and across 12,298 encounters at 400 seeds the sweep saw **630 of the
635 species and all 310 abilities**. That is the diversity claim
worth making, because win rate cannot measure it at all: a narrow pool that
happened to be balanced would pass every other number in the report.

Note the clear rates are per *arrival*, not per run — 75.5% of the 94 runs that
reached Draven beat him. The population thins faster than the gyms get harder,
which is what the `reached` column is there to show.

[`docs/balance.md`](docs/balance.md) has the full report and the findings that
moved the numbers — including §7.2, where the largest error in a tuning pass
turned out to be a premise rather than a number; §8, the Stage 4.5 non-result
and how it was checked; and §9, where two of the three questions that opened
Stage 4.5.1 turned out to have false premises as well.

```sh
npm run sim                              # 200 seeds, both policies
npm run sim -- --seeds 1000              # the report above
npm run sim -- --nodes all               # compare node-choice playstyles
npm run sim -- --policy switching        # Stage 4's headline pair
npm run sim -- --policy catching         # Stage 4.6a's: capture on and off
npm run sim -- --set stepsPerSegment.min=6
npm run sim -- --help
```

## Layout

```
src/core/      pure, deterministic, zero DOM, unit tested
  rng.ts       seeded streams: map, rewards, battle, randomizer, policy —
               and, from 4.6a, keyed sub-streams inside each of them
  streamKeys.ts  every sub-stream key in the game, as functions not literals
  types.ts     the vocabulary every layer shares
  randomizer.ts  how a Pokémon is rolled; pure, explicit Rng, no globals
  party.ts     what persists between nodes, and the rules that change it
  encounters.ts  map and encounter generation, all of it eager — including a
               route per offered locale, of which the player keeps one
  run.ts       the run state machine, RunPolicy, and playRun
  acquisition.ts how a Pokemon joins the party, and what it costs
  coverage.ts  offensive type coverage as a set of names, never a score
  typeMatchup.ts  which types beat the party and it cannot answer; a
               party and nothing else, in dex order, ranking nothing
  economy.ts, rewards.ts, items.ts, events.ts   Stage 3's four systems
               items.ts also owns the backpack: capacity, plans, discards
  battle/
    format.ts    generation, format id, clauses; the gen-lock lives here
    driver.ts    THE ONLY @pkmn/sim adapter
    stats.ts     the stat formula, pure, checked against the engine
    view.ts      BattleUiView — what the battle screen renders, derived
    policy.ts, switching.ts, ai.ts
src/data/      what a Pokémon is rolled *from*, and every balance number
  scaling.ts     the curve: eight rows, and what party the curve assumes
  partyTuning.ts PARTY_SIZE and join level (revival moved to tuning.ts)
  gyms.ts        eight leaders and their type identities
  locales.ts     eight regions, four types each, and the rule that offers them
  starters.ts    what the player begins with; Stage 5's unlock seam
  blacklists.ts  the exceptions, each with the evidence that earned it
  statusInfo.ts  what every condition does, and what to do about it
  statInfo.ts    what Atk, SpA and the rest mean, without saying which is good
  abilityEffects.ts, abilityOverrides.ts, categoryInfo.ts   tooltip data
  speciesPools.ts, movePools.ts, abilities.ts   generated; npm run gen:pools
src/ui/        a thin DOM layer: ten screens and a router
  scene.ts     the battlefield; reads BattleUiView and nothing else
  settings.ts  the verbosity flag; unreachable from core/, and tested so
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

### Keyed sub-streams, and the bump they exist to spend once

Named streams solved the *between systems* problem and left the *within a
system* one alone: every map draw in a run came off one sequence, so a draw
added at segment 0 shifted every draw at segments 1 through 7. That is why every
stage from 3 onward appended a generation pass rather than editing one.

From Stage 4.6a a stream opens sub-streams **by key** —
`rng.map.at('seg3/cave/route')` is a sequence of its own, derived from the seed,
the stream name and the key. A draw under one key cannot move a draw under any
other, so adding a *new* key is free and adding a draw inside an existing one
moves that node's rolls and nothing else. `src/core/streamKeys.ts` is the
namespace; [`gymrun-seeds-and-mappability.md`](docs/spec/gymrun-seeds-and-mappability.md)
is the argument, including why the two sub-stages after this one should not need
a structural bump of their own.

It cost one `RANDOMIZER_VERSION` bump, and it is the broadest the string has
carried: not one line of what a Pokémon *is* changed, and every seed rolls a
different run.

### The engine was rolling gender, and it was rolling it wrong

Worth recording because it is the exact shape of bug the version guards exist
for, and because the Stage 4.5.1 prompt asked for the opposite of what the
measurement showed.

Showdown assigns a gender that a team does not name with
`battle.sample(['M', 'F'])` — a **flat coin flip that ignores the species'
`genderRatio`**, taken from the *battle* PRNG at team construction. Three
consequences, all measured rather than assumed:

- Combee, 87.5% male in its own data, came out 206/194 over 400 seeds.
- The same party member was male in one fight and female in the next, and
  nothing outside a battle had a gender at all — so a party screen had nothing
  to show.
- Every gendered body on both sides cost one battle draw before turn one.

GYMRUN now rolls gender itself, from the real ratio baked into
`SpeciesEntry.maleChance`, and hands the sim a concrete value. That
short-circuits the sample the engine was already making, so it is a **relocated
draw rather than a new one** — the run makes one fewer battle draw per Pokemon
and one more randomizer draw. Both version numbers moved as a result:
`RANDOMIZER_VERSION` because specs changed, and `ENGINE_VERSION` because every
battle stream is offset from the first turn.

## Bundle

`@pkmn/sim` is most of it, and that is the shape of this project: we ship a
Pokémon engine, and the engine is mostly data.

| | JS gzipped | CSS gzipped |
|---|---|---|
| Stage 4 | 731.62 kB | 4.74 kB |
| Stage 4.5 | 744.19 kB | 5.36 kB |
| Stage 4.5.1 | 748.32 kB | 5.61 kB |
| Stage 4.6a | 729.00 kB | 6.34 kB |

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

## Ratified, and no longer open

Stage 4.6a shipped six calls flagged for review. All six are ratified and are
written up where they take effect; they are listed here so that "was this
decided or defaulted?" has one answer.

| call | where it lives |
|---|---|
| Locale select is a pre-step, not a node — the node budget is unchanged from 4.5.1 | `tuning.localeOfferCount` |
| Routes for every offered locale are generated up front and discarded at selection | `docs/generation.md` §1c |
| A captured Pokémon arrives at the level, moveset and item it was fought with | `core/acquisition.ts` |
| Its held item goes to the **backpack**, not into its hands | `core/acquisition.ts` |
| The guaranteed wild step is all-wild at distinct tiers, not a one-option step | `tuning.wildStepOptionCount` |
| The capture renders inside the result screen; the standalone acquisition screen is gone | `ui/screens/acquisition.ts` |

**The 7.1% completion rate is the accepted baseline**, not a regression to
recover. It is the price of the guaranteed wild step — a fight per segment
nobody can decline — and `docs/balance.md` §10.1 has the argument. Stage 4.6b
retunes once, against this number, and that is the last retune planned.

## Open questions for later

1. **Fights are short early.** Late fights have a shape; early ones are an
   exchange. One of the two causes is gone — there is a party and a switch to
   make from Stage 4 — and the other, no EV or IV spreads, is still structural.
   Note that it is no longer *only* a gap: one fixed spread is what lets
   `core/battle/stats.ts` compute the opponent's stats exactly rather than
   estimate them, so the exclusion is now load-bearing for a feature.
2. **`random` clears gym 3 in 19.8% of runs**, against a target of "rarely".
   Tightening the early gyms would push `greedy`'s completion out of its band,
   so the trade was declined; the depth test that matters passes at 0.8%.
3. **Gym 1 clears at 94.5%** against a ~90% target. It was the single MISS on
   the greedy run through Stage 4.5 at 95.0% and is now inside the band by half
   a point, which is not a result and should not be read as one — nothing in
   Stage 4.5.1 was aimed at it. A first gym that almost never stops anyone is a
   tutorial, which may be the right thing for it to be; it has still not been
   argued either way.
4. **The blacklist is nearly empty**, which is correct after one tuning pass and
   not permanent. Nothing in the report dominated an outcome distribution.
5. **Nuzlocke interpretation.** The build spec's section 3 is read here as *no*
   nuzlocke ruleset: no per-Pokémon permadeath, no forced first-encounter rule.
   Wipe — every party member fainted — is the only death rule.
6. **Switching does not pay yet, and that is Stage 4's unmet done-condition.**
   `switch-aware` completes 9.2% of runs against `no-switch`'s 11.3% — still a
   gap in the wrong direction, and Stage 4.5.1 widened it rather than closing
   it. Nothing in the stage was aimed at switching, so this is a re-measurement
   rather than a regression, but it is the third report in a row to say the
   same thing. It is not a tuning oversight: the first
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
