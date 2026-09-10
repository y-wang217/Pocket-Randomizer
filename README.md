# GYMRUN

A browser-based seeded Pokémon roguelike: **an eight-gym randomizer run through
regions you choose, with a party you catch, a kit that starts weak and climbs,
and relics that open the roads a party alone cannot.**

Stage 0 proved the battle engine. Stage 1 made it a run. Stage 2 made it a
*randomizer* and built the instrument that says whether the randomizer is
playable. Stage 3 added tiers, rewards, items, shops and events. Stage 4 added
party slots and switching. Stage 4.5 added no mechanics at all and made the
existing ones legible. Stage 4.5.1 put prices back on things. Stage 4.6a gave
the map a geography. Stage 4.6b turned the run into a ramp. Stage 4.6c made a
capability a relic.

There is still no battle engine here. GYMRUN wraps [Pokémon
Showdown](https://pokemonshowdown.com) via `@pkmn/sim`.

**This file is the front door: how to run it, and what each stage added.** The
rules, the numbers and the current state are not here, and where this file
disagrees with one of the documents below, the document is right.

| you want | read |
|---|---|
| the invariants, and nothing else | [`CLAUDE.md`](CLAUDE.md) |
| current state, open items, the design lineage, and the map to every other document | [`docs/README.md`](docs/README.md) |

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

## What Stage 4.6c adds

**Roads a party alone cannot open, and permanent objects that open them.**

- **A capability is granted by a relic**: a permanent, run-scoped, passive
  object. No move slot, no backpack capacity, no teaching, no legality query.
  Knowing a capability-named move grants nothing, because the move and the
  capability are unrelated systems that share a name.
- **Capability events resolve in one of three bands**, by what the party can
  answer. All three outcomes are drawn at map generation and one is selected at
  resolution, so RNG consumption does not depend on how the run was built.
- **Band 3 is a node transition**, which is what lets an event put a fight in
  front of the player without `core/events.ts` learning to run one.
- **`latent` is type-based, not learnset-based.** The bundle ships no learnsets
  and never will; `src/data/capabilityTypes.ts` records the measurement and the
  three reasons.

This is the third design for the capability system and the two before it are
still in `docs/spec/`. [`docs/README.md`](docs/README.md) says which is live.

## What Stage 4.6b adds

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
  everything later depends on. See [`docs/keyed-streams.md`](docs/keyed-streams.md)
  and [`docs/spec/gymrun-seeds-and-mappability.md`](docs/spec/gymrun-seeds-and-mappability.md).

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
  a battle had a gender at all. See [`docs/engine-notes.md`](docs/engine-notes.md).
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

## The rules, the seams, and the layout

All of it lives in [`docs/architecture.md`](docs/architecture.md): the five
boundary rules and which are lint-enforced, the layer diagram, the four seams,
and the run log structure. It is the owner, and this file used to restate it.

- Determinism and the keyed sub-streams: [`docs/keyed-streams.md`](docs/keyed-streams.md)
  for what shipped, [`docs/spec/gymrun-seeds-and-mappability.md`](docs/spec/gymrun-seeds-and-mappability.md)
  for the design it implements.
- What is drawn where and when: [`docs/generation.md`](docs/generation.md).
- `@pkmn/sim` findings and the bundle: [`docs/engine-notes.md`](docs/engine-notes.md).

## Typeface

The display face is [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans),
copyright 2021 The Pixelify Sans Project Authors, used under the SIL Open Font
License 1.1. Two latin-subset weights are self-hosted under `public/fonts/` with
the licence beside them in `OFL.txt`. Numbers and body copy render in the system
monospace stack; `--font-body` in `src/ui/theme/tokens.css` is the one line that
changes that.

## Balance

**The centrepiece is not a game feature. It is the simulator.** You cannot
balance a roguelike by playing it: fifty runs is an afternoon and three
anecdotes, a thousand runs is forty seconds and a distribution, and a difficulty
curve is a distribution.

[`docs/balance.md`](docs/balance.md) owns **every** figure, the standing policy
that balance is not a gate, and the benchmark table. No number is repeated here,
because a number copied into two files disagrees with itself within two stages.

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

## Open questions

[`docs/README.md`](docs/README.md) section 5 carries them, one line each with a
pointer to where each is argued.
