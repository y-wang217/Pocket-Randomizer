# AI tiers: the report before any code

**Branch** `claude/friendly-heisenberg-6m0986`. **Prompt**
[`../spec/gymrun-patch-ai-tiers.md`](../spec/gymrun-patch-ai-tiers.md), committed
verbatim at `5e3e201` before this was written. Nothing has been built.

Stamps at the time of reading: `RANDOMIZER_VERSION` `gymrun-randomizer-13`,
`RUN_LOG_VERSION` `gymrun-run-13/gymrun-0.3.0`, `AI_VERSION`
`gymrun-ai-3-priority`, `contentHash` `b022fc4e…`.

**The headline, before the five answers.** Four of the five questions have
answers that contradict the brief's picture of the tree, and two of them change
what the patch should build:

1. The AI is **not** missing accuracy, expected hits, the attack-to-defence
   ratio or boost stages. It has all four, because it does not use a heuristic
   damage proxy at all — it calls `@smogon/calc`. The one thing on the brief's
   list it genuinely lacks is the **held item**. Porting
   `SimpleHeuristicsPlayer`'s move score as written would be a **downgrade**.
2. The opponent **already switches**, voluntarily and on a scored comparison
   against every move, and **already chooses its send-in by matchup** rather
   than in party order. Measured this afternoon: 0.46 opponent voluntary
   switches per battle. Hypothesis 3 is disconfirmed. `smartSendIn` and
   `smartSwitching` are not additions; **easy tier's `SEQUENCE_SWITCHING` is a
   subtraction, and it is the single largest balance mover in the patch.**
3. `aiVersion` is already in the versions block and already guarded on all four
   axes. This patch's version cost is **one string**, not a `RUN_LOG_VERSION`
   bump. The register's scope correction is stale and should be closed.
4. `contentHash` is a **glob** over `src/data/**`. `src/data/ai.ts` is hashed
   the day it lands and there is no list to add it to. The
   glob-versus-explicit-list contradiction the prompt asks to resolve was
   resolved on 2026-09-11, in the glob's favour.

---

## 1. What `ai.ts` actually scores today

### Its inputs, exhaustively

`decide(view)` reads **`BattleView` and nothing else**. There is no other
argument and no import from run state. What the view carries:

| source | fields the AI reads |
|---|---|
| `view.me` (own active) | species, level, types, hp, maxHp, status, **all five stat stages**, `baseSpeed`, ability (own side reveals it) |
| `view.foe` (foe active) | species, level, types, hp, maxHp, hpFraction, status, stat stages, `baseSpeed`, **`ability` is always `null`** |
| `view.moves` (own) | slot, name, type, category, basePower, **accuracy**, pp, usable, **priority** |
| `view.switches` (own bench) | species, level, types, ability, **move ids**, hp, maxHp, hpFraction, status, usable, block |
| `view.speed` | both sides' Speed after stages and paralysis |
| `view.forceSwitch`, `view.trapped`, `view.awaitingChoice` | legality |

Damage is **not** a formula in this file. `expectedDamageOf` builds both bodies
as `@smogon/calc` `Pokemon`s and takes the **midpoint of `calculate(...).range()`**,
falling back to raw base power only when the calc throws on a combination it
does not model.

### The brief's checklist, item by item

| the brief asks | today | where |
|---|---|---|
| accuracy | **yes, explicitly** — `offense` is multiplied by `accuracy/100`, and the kill bonus is multiplied by it too, so a 70%-accurate knockout does not outrank a certain one on a coin flip | `scoreMove` |
| expected hits | **yes, inherited** — `damageRange` sums the per-hit ranges, and `@smogon/calc` defaults a 2-5 hit move to `multihit[0] + 1` = **3 hits**. Not our model, and slightly under the true 3.167 expectation, but present | `@smogon/calc` `result.js`, `move.js` |
| Atk/SpA vs Def/SpD | **yes, and better than the ratio the brief wants** — the calc runs the real damage formula over real stats, which the fixed spread (Serious, 31 IVs, 0 EVs) makes exact rather than estimated | `toCalcPokemon` |
| current stat boost stages | **yes, off battle state** — `toCalcPokemon` copies `active.statStages` into the calc's `boosts`, for both bodies, every turn. This is already the prompt's stated requirement ("read boost stages off the battle state, not off the spec") | `toCalcPokemon` |
| the opponent's held item | **no** — and neither side's. `item` is not on `ActiveView` or `SwitchView` at all, and no item is passed to the calc | `core/types.ts`, `toCalcPokemon` |

