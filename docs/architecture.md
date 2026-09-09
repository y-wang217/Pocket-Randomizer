# Architecture

Stage 0 built one battle. Stage 1 built a run around it. Stage 2 made the run a
randomizer and eight segments long. The point of this document is the parts that
are *not* about the current stage — the seams that exist so the remaining stages
are additions rather than rewrites.

Two of those seams were cashed in during Stage 2 and are worth reading as
evidence that the approach works: `Choice` gained `{ kind: 'switch' }` as a
purely additive change the compiler walked us through, and `generateSegment`
went from being called once to being called eight times with no change to its
signature.

## The rules

Five constraints are enforced by a test (`test/boundaries.test.ts`). Three of
them — 1, 2 and 4 — are enforced by ESLint (`eslint.config.js`) as well, because
lint is easy to disable inline and easy to skip in CI and those three are the
ones a single stray import or call can break. Rules 3 and 5 are test-only: both
are about what a *file* may name rather than about a package or a call, and the
lint form of either would be a per-file override list that the next file quietly
joins. All five are load-bearing:

1. **`core/` never imports from `ui/`.** A battle must be fully playable with no
   browser present.
2. **The platform's unseeded RNG is banned anywhere under `src/`.** All
   randomness comes from `core/rng.ts`. One unseeded draw makes a run
   unreproducible and gives no clue which draw did it.
3. **`core/` is DOM-free** and runs headless under Node.
4. **Only `core/battle/driver.ts` and `core/battle/format.ts` import
   `@pkmn/sim`.** Everything above the adapter speaks `core/types.ts`.
5. **The battle UI reads `BattleUiView` and nothing else.** No `core/run`
   import, no `RunState`, no `PokemonSpec`. Added in Stage 4.5, when putting
   the opponent's ability on screen made reaching into the run for it the
   obvious shortcut — see "The battle screen's projection" below. Test-only,
   because it is a rule about which module a screen may name rather than about
   a package, and the ESLint form of it would be a per-file override list that
   the next screen quietly joins.

TypeScript is strict, with `noUncheckedIndexedAccess` on and no `any` in
`core/`.

## Layers

```
data/                 A leaf. Values and balance numbers, no logic.
  mons.ts             Curated species pools. Stage 2 replaces these with rolls.
  starters.ts         getStarterPool(unlocked?) — a function, for Stage 5.
  gyms.ts             Leader, type, segment index, team.
  tuning.ts           EVERY balance number in the game, in one typed object.
      ^
      | read by
      |
core/types.ts         The shared vocabulary. No DOM, no sim.
core/rng.ts           Seeded streams: map, rewards, battle.
core/party.ts         What persists between nodes, and the rules that change it.
core/encounters.ts    Map and encounter generation. All of it eager.
core/run.ts           RunState, resolveNode, RunPolicy, playRun.
core/battle/
  format.ts           Generation, format id, clauses. The gen-lock lives here.
  driver.ts           THE ONLY ADAPTER OVER @pkmn/sim.
  stats.ts            The stat formula, pure. Checked against the engine.
  view.ts             BattleUiView — what the battle screen renders, derived.
  policy.ts           (view) => Promise<Choice>. Human, AI, and bots alike.
  ai.ts               Greedy damage-maximising policy over @smogon/calc.
      |
      v
ui/                   A thin DOM layer. Ten screens and a router.
  screens/            starter-select, run-map, battle, summary, and six more.
  scene.ts            The battlefield. Reads BattleUiView and nothing else.
  tooltips.ts         One delegated tap-first layer. Content all from data/.
```

`ui/` can be replaced wholesale without touching `core/`; `data/` was replaced
by a randomizer's tables in Stage 2 without touching either.

`data/` is a leaf that `core/` reads, and its only import is `core/types.ts`
for the shape of the values it holds — a type-only import, so there is no
runtime cycle. `Tuning` is the exception to "read freely": it is *passed into*
generation and the run state machine, never imported from inside a function.
The simulator sweeps those values programmatically, which only works if every
one of them is reachable from a value the caller controls. `npm run sim -- --set
stepsPerSegment.min=6` overrides any of them from the command line, which is the
proof.

