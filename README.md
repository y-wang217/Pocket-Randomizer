# GYMRUN — Stage 1

A browser-based seeded Pokémon roguelike. This is Stage 1: **a run — pick a
starter, choose a path through a chain of nodes, and fight a gym leader at the
end of it, all reproducible from a seed.**

Stage 0 proved the battle engine. Stage 1 makes it a game.

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
npm run sweep    # play 200 runs headless and report the balance
npm run measure  # per-dependency gzipped bundle sizes
```

## What Stage 1 does

- **A seeded run.** The seed is shown, editable, and in the URL. Same seed plus
  the same decisions gives an identical run, on any machine.
- **Starter select.** Three Pokémon from a curated pool, shown with types,
  ability, max HP and all four moves — enough to actually choose between.
- **A run map.** Six to eight steps, each offering two or three nodes: a wild
  encounter, a trainer battle, or a rest. The whole chain is visible, so a
  choice can be made against what is coming. Node *contents* stay hidden.
- **Persistence.** HP and PP carry across encounters; rest nodes restore them.
  The number of steps is fixed at generation, so there is no grinding.
- **A gym leader** at the end, which is not a choice. Beat them and the run is
  won; lose the party and it is lost. Both land on a summary showing the seed,
  every node taken, and the outcome.
- **Save and resume.** The run log is the seed plus the decision sequence and
  nothing else. Closing the tab mid-run and reopening it replays the decisions
  and puts you back where you were.

## Layout

```
src/core/      pure, deterministic, zero DOM, unit tested
  rng.ts       seeded streams: map, rewards, battle
  types.ts     the vocabulary every layer shares
  party.ts     what persists between nodes, and the rules that change it
  encounters.ts  map and encounter generation, all of it eager
  run.ts       the run state machine, RunPolicy, and playRun
  battle/      format, driver (the only @pkmn/sim adapter), policy, ai
src/data/      curated pools, gym definitions, and every balance number
src/ui/        a thin DOM layer: four screens and a router
test/          determinism, generation, headless runs, replay, boundaries
docs/          architecture, generation rules, engine notes
```

Read [`docs/architecture.md`](docs/architecture.md) before adding to this, and
[`docs/generation.md`](docs/generation.md) before touching generation — the
order of the generation passes is a compatibility contract, not an
implementation detail.

## The two seams that matter

**`Policy`** is `(view) => Promise<Choice>`: the human, the AI and a scripted
bot are the same shape.

**`RunPolicy`** is the same idea one level up — a starter pick, a node pick and
a battle policy. `src/ui/app.ts` is a `RunPolicy` whose promises resolve on
clicks. `scripts/sweep.ts` is a `RunPolicy` that always takes the first option.
A recorded log replayed back is a `RunPolicy`. `playRun` takes one and cannot
tell which it has, so there is no separate interactive run loop to keep in sync
with the headless one.

That is what makes `npm run sweep` a loop around the same function players use.

## Balance

Every number is in `src/data/tuning.ts` and can be overridden from the command
line:

```sh
npm run sweep -- 500 stepsPerSegment.min=4 levelOffset.gym.min=0
```

At the shipped tuning, 60 runs per playstyle:

| playstyle | win | turns/fight | HP at gym | reached gym |
|---|---|---|---|---|
| rest whenever offered | 62% | 1.8 | 94% | 92% |
| never rest | 35% | 1.6 | 35% | 52% |
| always take the trainer | 17% | 1.7 | 53% | 27% |

The reasoning, and the finding that reshaped the encounter pools, are in
[`docs/generation.md`](docs/generation.md).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then static bundle to `dist/` |
| `npm test` | Vitest, headless |
| `npm run test:trim-strict` | Tests with the bundle trim's stubs set to throw on any access |
| `npm run check` | Lint, typecheck, both test runs |
| `npm run sweep` | Play N runs headless and report the balance |
| `npm run smoke` | Browser smoke test against `dist/` (build first) |
| `npm run measure` | Gzipped bundle size per dependency (build first) |
| `GYMRUN_FULL_DEX=1 npm run build` | Build without the bundle trim |

## Open questions for later

1. **Fights are short.** 1.8 turns at the shipped tuning. The remaining causes
   are structural rather than tuneable — no EV or IV spreads, and one Pokémon a
   side, so there is no switch to make and rarely a turn with two plausible
   moves. Stage 4's party slots address the second directly.
2. **Nuzlocke interpretation.** The build spec's section 3 is read here as *no*
   nuzlocke ruleset: no per-Pokémon permadeath, no forced first-encounter rule.
   Wipe — every party member fainted — is the only death rule, and
   `tuning.reviveFaintedBetweenNodes` encodes the rest. If per-Pokémon
   permadeath was meant, that flag and the whole reward economy change shape.
3. **Party size for Stage 4.** The spec recommends starting at 3.