STAB is likewise handled by the calc rather than by a 1.5 multiplier we apply.

**So `fullDamageModel`, as specified, is a regression.** The formula in the
brief is `SimpleHeuristicsPlayer`'s proxy *for* a damage calculation, written
because poke-env has no calc on hand. We have the calc. Recommendation, and the
first thing needing a ruling:

> **Redefine `fullDamageModel` as "the calc-based estimate", i.e. what ships
> today, and build `easy` by taking it away** — a base-power × type-multiplier
> estimate with no stat ratio, no boosts and no accuracy. Tiers stay cumulative
> and the handicap stays a handicap. Do not port the reference formula.

### Two defects found while reading, neither in scope but both worth recording

- **The foe's ability is `null`, so the calc silently substitutes the
  species' default ability.** Under full ability randomization that is usually
  the wrong ability, and it is wrong in an uncontrolled direction: a Gengar the
  randomizer gave Cursed Body is calculated as though it had Levitate, so a
  Ground move reads as a 0× no-op that would in fact land. This is not the
  honest-ignorance the header describes — ignorance would be *no* ability. It
  is the AI acting on a fact that is false.
- **The threat probe's comment and its code disagree.** The header says "a
  generic 80 BP attack of each of its types"; `probeFor` builds it at
  `basePower: 65`. One of the two is a typo and the number is load-bearing for
  every switch decision in the game.

### The priority patch

`gymrun-ai-3-priority`, overnight Branch 2, **merged and on this branch** (it
is in the tree at `src/core/battle/ai.ts` and its version string is live).
It added `MoveView.priority`, `BattleView.speed` and `core/battle/speed.ts`,
and one layer in front of the greedy pick: take a priority move when slower or
tied and facing a knockout (fires on 3.1% of turns), or when a priority move
knocks out where a slower one also would (1.1%). It fires on 4.2% of
AI-decided turns and changes the pick on 3.4%. It cost 0.088 mean gyms and
narrowed the greedy-to-random gap by 0.15 — `balance.md` section 15.

**Recommendation: keep it, and fold it in as the `takeTheKo` feature**, which
is what Part 2 decision 4 proposes and what `TRY_TO_FAINT` is in the reference
implementations. That also closes the morning keep/retune/revert decision the
handoff carries, in the keep direction, with this patch as the reason.

---

## 2. Does the opponent switch? Yes, on both axes, since Stage 4

This is the answer the brief calls the largest single lever, and the tree has
had it for two stages.

**Send-in after a knockout.** Not party order. `scoreForcedSwitch` scores every
legal bench member and takes the best: its best damaging move against the
foe (read from `SwitchView.moves`, the member's **actual slotted moves**),
against what the foe threatens it with, converted to turns of advantage by
`matchupQuality`, plus a bulk term. Three things are deliberately dropped on a
forced switch — the turn cost, the current matchup, and the `-Infinity` for
dying on arrival — because none of them applies when there is no alternative.

**Voluntary mid-battle switching.** `scoreSwitch` scores every bench member on
**the same scale as every move**, so "should I switch?" is never asked
separately from "what would I do instead?". A switch is worth the difference
between two races minus the turn it spends; a member that would die on arrival
scores `-Infinity` and is never chosen, as a hard rule rather than a penalty.

**Measured, not inferred.** 40 seeds, prefix `RETUNE`, node policy `rest`,
`gymrun-ai-3-priority`, both sides greedy
(`sim-reports/2026-09-11T18-01-50-397Z-gymrun-randomizer-13-40.json`):

| | per battle |
|---|---|
| opponent voluntary switches | **0.464** |
| player voluntary switches | 0.781 |
| battles containing at least one switch | 50.8% |

So gyms are **not** easier than they look for want of switching. What is
missing is not the mechanism but its information: the switch-in matchup is
estimated against the foe's **types**, through one generic probe move per type,
because `BattleView` carries no foe moves. That is the honest bound the header
argues for, and it is exactly the axis the knowledge tiers should move.

**What `easy` therefore costs.** `SEQUENCE_SWITCHING` on every wild and every
normal-tier trainer removes a behaviour those fights have today. Under the
brief's tier table that is the **majority of all battles in a run** (`nodeWeights`
gives wild 5 and trainer 3 of 13, and normal is the most common tier in every
band). It will move the benchmark on its own, in the player's favour, and it
will move it further than anything else in this patch.