Stage 2 added a second data file with a different rule: `data/scaling.ts` is a
per-segment *table* rather than one object, and it is imported by
`core/randomizer.ts` directly rather than threaded through as a parameter. That
is a deliberate asymmetry. `Tuning` describes one segment's shape and a sweep
wants to vary it; the curve describes all eight and varying it means editing the
table, which is what a balance pass does anyway.

## The seams

### Named RNG streams

`createRng(seed)` returns five independent streams: `map`, `rewards`, `battle`,
`randomizer` and `policy`. Stage 0 drew only from `battle`.

The split had to exist before it was needed, and Stage 2 is where it paid.
Species, ability, moveset and level rolls all come from `randomizer`, so adding
a draw there cannot shift a map shape or a damage roll for a seed recorded
before the change — and a Stage 3 reward draw cannot shift what a species roll
produced. `policy` exists so the simulator's `random` bot is reproducible
without borrowing a stream that belongs to a game system.

Streams are domain-separated by name in the hash, so the isolation is a property
of the construction rather than of discipline. It is asserted anyway:
`test/determinism.test.ts` drains 500 values and `test/randomizer.test.ts`
drains 5,000 from every stream in turn and checks that none of the others moved.

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

### The run policy

```ts
type RunPolicy = {
  chooseStarter: (options: PokemonSpec[]) => Promise<number>;
  chooseNode: (options: NodeSpec[]) => Promise<number>;
  battle: Policy;
};
```

The battle policy seam, one level up. A run is a sequence of three kinds of
decision, and `playRun(seed, policy, tuning)` takes a function for each and
cannot tell what is answering:

- `src/ui/app.ts` is a run policy whose promises resolve on clicks
- `scripts/sim.ts` builds two of them, `greedy` and `random`
- `replayRunPolicy(log)` is a recorded log handed back as a policy

The payoff is the same as Stage 0's: there is no separate interactive run loop
to keep in sync with the headless one. `npm run sim -- --seeds 1000` plays a
thousand runs through the exact function a player uses, with no DOM — and the
balance numbers it produces are therefore about the game rather than about a
second implementation of it.

### resolveNode, and where rewards will hang

`resolveNode(state, result) -> RunState` is the only place anything happens
between two nodes. The battle's damage is folded into the party, rest is
applied, the run's end conditions are checked, and only then does the party
clear status and revive.

Stage 3's rewards hang off this function. That is why the battle screen hands
back a `NodeResult` of plain facts — the outcome, and the party as the sim left
it — rather than applying the rules itself. A screen that knew about rest,
revival and wipe detection is a screen Stage 3 would have to teach about
rewards too.

The ordering inside it is load-bearing: **the wipe check runs before revival**,
or `reviveFaintedBetweenNodes` would quietly resurrect a run that had already
ended.

### Lists, not singulars

`RunState` holds `segments: Segment[]` and `party: PokemonState[]`. Stage 1
generates one segment and puts one Pokémon in the party.

Every function is written as though it were eight and six. `generateSegment`
takes the segment index and uses it for level scaling and the gym lookup;
`isWiped` is "every member fainted", never "the starter fainted". In Stage 1
those read identically, which is exactly why the singular version has to be
ruled out now — it would keep passing its tests right up until Stage 4 adds a
slot and started ending runs early.

### The driver as an adapter

`core/battle/driver.ts` translates in both directions — `TeamSpec` to
`PokemonSet`, sim `Pokemon` to `BattleView`, `Choice` to `"move 3"` — and is the
only file that knows a protocol string exists.

It reads the sim's own choice *request* rather than the Pokémon's move slots
when building `BattleView.moves`, because the request already accounts for
Disable, Choice lock, Encore, Torment, zero PP and the Struggle substitution.
Rebuilding that from move slots is how a UI ends up offering a move the engine
then rejects.

Stage 1 added two things to it, both of which exploit the same fact: `Battle`
does not start until *both* sides are set, so a side set first is fully
constructed and not yet on the field.

- **`describeSpec` / `describeSpecCard`** build a battle, set one player, and
  never start it. That yields exact max HP and max PP straight from the engine
  — the alternative is reimplementing the HP formula and the PP-Up rule and
  being subtly wrong about Shedinja, `noPPBoosts` moves, and the gen-lock
  forever. The starter-select screen needs types and base powers for Pokémon
  that have never fought, and `ui/` may not import the sim, so the adapter
  answers in `MoveView` — the same type the move buttons already take.
