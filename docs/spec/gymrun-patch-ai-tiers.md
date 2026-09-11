# GYMRUN: Opponent AI Tiers and the Sim Policy Ladder

Research brief plus Claude Code prompt. Paste Part 3 into Claude Code. Read Parts 1 and 2 yourself first, they contain the decisions.

---

## Part 1: What "normal" Pokemon AI actually is

Four reference families. All four agree on one thing that GYMRUN currently gets wrong: **difficulty is information and lookahead depth, never stat cheating**, and skill tiers are built by toggling features on one shared scorer rather than by writing a different algorithm per tier.

### 1. Score-stacking (Gen 3 vanilla, pokeemerald-expansion, Emerald Kaizo)

The canonical in-game model. Every move starts at a base score. A set of independent scoring modules runs over it, each adding or subtracting. Highest score wins, ties broken at random. The modules in Emerald are Basic, Strong, Expert, Risky, Doubles, Setup.

- **Basic (check bad move):** discourage moves that do nothing. Stat boosts at +6, heals at full HP, status on an already statused target, Earthquake into Flying.
- **Strong (try to faint):** encourage maximum damage, take a KO when one exists.
- **Expert (check viability):** per-move situational logic.
- **Risky:** assume the top damage roll, prefer low-chance strong effects.

Difficulty is expressed as a **flag set per trainer**, not as a difficulty slider. pokeemerald-expansion, which is what every modern difficulty hack is built on, ships two composite flags:

- `AI_FLAG_BASIC_TRAINER` = CHECK_BAD_MOVE + TRY_TO_FAINT + CHECK_VIABILITY. Described as "should feel like normal trainers."
- `AI_FLAG_SMART_TRAINER` = the above plus SMART_SWITCHING, SMART_MON_CHOICES, OMNISCIENT, SMART_TERA.

Two details worth stealing outright:

1. **Handicap flags are first-class.** `NEGATE_UNAWARE` (ignores ability suppression), `CONSERVATIVE` (always assumes the lowest damage roll), `SEQUENCE_SWITCHING` (sends out in party order, never switches mid-battle). Easy AI is built by *adding* handicaps, not by deleting logic.
2. **Scoring is deliberately nondeterministic.** The expansion docs say switch checks carry intentional failure rates "to keep the player from being able to predict perfectly." Vanilla Emerald has the same property inside its scoring functions. A perfectly deterministic hard AI becomes a puzzle to solve once, then stops being hard.

A third detail that matters for our randomizer: **vanilla AI does not cheat.** It records the moves, abilities and items it has actually seen the player use, and it forgets all of it when the player switches out. That is a clean knowledge axis to tier on.

### 2. Pokemon Essentials skill tiers

Five tiers keyed to a numeric skill level on the trainer type: wild (uniform random over known moves, no calculation at all), then bands at 1-31, 32-47, 48-99, 100+. Higher tiers "have access to more information and improved calculations." Wild Pokemon picking uniformly at random is the explicit floor.

Confirms the same shape from a different lineage: tiers are cumulative, a high tier is also every tier below it, and the axis is information plus calculation.

### 3. Showdown bot baselines (poke-env)

The de facto research baselines, and the direct comparison to our sim policies:

| Baseline | Behaviour | poke-env internal rating |
|---|---|---|
| `RandomPlayer` | random legal action | 1 |
| `MaxBasePowerPlayer` | highest base power move, every turn | 7.67 |
| `SimpleHeuristicsPlayer` | weighted heuristic sum | 128.76 |

`SimpleHeuristicsPlayer` is the single most useful artifact here because it is short, readable, and close to what a competent casual human does. Its actual algorithm:

- **Matchup estimate** between two mons: best type multiplier my types get on them, minus best multiplier their types get on me, plus or minus `0.1` for the speed tier, plus `0.4 * my HP fraction`, minus `0.4 * their HP fraction`.
- **Switch out** if a switch-in scores positively AND one of: a defensive stat at -3 or worse, the relevant attacking stat at -3 or worse, or the current matchup below `-2`.
- **Stat estimation** folds boost stages into the comparison rather than reading raw stats.
- **Hazards** get set when the opponent has 3 or more mons left, removed when 2 or more of ours remain.
- **Setup** only at full HP and a positive matchup, only moves granting 2 or more total stages.
- **Move score** = base power x 1.5 if STAB x (atk/def or spa/spd ratio) x accuracy x expected hits x type multiplier.

That last line is the one to port. Our greedy AI is missing accuracy, expected hits, the attack-to-defence stat ratio, and boost stages.

### 4. Lookahead and minimax

The PokeChamp paper's Gen 9 OU table is the cleanest published skill ladder:

| Method | Elo |
|---|---|
| Random | 399 |
| Max Power | 885 |
| PokeLLMon (GPT-4o) | 1020 |
| One Step Lookahead | 1107 |
| Abyssal (Showdown's strong bot) | 1117 |
| PokeChamp (GPT-4o minimax) | 1268 |

**The load-bearing number: max-base-power to one-step lookahead is a 222 Elo jump.** One step of lookahead, meaning score your move against the opponent's best reply rather than against the current board, buys more than every heuristic refinement combined and roughly matches a purpose-built bot.

---

## Part 2: What this says about GYMRUN

### Hypothesis 1: our benchmark is measuring the wrong player

`--policy greedy` is a max-damage picker. On the ladder above that is the 885 rung, two rungs below a competent human and 222 Elo below a one-step lookahead. Every balance figure we have, including mean gyms cleared 4.873 at 400 seeds prefix RETUNE, is the score of a bot that throws away winnable fights.

**What would disconfirm it:** build the lookahead policy first, before touching opponent AI, and re-run at the same seed prefix and seed count. If mean gyms cleared jumps by more than about one full gym, the gyms are not too hard and the scaling tables are tuned against a weak proxy. If it moves by less than half a gym, difficulty is real and lives in `scaling.ts`, and the AI work is a feel improvement rather than a balance fix.

Supporting evidence already on file: the priority/speed AI patch narrowed the greedy-to-random gap by 0.15. A skill gradient that small is a sign that neither policy is exercising the decisions the game offers.

### Hypothesis 2: full randomization breaks the standard heuristics

`SimpleHeuristicsPlayer` estimates matchups from **species types**, and assumes STAB moves exist. Under full move and ability randomization both assumptions are fiction. We already learned this twice: the playtest round 2 effectiveness hint was reading species typing instead of per-move typing, and the 4.7 archetype labels derive from base stats only and "lie sometimes under full move randomization."

So the port is not a copy. **Every matchup estimate must read the mon's four actual slotted moves, not its species types.** Defensive typing still reads off species. Offensive capability must read the moveset. This is a real divergence from the reference implementations and it should be written down where the next person will find it.

### Hypothesis 3: the difficulty complaint is a send-in problem, not a move-choice problem

Gyms field multiple mons against a party. If the opponent sends out in party order and never switches, gyms are easier than they look. If the opponent switches well, gyms are much harder. We do not currently know which we have. That is question 2 in the report section below and it should be answered before any scoring work, because the size of the effect dwarfs move choice.

### Decisions that need to be made

1. **Where each tier lands.** Proposal: easy on early wilds and normal-tier trainers, medium on hard-tier trainers and gyms 1-4, hard on elite-tier trainers and gyms 5-8. This makes tier mean something in battle and not only in the reward pool, which is the Stage 3 risk gradient finally paying out on both axes.
2. **Whether AI tier is visible.** It should be. "Trainer" vs "Ace Trainer" vs "Gym Leader" as an attribute on the node card is a readout, not a verdict, and it is what makes an elite node a legible choice. Part 4 editorial rule permits it.
3. **`aiVersion` becomes a real version axis.** AI choice affects battle outcome, which affects run outcome, so a replayed log diverges if the AI changes. The versions block from the contentHash work already guards four axes. This adds a fifth and forces a `RUN_LOG_VERSION` bump. Confirm before building.
4. **Keep or revert the overnight priority/speed patch.** This work supersedes it. Recommendation: keep it and fold it in as a medium-tier feature rather than reverting, since priority awareness is exactly what `TRY_TO_FAINT` does in the reference implementations.

---

## Part 3: Claude Code prompt

### PROMPT

You are building the **AI tier system** for GYMRUN. Read `docs/spec/pokerun-build-spec.md`, `docs/generation.md`, `docs/balance.md`, and the existing `src/core/battle/ai.ts` and `src/core/battle/driver.ts` before writing anything.

Today there is one opponent AI, a greedy damage maximiser, used by every wild Pokemon, every trainer, and every gym leader. That is the 885-Elo rung of the published skill ladder and it is both too weak to make gyms feel authored and too uniform to make node tier mean anything in battle. This patch replaces it with one scorer plus three cumulative feature tiers, and adds a matching policy ladder on the player side of the simulator so we can finally measure our own skill gradient.

Existing rules hold. `core/` never imports from `ui/`. No `Math.random`. Every balance or copy number a tuning pass would touch lives in `data/`. The Part 4 editorial rule governs all copy: the UI presents attributes, never verdicts.

#### Report before you write any code

Five questions. Stop and report all five. Do not proceed until reviewed.

1. **What does `ai.ts` actually score today?** List the inputs it reads. Confirm specifically whether it accounts for accuracy, expected hits for multi-hit moves, the attacker's Atk or SpA against the defender's Def or SpD, current stat boost stages, and the opponent's held item. Report what the overnight priority/speed patch added and whether it is merged on the branch you are on.
2. **Does the opponent switch, ever?** Report the send-in rule after a KO and whether mid-battle switching exists at all on the AI side. This is the largest single lever on gym difficulty and we do not know its current state.
3. **What does the AI know about the player's mon?** Does it read the player's full spec from run state, or only what the battle protocol has revealed? If it reads run state directly it is already omniscient by accident, which means the knowledge axis below is a restriction rather than an addition.
4. **Where does AI randomness come from today, if anywhere?** Tiebreaks and intentional failure rates both need rolls. Report whether the AI can draw from the battle's own seeded PRNG. Keyed structural streams are wrong for this: the seeds doc forbids keys that vary with player behaviour, and AI rolls depend on turn state. Propose the draw site and justify why replay determinism survives.
5. **Is `aiVersion` in the run log versions block?** The register says `AI_VERSION` exists and is unguarded and `RunLog` has no field for it. Confirm against the tree after the contentHash work landed, and report what a bump costs.

#### Order of work, stop for review after each

1. Report questions. No code.
2. **Player-side policy ladder first.** `--policy heuristic` and `--policy lookahead`. Benchmark run at the pinned prefix and seed count. This is the disconfirmer for the whole patch and it comes before any opponent work.
3. Scorer refactor: one scoring pipeline, feature-gated, behaviour byte identical to today with the medium feature set enabled. Prove it.
4. Tier definitions, `data/ai.ts`, tier assignment by node tier and segment.
5. Switching and send-in logic, gated to hard tier.
6. Benchmark run, report, no retune.
7. UI: opponent tier shown as an attribute on the node card and the battle panel.

#### The scorer

One function, one pipeline, in `core/battle/ai.ts`. Every tier runs the same code with a different `AiFeatures` set. Do not write three scorers.

```ts
type AiFeature =
  | 'avoidFailingMoves'    // immunities, +6 boosts, heal at full, status on statused
  | 'takeTheKo'            // prefer a move that faints, prefer priority when slower and dying
  | 'fullDamageModel'      // accuracy, expected hits, stat ratio, boost stages, STAB, item
  | 'hpAware'              // no heals at high HP, no setup at low HP, no status into a nearly dead target
  | 'oneStepLookahead'     // score against the opponent's best expected reply
  | 'smartSendIn'          // choose the send-in after a KO by matchup
  | 'smartSwitching'       // switch out mid-battle on a bad matchup
  | 'seenKnowledge'        // remembers moves, ability, item actually observed this battle
  | 'fullKnowledge';       // reads the player's full spec

type AiTier = 'easy' | 'medium' | 'hard';
```

Tiers are cumulative, as in every reference implementation. Definitions live in `data/ai.ts`, not in code:

- **easy** = `avoidFailingMoves` only, plus a high noise value. Never switches, sends out in party order. This is the handicapped tier and it is built by adding restrictions, not by removing code paths.
- **medium** = easy plus `takeTheKo`, `fullDamageModel`, `hpAware`, `smartSendIn`, `seenKnowledge`. This is the "normal trainer" rung and it should land near the reference `SimpleHeuristicsPlayer`.
- **hard** = medium plus `oneStepLookahead`, `smartSwitching`, `fullKnowledge`.

**Hard tier gets no stat advantage of any kind.** No damage roll bias, no extra accuracy, no hidden HP. If hard is not hard enough, that is a scaling table problem, exactly as every prior stage has handled it.

#### The damage model

Port the reference move score, adapted for full randomization:

```
score = basePower
      * (STAB ? 1.5 : 1)
      * (physical ? estAtk/estDef : estSpA/estSpD)
      * accuracy
      * expectedHits
      * typeMultiplier(move.type, defender.types)
```

`estStat` folds boost stages in the standard way: stages above zero multiply by `(2 + stages) / 2`, stages at or below zero multiply by `2 / (2 - stages)`. Read boost stages off the battle state, not off the spec.

**The randomizer divergence, and it must be commented in the code.** The reference implementations estimate a matchup from species types and assume STAB moves exist. Under full move randomization that is false. Offensive capability is read from the mon's four slotted moves. Defensive typing is still read from species. Write this into `docs/engine-notes.md` next to the gender finding, because it will be rediscovered otherwise.

#### Matchup estimation

Used by `smartSendIn` and `smartSwitching`. One pure function in `core/`, unit testable, no RNG:

```ts
estimateMatchup(mine: PokemonState, theirs: PokemonState): number
```

- best type multiplier across **my damaging moves** against their types, minus best multiplier across **their known damaging moves** against my types, falling back to species types for whatever is unknown at the current knowledge level
- plus or minus a speed coefficient, in `data/ai.ts`, starting at `0.1`
- plus `hpCoefficient * myHpFraction`, minus `hpCoefficient * theirHpFraction`, starting at `0.4`

Switch out when a positive-scoring switch-in exists and the current matchup is below `data/ai.ts`'s threshold, starting at `-2`.

#### Noise, and why it is not optional

Reference AIs are deliberately nondeterministic. The expansion docs say switch checks carry intentional failure rates so the player cannot predict perfectly. A fully deterministic hard AI gets solved once and stops being hard, which is directly against the "learn the system and improve at it" axis in the design framework.

- Every tier carries a `noise` value in `data/ai.ts`: the probability of taking a move other than the top-scored one, weighted by score.
- Easy is high noise, medium moderate, hard low but **not zero**.
- Switch decisions on hard tier carry their own independent failure rate.
- All of it draws from the battle's seeded PRNG per the answer to report question 4. Replay determinism is absolute and is not negotiable against this.

#### Tier assignment

In `data/ai.ts`, keyed by node tier and segment index, no logic in the generator:

| Encounter | Tier |
|---|---|
| Wild, any tier | easy |
| Trainer, normal | easy |
| Trainer, hard | medium |
| Trainer, elite | hard |
| Gym, segments 1-4 | medium |
| Gym, segments 5-8 | hard |

This is a starting table, to be moved by the report. It is also the first time node tier changes how a fight plays rather than only what it pays, which is worth saying in the commit message.

#### Player-side policy ladder

Step 2 of the order of work, and the disconfirmer for this entire patch.

- `--policy heuristic`: the medium feature set, applied to the player side. Deterministic, no noise, heuristic documented in a comment per the standing rule.
- `--policy lookahead`: heuristic plus `oneStepLookahead`.
- `--policy greedy` stays exactly as it is. It is the historical baseline and every figure in `docs/balance.md` is keyed to it. Do not change it and do not rename it.

Report mean gyms cleared for random, greedy, heuristic and lookahead at the same prefix and seed count. **The spread between them is the game's skill gradient and it is the number this whole patch exists to produce.** If heuristic and greedy are within 0.3 gyms of each other, say so plainly in the report, because it would mean the battles do not reward skill and the problem is upstream of the AI.

Per the standing rule: record the numbers, do not stop to retune.

#### Determinism and versioning

- AI choice affects battle outcome, so a log replayed under a different AI diverges. `aiVersion` goes in the run log versions block as an additional guarded axis. Bump `RUN_LOG_VERSION`. A pre-patch log throws with a message naming the mismatch.
- `contentHash` moves, because `data/ai.ts` is a new data table. Add it to the hash composition and to the list in `docs/generation.md` section 9. While there, resolve the glob-versus-explicit-list contradiction recorded in the v5 unblock audit rather than adding a line to a list that is already wrong.
- No new keyed streams. No new structural draws. Map generation is untouched, so `previewRun` output is byte identical for every seed and that is a test.

#### Tests required

1. The medium feature set reproduces current AI behaviour exactly on a fixed seed, before the tier tables are wired in. This is the refactor safety net and it comes first.
2. Feature gating: a scorer with only `avoidFailingMoves` never selects a move the defender is immune to, over many seeds.
3. `takeTheKo`: given a lethal move and a stronger non-lethal move, the AI takes the lethal one. Asserted against the submitted choice.
4. Damage model: accuracy and expected hits both change the ranking in a case constructed so that base power alone would rank differently.
5. Boost stages are read from battle state, proven by a case where a +2 attacker and a +0 attacker with identical specs choose differently.
6. `estimateMatchup` is pure, reads slotted moves for offence and species types for defence, and returns identical output for identical input.
7. Knowledge levels: a `seenKnowledge` AI does not act on a move the player has not used yet; a `fullKnowledge` AI does. Same seed, same board, different choice.
8. Noise at zero is deterministic; noise above zero is reproducible for a fixed seed and draws nothing from any structural stream.
9. `previewRun` output byte identical for a sweep of seeds. Map generation is untouched.
10. Version guard: a pre-patch log throws on replay with a message naming the axis and both values.
11. Stream isolation and determinism suites pass unchanged. All existing suites pass, except those asserting single-AI behaviour, updated with a comment naming this patch rather than deleted.

#### Out of scope

Doubles. Terastallization. Minimax beyond one step. Any AI that reads the run log, the map, or anything outside the current battle. Scaling table retunes. Everything in Stage 5. The tutorial. Do not touch `data/scaling.ts` in this patch even if the report says the gyms are mistuned, because a scaling change and an AI change landing together makes the next report unattributable.

#### Definition of done

Four policies produce four distinguishable mean-gyms-cleared figures at the same prefix. A wild Pokemon plays visibly worse than a route trainer, and an elite trainer plays visibly better. A gym leader in segment 7 switches out of a bad matchup and sends in something that answers what just came out. No opponent anywhere has a stat, a damage roll, or a piece of information that the same tier on the player side would not have. And the report says, in one sentence, whether the gyms were ever too hard or whether we were just measuring them with a bad bot.