> **Recommendation: benchmark step 4 (tier assignment) separately from step 5
> (switching changes), so the easy-tier handicap has its own recorded delta.**
> Landing both under one report makes the number unattributable, which is the
> same argument the prompt makes for keeping `data/scaling.ts` out.

Also worth carrying into the report at step 6: `balance.md` section 7.6 measured
switching as **worth nothing to the player** (`switch-aware` 9.7% vs
`no-switch` 10.6% at 1000 seeds). If switching does not pay for the player, an
easy tier that cannot switch may cost the opponent less than it looks.

---

## 3. What does the AI know about the player's mon?

**Strictly less than the brief assumes. It is not omniscient by accident — it
is below `seenKnowledge`.**

`BattleView` is the only input, and it is built by `buildView` under a
deliberate restriction (`toActiveView(foe, /* revealAbility */ false)`):

- the foe's **moves are not in the view at all**, in any form
- the foe's **ability is `null`**, always
- the foe's **bench does not exist** in the view
- **no item**, either side
- no run state, no map, no log — `playNode` hands the policy a view and nothing else

And nothing tracks reveals. There is no record of what the player has actually
used this battle, so today's AI is not a forgetful `seenKnowledge` bot; it is a
bot that never learns anything within a battle either.

Consequences for the knowledge axis, and both need a ruling before step 3:

1. **`seenKnowledge` is new construction, not a restriction.** It needs a
   reveal tracker fed from the protocol the driver already splits per side
   (`protocol.p1` / `protocol.p2`), carried into the view as a new optional
   block. That is a `BattleView` shape change, which `ui/` also consumes.
2. **`fullKnowledge` needs a privileged channel that does not exist**, because
   the foe's spec is deliberately not reachable from a view. It would be built
   in the driver and handed only to a policy declared hard.
3. **The definition of done's symmetry clause is at risk by construction.** "No
   opponent anywhere has a piece of information that the same tier on the
   player side would not have" is only satisfiable if `--policy lookahead`
   gets the identical `fullKnowledge` construction on the player's side. That
   must be built in step 2, not retrofitted.

---

## 4. Where AI randomness comes from, and where noise should draw from

**Today: nowhere. There are zero draws in `ai.ts`.** `bestOf` breaks ties
toward the earlier entry, and the file says why — "an unspecified tie-break
would make a seed stop reproducing the same battle".

The constraint the brief does not know about, and it decides the answer:

> **The opponent's choices are not recorded in the run log.** `playNode` records
> the player's choices only, on the stated grounds that "the opponent is a
> deterministic policy over a view it is handed". A replayed run **re-runs the
> opponent AI**. So opponent noise must be a pure function of something the log
> already fixes.

Three candidate draw sites, two rejected:

- **The battle's own PRNG (`battle.prng`) — rejected.** Every value the AI took
  is a value the engine then does not get, so the damage rolls of the battle
  would move. Worse, `replayBattleLog` feeds recorded decisions for *both*
  sides and never runs the AI, so the battle-level replay would consume a
  different number of rolls than the original and `test/replay.test.ts`'s
  byte-for-byte protocol assertion would break.