- **`carryOver`** writes persisted HP, PP and status onto p1 in the gap between
  the two `setPlayer` calls. It has to happen before switch-in is emitted:
  applying it afterwards would leave the protocol announcing full HP for a
  Pokémon that does not have it, and every log-derived damage percentage
  measured against the wrong baseline. p1 gets the gap because p1 is set first;
  opponents are generated fresh at full HP in every stage that exists.

### The battle screen's projection

Stage 4.5 added a fifth seam, and it is the only one in the project that exists
to keep a *screen* honest rather than to keep two layers apart.

```ts
// core/battle/view.ts
buildBattleUiView(facts: BattleFacts, reveal: RevealPolicy, effects) -> BattleUiView
```

The stage put six numbers on screen that the engine had been resolving
correctly since Stage 0 — move category, both sides' stats, stat stages, turn
order, type effectiveness — and the obvious way to get them there was to hand
the battle screen the run's own data. `RunState` is already in reach of
`onBattle`, the opponent's `PokemonSpec` is a field on it, and three lines would
have put an ability on screen in an afternoon.

**That is the seam that rots.** It couples a pixel to a run-state field, it
reads information the player has not been shown, and — the part that makes it
dangerous rather than merely ugly — it would have passed every test in the
suite, because nothing else asserts on where a screen got a number from. So
`test/boundaries.test.ts` grew a fourth rule to sit beside the other three, and
it was verified by injecting the violation it forbids.

Three things about the shape are worth writing down.

**It is not `BattleView`.** That name was taken, by the *policy* view in
`core/types.ts` — the thing the greedy AI and the balance sweep decide from,
with `foe.ability` deliberately null. Widening it would have handed the AI an
ability no player has seen and moved every number in `docs/balance.md`. The
Stage 4.5 brief asked for the name; the brief did not know it was taken. So the
projection is `BattleUiView`, the policy view is untouched, and the two coexist.

**The adapter emits facts, the projection decides what is shown.** `factsFor`
reports the opponent's ability and item *unconditionally*; `view.ts` gates them
on `tuning.revealOpponentAbility` and `revealOpponentItem` and carries the flag
out as `revealed`. A projection that could not see the ability could not decide
to hide it, and — more to the point — could not refuse to leak it through the
effectiveness badge or the speed arrow. One source decides, and both readouts
respect it.

**It is derived, never stored.** Nothing here is serialized, held in `RunState`
or written to a run log. It is a pure function of a plain-data snapshot, which
is why `test/battle-view.test.ts` builds most of its cases by hand with no sim
and no DOM.

### Duplicating the engine on purpose

`core/battle/stats.ts` reimplements `Battle#statModify`, which is exactly the
kind of thing `describeSpecCard` exists to avoid — and the difference between
the two cases is the argument for both.

`describeSpecCard` asks the engine for max HP and max PP because the answer
depends on rules with long tails (Shedinja, `noPPBoosts`, the gen-lock) and
because it is asked rarely, at a screen boundary. `stats.ts` computes the stat
spread instead, because the protocol *never sends the opponent's stats* — a
Showdown client can only estimate them, since EVs, IVs and natures are not
public. GYMRUN has none of those. Every Pokemon sits on one fixed spread, so
the computation is exact rather than an estimate, and the opponent's Attack can
be a number instead of a range.

The duplication is only safe because it is checked: `test/stats.test.ts`
cross-references the formula against the engine's own `storedStats` across ten
species and seven levels, so a gen-lock change fails the suite rather than
quietly mislabelling a panel.

Speed goes the other way, and for the same reason inverted. `getStat('spe')`
has already run the `ModifySpe` event, so paralysis, Choice Scarf, Swift Swim,
Quick Feet and Slow Start are all folded in correctly and for free. That list
is a long tail with no bound, and the speed readout is worthless the moment it
disagrees with the turn order it describes — so it is asked, not derived.

### Where the dex reads live

Stage 4.5 needed four new things out of `@pkmn/sim`: ability descriptions, the
type chart, move flags, and per-move effectiveness. All four went into
`driver.ts`, in a section of their own, rather than into a new
`core/battle/dex.ts` with the allow-list widened to admit it.

