# Engine notes

Findings from Stage 0's verification spike, plus the bundle measurements that
came out of it. Everything here was measured on this repo, not recalled — the
commands to reproduce each number are given.

Versions: `@pkmn/sim` 0.10.11, `@pkmn/protocol` 0.7.3, `@pkmn/view` 0.7.3,
`@smogon/calc` 0.11.0, Vite 7, Node 22.

---

## 1. Does `@pkmn/sim` run in a browser?

**Yes, with no polyfills and no shims.** This was the single risk Stage 0
existed to retire, and it is retired.

`npm run build` produces a static bundle with no `rollupOptions.external`, no
`vite-plugin-node-polyfills`, and no `define` shims for `process` or `global`.
`scripts/smoke.mjs` then loads that bundle in Chromium, plays a battle to
completion, and fails on any console error or page exception. It passes clean.

Two things that would normally require Node shims turn out not to:

- **The PRNG.** `@pkmn/sim`'s default `sodium` seed sounds like it needs
  libsodium. It does not — `prng.js` implements
  `randombytes_buf_deterministic` on top of `ts-chacha20`, in pure JS,
  explicitly to avoid native modules. The `gen5` LCG seed is pure JS too.
- **Streams.** `lib/streams` is a hand-rolled async-iterator implementation,
  not Node's `stream`. The one place Node types leak in is
  `BattleTextStream._write(message: string | Buffer)`, and we never touch it:
  `core/battle/driver.ts` drives the `Battle` class directly and reads
  `battle.log`, which is synchronous and Buffer-free.

Load time in headless Chromium is ~380 ms from navigation to the first
enabled move button.

## 2. Is the sim deterministic under an explicit seed?

**Yes, byte for byte, with one documented exception.**

Two runs with the same seed and the same choice sequence produce identical
protocol output. `test/determinism.test.ts` asserts it for a scripted policy
and for the AI on both sides, and asserts that two different seeds do *not*
agree (otherwise the seed would not be reaching the engine at all).

The exception: the sim stamps `|t:|<unix seconds>` into the protocol. That is
wall-clock time and is the only non-deterministic line. `stripNondeterministic()`
in the driver filters it, and every determinism assertion compares through it.
Two runs that straddle a second boundary would otherwise "fail" for a reason
that has nothing to do with the engine.

Both seed formats work: `sodium,<64 hex chars>` (ChaCha20, the modern default)
and `gen5,<16 hex chars>` (the on-cartridge LCG). GYMRUN uses sodium, derived
from the run seed's `battle` stream in `core/rng.ts`.

## 3. Can a team be built with arbitrary species, ability and moves?

**Yes, including combinations no format would allow.**

`[Gen 9] Custom Game` applies no banlist and no legality check, and
`TeamValidator` is a separate step we never run. `test/headless.test.ts` plays
a full battle with Magikarp holding Levitate and using Boomburst, Judgment,
Recover and Splash — none of which it can learn, and one of which
(Levitate) changes its type interactions. The engine takes it without complaint
and applies all of it correctly.

Teams are passed as `PokemonSet[]` objects via `PlayerOptions.team`. **No
Showdown export string is ever built or parsed**, which is what lets Stage 2's
randomizer emit `TeamSpec` values directly.

## 4. Bundle size

Bundle size is a named project risk, so it is measured rather than estimated.
Reproduce with `npm run measure`. The method builds stub entrypoints that add
one dependency at a time and diffs the gzipped output, so a module shared by
two packages is not charged to both.

### Shipped bundle

| Asset | Minified | Gzipped |
|---|---|---|
| JS | 3309 kB | **696 kB** |
| CSS | 7.6 kB | 2.3 kB |

Those are Vite's own numbers from `npm run build`. `npm run measure` reports
674 kB for the same JS because it compresses at gzip level 9 and Vite does not;
the comparisons below are all level 9 and so are internally consistent.

### Marginal cost per dependency (gzipped)

| Dependency | Cost | What it buys |
|---|---|---|
| `@pkmn/sim` | 532 kB | The entire battle engine and dex |
| `@smogon/calc` | 111 kB | The AI's damage estimates |
| `@pkmn/view` + `@pkmn/protocol` | 24 kB | Protocol → readable log text |
| app code + CSS | ~7 kB | Everything we wrote |

`@pkmn/sim` is 79% of the bundle. That is the shape of this project: we are
shipping a Pokémon engine, and the engine is mostly data.

### What tree shaking removed: nothing, and why

The honest answer to "what did tree shaking remove from the dex" is **nothing
measurable**, and it is worth being precise about why, because it is not a
configuration mistake.

`@pkmn/sim`'s `sim/dex.mjs` statically imports every generation's data —
`gen1` through `gen9`, plus `gen8bdsp` and `gen8legends` — and every learnset
and legality table, then assembles them into one lookup object. Rollup cannot
drop any of it: the modules are all genuinely *referenced*. They are simply
never *read* by us. Tree shaking removes unreachable code, and none of this is
unreachable.

