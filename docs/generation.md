# Generation

What a seed produces, in what order, and why the order is a contract rather
than an implementation detail.

Stage 2's randomizer has to follow the same rules, which is the reason this
document exists at all.

---

## 1. The decision this document was written to record

**Encounter contents are generated eagerly, at run creation, in the same pass
as the map — not at node entry.**

The build spec allows either. This is the one that was taken, and everything
below follows from it.

Both halves of that sentence matter:

- **The map structure** is generated in one pass at run creation because the
  alternative makes roll order a function of player behaviour. The moment
  Stage 3 adds a reward draw between two nodes, a lazily generated map would
  reshuffle every subsequent draw, and every seed recorded before that change
  would replay as a different run. Nothing about the map is decided while the
  player is playing.
- **The contents** — which species, which level — are generated at the same
  time, for every option, including the ones the player will never take. The
  alternative (drawing contents at node entry) is not *wrong*, but it makes the
  number of draws depend on the path taken, which puts the same problem back one
  level down.

The cost is a few hundred microseconds and some generated data nobody sees. The
benefit is that a seed's map and encounters are fixed for as long as the passes
below stay in the same order.

## 2. The passes

`generateSegment(index, rng, tuning)` runs three passes. They are separate on
purpose, and the boundaries between them are the parts that would be expensive
to change later.

### Pass 1 — shape, from the `map` stream

1. The number of steps, from `tuning.stepsPerSegment`.
2. For each step, in order: how many options (`tuning.nodeChoiceCount`), then
   which node *kinds* they are.
3. The rest-availability fix-up (see §4), which may rewrite a kind.

Kinds are sampled **without replacement** when `tuning.distinctKindsPerStep` is
on, and the option count is capped at the number of kinds available. The map
hides encounter contents, so two wild nodes side by side read as one option
printed twice — that is not a choice, it is a choice-shaped rectangle.

### Pass 2 — contents, from the `map` stream

For each node, in index order (step 0 option 0, step 0 option 1, …, then the
gym): the species, drawn from the pool for its kind, and the level.

This runs after pass 1 completes, which is what lets the rest fix-up rewrite a
node's kind: at the point the fix-up runs, nothing has yet been drawn for that
node's contents, so changing its kind does not strand a draw.

### Pass 3 — sim seeds, from the `battle` stream

One `sodium` PRNG seed per battle node, in the same index order.

This is a separate pass and a separate stream so that changing what a node
*contains* cannot shift the damage rolls of a node earlier in the map.

It also fixes a bug that would otherwise be invisible: `createBattle` derives
its PRNG seed from the run seed, so a run that let every battle do that would
play the *same* damage rolls, crits and accuracy checks in every fight, eight
nodes running. `test/generation.test.ts` asserts every battle in a segment gets
a distinct seed.

### Before all of it — starter options

`generateStarterOptions` draws from the `map` stream **before** the first
segment, so adding a starter to the pool changes what a recorded seed offers but
does not reshape its map.

## 3. Levels

```
segment base level = tuning.starterLevel + segmentIndex * tuning.levelPerSegment
encounter level    = segment base level + draw(tuning.levelOffset[kind])
```

`generateSegment` takes the segment index and uses it, even though Stage 1 only
ever passes `0`. Stage 2 turns on eight segments by calling it in a loop.

The offsets that ship were measured, not guessed — see §6.

## 4. Guarantees generation makes

| Rule | Why |
|---|---|
| No rest node before `tuning.restEarliestStep` | A rest on step 0 heals nothing, and a step whose only interesting option is a no-op teaches the player the map does not matter |
| At least `tuning.minRestSteps` steps offer a rest | Weighted draws can produce a segment with nowhere to heal. That is not a hard run, it is a run whose seed decided the outcome |
| No two options in one step share a kind | The map hides contents, so a repeated kind is a duplicate button |
| The gym is never an option | It is not a choice, so it must not reach `chooseNode` — a policy asked to pick from a list of one records a decision the player never made |
| Every node carries a `tier` | Stage 1 writes `normal` and never displays it. Stage 3 keys reward pools to it, and retrofitting a field onto generated data would invalidate every seed recorded before the change |

## 5. What a seed does *not* fix

The seed fixes the map, the encounters and the PRNG for each battle. It does
not fix the run: the player's decisions do the rest. Two players on the same
seed making the same choices get the same run, turn for turn. Two players on the
same seed making different choices get different runs on the same map — which is
the property the whole thing exists for.

Consequently, a **`RunLog` is a seed plus a decision sequence and nothing else**
— no HP, no party, no map, no turn numbers. All of that is derived, and a log
that stores derived state is a log that can disagree with the engine that
produced it. `test/run-replay.test.ts` asserts the serialized log contains none
of those words, and that resuming from a save taken after *every* decision in a
run reproduces the original run exactly.

The log's `version` embeds the engine version, because a decision sequence is
only replayable against the mons, generation and sim it was recorded with.
Stage 0's logs carry a different version and are rejected with a message saying
so, rather than replayed into a plausible run the player never played.

## 6. The tuning, and how it was arrived at

`npm run sweep` plays N runs headless under three playstyles and reports what
happened. Any dotted `Tuning` path can be overridden on the command line:

```sh
npm run sweep                                        # 200 runs, shipped tuning
npm run sweep -- 500 stepsPerSegment.min=4           # 500 runs, shorter segments
npm run sweep -- 200 levelOffset.gym.min=0 levelOffset.gym.max=0
```

At the shipped tuning (60 runs per playstyle):

| playstyle | win | turns/fight | rests | HP at gym | reached gym |
|---|---|---|---|---|---|
| rest whenever offered | 62% | 1.8 | 4.0 | 94% | 92% |
| never rest | 35% | 1.6 | 0.2 | 35% | 52% |
| always take the trainer | 17% | 1.7 | 0.2 | 53% | 27% |

Read that as three claims: resting is worth a turn, attrition is what ends runs
rather than any single fight, and the trainer/wild choice already has teeth.

### The finding that changed the data

The first encounter pools gave every Pokemon its best move — Crunch, Close
Combat, Gunk Shot. The sweep measured fights lasting **1.5 turns at every level
spread tried**, from near-parity to a ten-level gap. At level 30 with 31 IVs and
no EVs, a fully evolved Pokemon's best move one-shots another fully evolved
Pokemon, so widening the level gap only changed *which* side did the
one-shotting.

Dropping the encounter kits to 40–70 BP is what actually bought a fight longer
than one turn. The level offsets then set the difficulty on top of that.

### Still open after Stage 1

**Fights are short.** 1.8 turns is better than 1.5 and it is not yet a fight
with a shape — there is rarely a turn where the player is choosing between two
plausible moves. The remaining causes are structural rather than tuneable: no EV
or IV spreads (so bulk is at its floor), and one Pokemon a side (so there is no
switch to make and no reason to set up). Stage 4's party slots address the
second directly. Until then, the honest reading is that a Stage 1 node is a
short exchange whose outcome is mostly decided by the matchup, and the *run* is
the interesting unit rather than the battle.

**Segment length.** 6–8 steps at the shipped tuning takes a run to roughly
7 nodes and 12 turns of battle. That is short enough to replay and long enough
for the HP bar to matter. Whether it is *too* short is the thing to watch in
playtest; `stepsPerSegment` is one override away.