- **A keyed structural stream — rejected**, and the prompt is right about why.
  An AI roll's position depends on the turn, and the seeds document forbids a
  key that varies with player behaviour. It would also add draws to a stream
  that map generation reads, moving every recorded seed.

**Proposed: a per-battle AI PRNG, seeded from the battle's `simSeed`.**

- Every battle node's `simSeed` is drawn **at map generation**, under `nodeKey`,
  on the `battle` stream. It is fixed by the run seed, identical on replay, and
  varies with nothing the player does.
- The AI opens its own sequence from `(simSeed, 'ai-noise', side)` — a plain
  `createRng`-style derivation over strings, not a new keyed stream on the run
  seed — and advances it once per decision.
- **Structural draws: none added.** No new key, no new stream, no extra draw on
  an existing one. `previewRun` output is byte identical, which is the prompt's
  test 9, and it holds by construction rather than by measurement.
- **The sim's PRNG: untouched.** Every damage roll and every crit is exactly
  what it is today.
- **Replay determinism:** a run replay re-runs the opponent from the same
  `simSeed`, against the same view sequence (the player's decisions come out of
  the log), so it draws the same values in the same order and submits the same
  choices. A battle-level replay never runs the AI at all, so it is unaffected.
- It must **not** borrow the `policy` stream under `SIM_POLICY_KEY`. That
  belongs to the simulator's scripted bots; a game system sharing it would make
  the random bot's win rate a function of the opponent's tiebreaks.

Seam: `run.ts` has `node.encounter.simSeed` in hand at the call site, so the
opponent stops being one module-level policy and becomes one built per node —
`options.opponent` gains a per-node form, defaulting to today's behaviour.

---

## 5. Is `aiVersion` in the run log versions block?