That was a choice and not an oversight. Rule 4 above names two files, and it is
enforced in two places precisely because it is the kind of rule that erodes one
reasonable exception at a time. `describeSpecCard` set the precedent in Stage 1
— a dex lookup answered in display types, inside the adapter — and this is the
same shape of thing. The cost is that `driver.ts` is longer; the alternative was
loosening a load-bearing rule to save a section header.

## Run logs

```ts
type RunDecision =
  | { kind: 'starter'; index: number }
  | { kind: 'node'; index: number }
  | { kind: 'battle'; choice: Choice };

type RunLog = { seed: string; version: string; decisions: RunDecision[] };
```

The seed and the decision sequence, and nothing derived. No HP, no party, no
map, no turn numbers — storing derived state is how replay logs silently drift
out of agreement with the engine that produced them.
`test/run-replay.test.ts` asserts the serialized log contains none of those
words, so derived state cannot leak in without failing.

Note what else is absent: the opponent's choices. The AI is a deterministic
policy over a view it is handed, so recording its answers would be recording
the engine's output as though it were the player's input.

Replay is therefore small, because a run *is* a seed plus a sequence of
decisions. `replayRunPolicy(log)` hands the log back as a `RunPolicy`; with a
`live` policy it consumes the log and then hands over, which is the whole of
resume. `test/run-replay.test.ts` resumes from a save taken after **every**
decision in a run and asserts each one reproduces the original exactly.

A single battle keeps its own record as `BattleLog`, which is the Stage 0 type
under its old shape and its old version string. That version string is why a
Stage 0 log is *rejected* rather than misread: `RUN_LOG_VERSION` embeds the
engine version, because a decision sequence is only replayable against the
mons, generation and sim it was recorded with.

Stage 2 added a **second** version to `RunLog`, and the reason it is separate is
the failure it catches. `version` moves when the engine or the log format
changes. `randomizerVersion` moves when a tuning pass changes what a seed
*rolls* — a band window widened, a pool regenerated. That kind of change leaves
every recorded decision sequence perfectly replayable and quietly reinterprets
it as a different run, which is the worst available outcome for a game whose
whole promise is that a shared seed is a shared run. So it is checked
separately, with its own message naming both versions.

`localStorage` holds one run log, written after every decision and cleared when
the run ends. That is the entire extent of persistence, by design.

## Deliberately absent

As of Stage 4.5: no unlocks, daily seed, run history or seed links (Stage 5); no
bench experience — and that one is a *decision* rather than a gap, written down
in `data/partyTuning.ts`: level is a pure function of segment index, so a
benched member is never behind and there is nothing to model; no EVs,
IVs, natures or breeding at all.

That last one stopped being purely an absence in Stage 4.5. One fixed spread is
what makes `core/battle/stats.ts` able to compute the *opponent's* stats
exactly rather than estimate them — a real Showdown client cannot, because EVs,
IVs and natures are private. The exclusion has become load-bearing for a
feature, which is worth knowing before anyone adds a nature.

Stage 4.5 itself added no mechanics, no state, no randomness and no balance
change. It is a read layer: `docs/balance.md` §7 remains the current
re-baseline, and the 1000-seed report is byte identical across the stage.

`Choice` stopped being a single-member union in Stage 2, and the way it did is
the argument for the seam: gym leaders field more than one Pokémon, the sim
issues a forced-switch request on a faint, and adding `{ kind: 'switch' }` was
an additive change the compiler walked through file by file.

Stage 4 made that switch voluntary, and the type did not have to change at all
— which was the whole point of writing it as a union in Stage 0. What did change
is everything downstream of *what a turn is*: a switch consumes one and the
incoming member takes the opponent's attack, so every balance number recorded
before Stage 4 describes a different game. `docs/balance.md` §7 is the
re-baseline.

The one place the seam did leak is worth naming, because it is the shape of
mistake this document exists to prevent. `readSwitches` asked the sim's request
for `active[0].trapped` and offered the switch whenever it was absent — but an
unrevealed Arena Trap reports `maybeTrapped` instead, because the ability is not
public information. The adapter's model of legality and the engine's disagreed,
the view offered a switch the sim then refused, and with `strictChoices` a
refusal is a throw mid-battle. The rule it cost us is in
`core/battle/switching.ts`: **legality is read off the request, never off our own
model of the battle**, and a test that only reads the `BattleView` is a test of
the translation agreeing with itself.
