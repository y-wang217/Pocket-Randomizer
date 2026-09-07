# GYMRUN — Stage 0

A browser-based seeded Pokémon roguelike. This is Stage 0: **one Pokémon versus
one Pokémon, full Showdown mechanics, in a browser, reproducible from a seed.**

There is no battle engine here. Stage 0 wraps [Pokémon
Showdown](https://pokemonshowdown.com)'s via `@pkmn/sim`; the one risk this
stage existed to retire was whether that bundles and runs in a browser at an
acceptable size. It does — see [`docs/engine-notes.md`](docs/engine-notes.md)
for the measurements.

## Quick start

```sh
npm install
npm run dev      # play it
npm run check    # lint + typecheck + tests, including the strict trim run
npm run build    # static bundle in dist/, deploys to any static host
```

After a build:

```sh
npm run smoke    # play a full battle in a real Chromium, fail on any error
npm run measure  # per-dependency gzipped bundle sizes
```

## What Stage 0 does

- Snorlax versus Milotic, level 50, full Gen 9 mechanics, no clauses.
- Move buttons with type, category, base power and remaining PP.
- Animated HP bars, status badges, and stat-stage indicators for both sides.
- A battle log rendered from the sim's own protocol — no hand-written strings.
- Win/lose screen with a rematch button that re-runs the same seed.
- The seed is displayed, editable, and in the URL, so any battle is reproducible
  by anyone.

Same seed plus same choices gives the same battle, every time. That is the
property everything else is built on.

## Layout

```
src/core/      pure, deterministic, zero DOM, unit tested
  rng.ts       seeded streams: map, rewards, battle
  types.ts     the vocabulary every layer shares
  battle/      format, driver (the only @pkmn/sim adapter), policy, ai
src/ui/        thin, swappable DOM layer
src/data/      TeamSpec values; Stage 2 replaces this with a generator
test/          determinism, headless play, replay, architecture boundaries
docs/          engine notes and architecture
```

Read [`docs/architecture.md`](docs/architecture.md) before adding to this. Stage
0's job was as much to build the seams for Stages 1-5 as to build a battle, and
the reasoning behind each one is written down there.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then static bundle to `dist/` |
| `npm test` | Vitest, headless |
| `npm run test:trim-strict` | Tests with the bundle trim's stubs set to throw on any access |
| `npm run check` | Lint, typecheck, both test runs |
| `npm run smoke` | Browser smoke test against `dist/` (build first) |
| `npm run measure` | Gzipped bundle size per dependency (build first) |
| `GYMRUN_FULL_DEX=1 npm run build` | Build without the bundle trim |

## Open questions for later

Neither blocks Stage 0; both want answering before Stage 4.

1. **Nuzlocke interpretation.** The build spec's section 3 is read here as *no*
   nuzlocke ruleset: no per-Pokémon permadeath, no forced first-encounter rule,
   faints healing between encounters. If per-Pokémon permadeath was meant
   instead, rule 5 and the entire reward economy change shape.
2. **Party size for Stage 4.** The spec recommends starting at 3.