**Yes. It landed with the `contentHash` work and it is guarded.** The register's
scope correction ("`AI_VERSION` is guarded nowhere, and guarding it is a log
version bump") describes a tree that no longer exists.

What is in the tree:

- `RunLog.versions` is `{ runLog, contentHash, aiVersion, randomizerVersion }` (`core/types.ts`).
- `VERSION_AXES` lists all four; `versionMismatch` checks them in order and
  names the axis and both values; `assertReplayable` throws on the first miss.
- `run.ts` stamps `aiVersion: AI_VERSION` into every log.
- `test/ai-priority.test.ts` already asserts that a `gymrun-ai-2-switching` log
  is refused with `mismatch on aiVersion`.

**What a bump costs this patch: one string.** `AI_VERSION` becomes
`gymrun-ai-4-tiers`; the guard picks it up; a pre-patch log is refused by name.
No schema change, so **`RUN_LOG_VERSION` does not move** and should not be
moved — the guard asks whether the logged *questions* changed, and the player is
asked exactly the same questions in the same order. The prompt's instruction to
bump it is written against the pre-`contentHash` tree; the deviation goes in
`generation.md` per protocol 4.

**`contentHash`:** nothing to do. It is a glob over `src/data/**` minus one
exclusion list, computed at build time; `src/data/ai.ts` is hashed the day it
lands. The glob-versus-list contradiction the prompt asks to resolve **was
resolved on 2026-09-11** (`generation.md` section 9, "Decided: a glob over
`src/data/**`"), and the workflow it states is explicit: "a balance file under
`src/data/` needs nothing". The hash *will* move, which correctly refuses seeds
shared across this patch.

---

## Rulings needed before step 2 starts

1. **`fullDamageModel` is redefined as the calc estimate, and `easy` is built by
   subtraction.** Do not port `SimpleHeuristicsPlayer`'s formula over a real
   damage calculation.
2. **`smartSendIn` and `smartSwitching` already exist at every tier.** The
   patch's real work on this axis is (a) the easy-tier handicap, which is a
   removal, and (b) making hard's switching read revealed moves rather than a
   type probe, plus its own failure rate. Step 4 and step 5 get separate
   benchmark rows.
3. **`estimateMatchup` versus the existing `matchupQuality`.** Two matchup
   models in one scorer is the "two scoring paths would be two AIs" failure the
   file's own header warns about. Recommendation: `estimateMatchup` is added as
   the pure, unit-testable **gate** the prompt specifies (send-in and
   switch-out thresholds, its coefficients in `data/ai.ts`), and
   `matchupQuality` stays the **exchange rate** inside the score. One of them
   decides *whether*, the other decides *how much*. If that split is not wanted,
   say so now, because consolidating afterwards is a rewrite.
4. **`fullKnowledge` symmetry.** Confirm that `--policy lookahead` gets the
   identical knowledge construction on the player's side, built in step 2.
5. **`RUN_LOG_VERSION` does not bump.** Confirm, and the deviation is recorded
   rather than the prompt edited.
6. **Expect `heuristic` ≈ `greedy`, and do not misread it.** The brief's
   `--policy heuristic` is "the medium feature set applied to the player side",
   and the player-side `greedy` bot in the simulator **is** `decide(view)` — the
   same call. Given answers 1 and 2, the medium feature set is very close to
   what `greedy` already does, so the two will land near each other **by
   construction**, not because the battles fail to reward skill. The clause in
   the prompt that reads a sub-0.3-gym gap as "the problem is upstream of the
   AI" would be the wrong conclusion here. **The real disconfirmer is
   `lookahead` versus `greedy`**, and that is the number step 2 exists to
   produce.

## And the one-sentence answer the definition of done asks for, provisionally

It cannot be given before step 2's benchmark, but the shape of it is already
visible: the brief's premise that we have been measuring the gyms with an
885-Elo max-damage bot is **wrong** — the bot has a full damage calculation,
boost-aware stats, accuracy weighting, priority awareness, matchup-scored
send-ins and voluntary switching — so if `lookahead` moves the number by a gym
or more, the gain is lookahead alone, and if it does not, the 4.873 figure is a
real reading of the difficulty curve rather than an artefact of a weak proxy.

---

# Part 2: what was built, and what it measured

Written after the work, below the report the rulings were made on. The report
above is not edited: it is what was known before the code.

## The six rulings, and where each one landed

| ruling | built |
|---|---|
| 1. `fullDamageModel` withdrawn; easy built by subtraction; `itemAware` its own flag | `crudeDamage` is a handicap flag, easy holds it, `itemAware` is additive at medium and up. `data/ai.ts` |
| 2. Fix the null-ability substitution first, alone, with its own row | `829c42e`, `AI_VERSION` `-4`, row R1. Worth +0.0125 gyms |
| 3. `fullKnowledge` cut; `seenKnowledge` is the real work | `core/battle/knowledge.ts`, folded from the protocol, forgotten on switch out |
| 4. Easy tier's sequence switching lands alone, with gym-entry HP beside it | Rows R4/R5, and the arrival readout is in every row from R0 on |
| 5. AI PRNG per battle from the node's sim seed | `createAiStream`, and the replay test that noise made load-bearing |
| 6. `greedy` pinned permanently; `AI_VERSION` in every stamp | `GREEDY_BASELINE`, and the AI column in `balance.md` section 0 |
| 7. Version findings accepted as reported | `RUN_LOG_VERSION` did not move; `contentHash` needed no list edit |
| 8. Threat probe: report which of 80 or 65 is intended, change neither | Below. Neither changed |

Order deviation: the flag seam landed **before** the lookahead row rather than
after, because building lookahead first would have meant writing it twice. The
ability fix still came first and still has its own row. `generation.md` section
13e.

## The three numbers that matter

**1. One step of lookahead costs 0.21 mean gyms.** The published ladder puts
this step at +222 Elo, the largest gap between any two rungs in the literature.
On our game it loses, broadly rather than at one gym. The strongest reading is
that it spends its gain on switching — it switches 5.9% more, and section 7.6
measured switching as worth nothing here. **The experiment that settles it:**
`lookahead` against `greedy` with the bench hidden on both sides. Not run, per
the standing no-retune policy; it is one command.

**2. The easy tier's sequence switching is worth nothing: +0.02 gyms.** My own
report predicted it would be the largest mover in the patch. It fired — the
opponent switches 62% more often without it — and changed neither the outcome
nor the party's HP on arrival. Switching does not pay for either side.

**3. The tier table as specified makes the game easier, by +0.50 gyms.** Sixty
percent of that is noise, which is the price of the unpredictability the design
argues for and is a first-guess number that has not been tuned. The other forty
percent is the flags, and it lands in the wrong place: gyms 5 and 6, the hard
tier, got **easier** by seven and three points, because the hard tier's one
distinguishing flag is the lookahead from finding 1.

So the definition of done is **half met and measured as half met**. A wild
plays visibly worse than a route trainer. An elite does not play visibly better
than the pre-patch baseline. That is the same open question as finding 1, and
nothing in `data/ai.ts` should move until the experiment above has run.

## The answer to the question the patch was asked

> Were the gyms ever too hard, or were we measuring them with a bad bot?

**Neither.** The bot was never the 885-Elo max-damage picker the brief assumed,
so there was no measurement error to recover; and the rung above it makes
things worse here, so there is no headroom above it either. The gyms are not
too hard: the pinned baseline clears 4.885 of eight and completes 39%.

What the patch found instead, in the readout added for ruling 4:

| gym | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| party HP on arrival | 96.7% | 92.3% | 94.8% | 92.5% | 92.7% | 92.5% | 93.0% | 92.9% |
| party level − gym level | +2.5 | +3.5 | +7.0 | +8.0 | +11.0 | +12.5 | +12.5 | **+13.5** |

**The party arrives at every gym at 93% health and, by gym 8, thirteen levels
above it, and the gap widens monotonically from segment 2.** The road costs
nothing and the curve never catches up. Every AI question in this patch is
downstream of that: a thirteen-level advantage decides fights before a move is
chosen, which is the most likely reason a better policy on either side moves
the number so little in either direction.

That is a `data/scaling.ts` question and this patch does not touch it, for the
reason the prompt gives: a scaling change beside an AI change makes the next
report unattributable. **It is the first thing the next report should look at**,
and the instrumentation to read it is now in every sweep.

## Ruling 8: the threat probe

`core/battle/ai.ts`, `probeFor`. The header says "a generic 80 BP attack of
each of its types, which is close to the average STAB move in the shipped
pools"; the code builds it at `basePower: 65`. **Neither was changed.**

What can be said from the tree, and the rest is for whoever wrote it:

- The comment's *justification* is checkable and points at 80: the shipped move
  pools' band structure puts the average damaging move above 65, and the
  sentence explains the number by that average.
- The code's 65 has been in every balance figure since Stage 4, so changing it
  to match the comment is a behaviour change with its own row, not a typo fix.
- The number is load-bearing: it is the whole threat estimate, and therefore
  every switch decision in the game, at every tier.

If the code is right, the fix is one word in a comment and belongs in a docs
sweep. If the comment is right, the fix is a balance change and belongs in its
own patch with its own benchmark row.

## What did not move

Map generation: no keyed stream opened, no structural draw added, `previewRun`
byte identical. `RUN_LOG_VERSION` unchanged at `gymrun-run-13`. `data/scaling.ts`
untouched. No opponent anywhere holds a stat, a damage roll, an accuracy bonus
or a hidden number — asserted in `test/ai-tiers.test.ts` as a closed list of
flags, so adding one means deleting that assertion on purpose.

## Gates, at the end of the patch

All absolute gates green on `302cded`, run after every fix above:

| gate | result |
|---|---|
| type check | clean |
| lint | clean |
| full suite | **109 files, 1424 tests, all passing** |
| strict trim (`GYMRUN_TRIM_STRICT=1`) | **109 files, 1424 tests, all passing** |
| build | ok |
| smoke run | passed |
| determinism, stream isolation, version guards | passing, and extended: `test/ai-tiers.test.ts` adds a replay assertion for a noisy opponent, which save-and-resume now depends on |

Balance is not a gate, per section 0 of `balance.md`. Every number this patch
produced is recorded there with its cause, and nothing was retuned.