So the saving had to be taken deliberately. `build-config/trim-sim-data.ts` is a
Vite plugin that replaces the learnset, legality and Pokémon GO tables with
empty objects. Those exist for exactly one consumer, `TeamValidator`, and
GYMRUN never validates a team — it runs Custom Game precisely so the randomizer
can break legality.

| | Gzipped |
|---|---|
| Without the trim | 1121 kB |
| With the trim | **668 kB** |
| Saved | **454 kB (40%)** |

That claim is tested, not assumed. The whole suite runs with the plugin active,
and `npm run test:trim-strict` re-runs it with the stubs replaced by proxies
that **throw on any property access, probe or enumeration**. It passes — which
proves the tables are never read at all, rather than merely that empty reads
are survivable. `test/trimmed-data.test.ts` additionally exercises Metronome,
Mimic, Sketch, Transform, Copycat and Assist, the moves most likely to reach for
a move pool at runtime, plus a held item.

To turn the trim off (a later stage that adds real team validation would need
to): `GYMRUN_FULL_DEX=1 npm run build`.

### `@pkmn/dex` and `@pkmn/client`: evaluated, not shipped

Both were installed and their type definitions read during the spike, then
dropped.

`@pkmn/dex` alone costs **723 kB gzipped** — more than our entire trimmed
`@pkmn/sim`. It would be a second complete copy of the Pokédex alongside the one
the engine already carries. `@pkmn/client` needs it (it builds on
`@pkmn/data`'s `Generations`, which wraps a dex).

The only thing `@pkmn/client` was wanted for was acting as a `Tracker` for
`LogFormatter`, so damage lines read "lost 30.0% of its health" instead of "was
hurt". `src/ui/battle-log.ts` implements the ~40 lines of that interface we
actually use instead. The full tracker would additionally handle forme changes,
Illusion and mid-battle type changes; when a later stage needs those, this is
the trade to revisit — but at roughly double the bundle.

### If ~700 kB becomes a problem

In rough order of payoff per unit of effort:

1. **Stub the unused generation mods.** Gen-locking (see below) makes eight of
   the ten mod trees dead weight. `gen8bdsp` alone is 1.7 MB unminified. Same
   plugin, wider pattern.
2. **Drop `@smogon/calc` (111 kB).** Its damage formula could be replaced by
   running the sim itself against a cloned battle state, which would also make
   the AI's estimates exact rather than approximate.
3. **Code-split the engine** behind a dynamic import so the shell paints first.
   Helps perceived load, not total transfer.

None of these are Stage 0's problem. ~700 kB gzipped is roughly one mid-sized
photograph, it is cached after first load, and it arrives in under half a second
on the test rig.

## 5. Format and the Gen 3 lock

`core/battle/format.ts` owns the generation number, the format id and the clause
list, and it is the only file that does. Gen-locking to Gen 3, which the spec
plans for a later stage, is changing `GYMRUN_GEN` from `9` to `3`:
`gen3customgame` exists and takes the same custom-rule syntax.

Base format: `gen9customgame`. Custom Game is the right base because it applies
no banlist and no legality check — the two things a randomizer must be free of.

Clauses stripped: **Team Preview** (via Showdown's `@@@!Team Preview` custom
rule syntax, verified to clear `teampreview` from the resolved rule table).
Revealing the enemy team before a roguelike encounter would be wrong, and with
one Pokémon a side it is also a purely ceremonial extra request the driver would
have to answer.

Custom Game carries no Sleep, Species, Evasion or Endless Battle clause to begin
with, which is why the stripped list has one entry rather than five. That is not
an oversight. What it *does* carry and we keep: `Cancel Mod`, `Max Team Size 24`,
`Max Move Count 24`, `Max Level 9999`, `Default Level 100`.

## 6. Caveats carried forward

- **`|t:|` timestamps** are the one non-deterministic protocol line. Compare
  through `stripNondeterministic()`.
- **Opponent ability is hidden from the AI.** `BattleView.foe.ability` is always
  `null`, because Stage 0 does not track what an ability has revealed about
  itself. The greedy AI therefore estimates damage without it. Filling this in
  properly means reveal tracking, not exposing the sim's value — handing the bot
  information no player has would make a balance sweep measure the wrong thing.
- **The AI's damage estimate is currently exact**, because Stage 0 gives every
  Pokémon a Serious nature, 31 IVs and 0 EVs, so `@smogon/calc`'s reconstruction
  of the opponent matches the sim. Once spreads exist it becomes an
  approximation, which is the correct behaviour anyway.
- **Weather and terrain are not in `BattleView`**, so the AI's calc runs on an
  empty `Field`. Irrelevant with the Stage 0 movesets; it is a real gap the
  moment a randomizer can roll Drought or Electric Surge.
- **`@pkmn/sim` is CJS-first.** Its `exports` map offers ESM (`build/esm/*.mjs`)
  and Vite resolves that automatically. The trim plugin's path pattern matches
  the ESM build; if a future Vite config resolves the CJS entry instead, the
  pattern needs updating and the bundle would silently grow by 454 kB.
  `npm run measure` would catch it.
