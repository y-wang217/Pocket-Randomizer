# Architecture

Stage 0 builds one battle. The point of this document is the parts that are
*not* about one battle — the seams that exist so Stages 1-5 are additions
rather than rewrites.

## The rules

Four constraints are enforced by both ESLint (`eslint.config.js`) and a test
(`test/boundaries.test.ts`). Two enforcement mechanisms because lint is easy to
disable inline and easy to skip in CI, and these are load-bearing:

1. **`core/` never imports from `ui/`.** A battle must be fully playable with no
   browser present.
2. **The platform's unseeded RNG is banned anywhere under `src/`.** All
   randomness comes from `core/rng.ts`. One unseeded draw makes a run
   unreproducible and gives no clue which draw did it.
3. **`core/` is DOM-free** and runs headless under Node.
4. **Only `core/battle/driver.ts` and `core/battle/format.ts` import
   `@pkmn/sim`.** Everything above the adapter speaks `core/types.ts`.

TypeScript is strict, with `noUncheckedIndexedAccess` on and no `any` in
`core/`.

## Layers

```
data/mons.ts          TeamSpec values. Stage 2 replaces this with a generator.
      |
      v
core/types.ts         The shared vocabulary. No DOM, no sim.
core/rng.ts           Seeded streams: map, rewards, battle.
      |
      v
core/battle/
  format.ts           Generation, format id, clauses. The gen-lock lives here.
  driver.ts           THE ONLY ADAPTER OVER @pkmn/sim.
  policy.ts           (view) => Promise<Choice>. Human, AI, and bots alike.
  ai.ts               Greedy damage-maximising policy over @smogon/calc.
      |
      v
ui/                   A thin DOM layer. Reads BattleView, writes elements.
```

Nothing points upward. `ui/` can be replaced wholesale without touching
`core/`; `data/` can be replaced by a randomizer without touching either.

## The four seams

### Named RNG streams

`createRng(seed)` returns three independent streams: `map`, `rewards`, `battle`.
Stage 0 only draws from `battle`.

The split has to exist now. Once Stage 2 generates a map, drawing map numbers
from a shared sequence would shift every battle roll that follows, and every
seed recorded before that change would replay as a different fight. Independent
streams mean a seed's battles are fixed forever regardless of what later stages
consume. `test/determinism.test.ts` drains 500 values from `map` and `rewards`
and asserts `battle` is untouched.

The sim's own PRNG is seeded *from* the `battle` stream, never from the run seed
directly — same reason.

### Data-driven team specs

```ts
type PokemonSpec = { species; ability; moves; level; item?; nickname? };
type TeamSpec = PokemonSpec[];
```

No Showdown export string is ever built or parsed. Stage 0 hardcodes two of
these; Stage 2's randomizer will emit the same type from its rolls, and the
battle layer has no way to tell the difference. `item` is unused in Stage 0 but
wired through the sim, so items work the day something sets one.

### The policy interface

```ts
type Policy = (view: BattleView) => Promise<Choice>;
```

This is the most important seam. The human player is a policy whose promise
resolves on a click. The AI is a policy. A scripted balance-sweep bot is a
policy. `runBattle(teamA, teamB, seed, policyA, policyB)` takes two and does not
care which.

The payoff is that `src/ui/app.ts` and `test/headless.test.ts` make the *same
call*. There is no separate interactive battle loop to keep in sync with the
headless one. Stage 2 needs to run 1000 seeds with no DOM, and that is already
possible — `test/headless.test.ts` does 25 of them.

`BattleView` is deliberately restricted to what a player could know: your own
Pokémon in full, the opponent as species, level, HP, status and boosts, with
`foe.ability` always `null`. A bot with hidden information would make a balance
sweep measure the wrong thing.

### The driver as an adapter

`core/battle/driver.ts` translates in both directions — `TeamSpec` to
`PokemonSet`, sim `Pokemon` to `BattleView`, `Choice` to `"move 3"` — and is the
only file that knows a protocol string exists.

It reads the sim's own choice *request* rather than the Pokémon's move slots
when building `BattleView.moves`, because the request already accounts for
Disable, Choice lock, Encore, Torment, zero PP and the Struggle substitution.
Rebuilding that from move slots is how a UI ends up offering a move the engine
then rejects.

## Run logs

```ts
type RunLog = { seed: string; version: string; decisions: Decision[] };
```

The seed and the decision sequence, and nothing derived. No HP, no damage rolls,
no protocol text — storing derived state is how replay logs silently drift out
of agreement with the engine that produced them.

`replayRunLog()` rebuilds the battle from the seed and feeds the decisions back.
`test/replay.test.ts` round-trips through `JSON.stringify` and asserts the
reconstructed protocol matches byte for byte. `version` exists so a log recorded
against different data or a different `@pkmn/sim` is rejected rather than
replayed wrongly.

Stage 0 writes one log to `localStorage`. That is the entire extent of
persistence, by design.

## Deliberately absent

No run map, nodes, encounters, rewards, shops, party management, switching,
multiple Pokémon per side, randomization, gym leaders, unlocks, breeding, EVs,
IVs or natures. `Choice` is a single-member discriminated union rather than a
bare number *only* so that adding `{ kind: 'switch' }` later is an additive
change the compiler walks you through — that is a seam, not a feature.
