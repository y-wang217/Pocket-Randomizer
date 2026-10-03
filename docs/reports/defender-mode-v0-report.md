# Defender Mode v0: the pre-code report

Prompt: [`../spec/gymrun-defender-mode-v0-fun-test.md`](../spec/gymrun-defender-mode-v0-fun-test.md).
Filed 2026-10-03 on `claude/eager-turing-0059br`, from `main` at `47bd73f`.
**No file under `src/` or `test/` has changed.** This is step 1 of the order of
work, and the prompt makes it a hard stop.

Every claim below was read off the tree at `b2feec9` or measured by a throwaway
script against the installed `@pkmn/sim` 0.10.11. Sim paths are relative to
`node_modules/@pkmn/sim/build/cjs/`.

Section 9 lists what needs a ruling before step 2. Three of those items are
contradictions inside the prompt, or between the prompt and the tree. They are
not preferences.

---

## 1. Species carrying Fire, Psychic and Flying

The pool is `SPECIES_POOL`, 900 species. Removing `BLACKLISTED_SPECIES`
(Shedinja, Aegislash) leaves 898. A species counts if it carries the type in
either slot. "Final" means `!hasEvolution(entry)` (`data/evolution.ts:61`), the
same test Peck/Pluck would use.

### By species band, the whole pool

Cells are all/final. "Total" is every species in that band, of any type.

| band | Fire | Psychic | Flying | total |
|---|---|---|---|---|
| 0 | 19 / 0 | 26 / 1 | 25 / 1 | 304 |
| 1 | 17 / 0 | 8 / 2 | 21 / 7 | 154 |
| 2 | 9 / 9 | 25 / 24 | 29 / 27 | 221 |
| 3 | 23 / 22 | 15 / 15 | 17 / 16 | 199 |
| 4 | 2 / 2 | 1 / 1 | 4 / 4 | 20 |
| **all** | **70 / 33** | **75 / 43** | **96 / 55** | 898 |

### By segment, what is actually drawable

This uses the segment's `normal`-tier `speciesBandWeights` and the stage gate
`stageAllowedAt(entry, playerLevel)`, with the blacklist applied. It is the
filter `bandedSpeciesPool` (`core/randomizer.ts:413`) already uses. Brackets
split the count across the bands that segment draws from, in band order.

| seg | L | bands (weight) | Fire | Psychic | Flying |
|---|---|---|---|---|---|
| 0 | 15 | 0:5 1:1 | 26 / 0 [19+7] | 27 / 2 [25+2] | 38 / 7 [24+14] |
| 1 | 20 | 0:4 1:2 | 35 / 0 [19+16] | 30 / 2 [26+4] | 45 / 8 [25+20] |
| 2 | 26 | 0:2 1:3 2:2 | 39 / 4 [19+16+4] | 43 / 14 [26+4+13] | 66 / 26 [25+21+20] |
| 3 | 32 | 0:1 1:3 2:3 | 40 / 5 [19+16+5] | 52 / 20 [26+7+19] | 71 / 31 [25+21+25] |
| 4 | 38 | 1:2 2:3 3:2 | 46 / 29 [16+9+21] | 42 / 35 [8+22+12] | 64 / 47 [21+29+14] |
| 5 | 44 | 1:1 2:3 3:3 | 49 / 31 [17+9+23] | 47 / 40 [8+25+14] | 64 / 47 [21+29+14] |
| 6 | 50 | 2:2 3:3 4:1 | 33 / 32 [9+23+1] | 41 / 40 [25+15+1] | 47 / 44 [29+15+3] |
| 7 | 58 | 2:1 3:3 4:2 | 33 / 32 [9+23+1] | 41 / 40 [25+15+1] | 50 / 47 [29+17+4] |

What this means for the mode:

- **Every rank has enough to fill a draft.** Three distinct picks of three need
  9 species. The thinnest cell is Fire at rank 0 with 26.
- **Fire has no final-stage species in bands 0 and 1.** Through rank 1, every
  Fire mon can still evolve, so a Flying-badge rule would always give it Peck.
  That rule only matters for Flying, so this is not a problem, but it shows how
  lopsided Fire's curve is: almost nothing in band 2 (9), heavy in band 3 (23).
- **Psychic is thin in band 1** (8), which is half of rank 1's weight. A rank-1
  Psychic draft leans on band 0 regardless.
- **Overlaps.**
  - Fire/Flying: Charizard, Fletchinder, Talonflame, Oricorio.
  - Psychic/Flying: Natu, Xatu, Woobat, Swoobat, Sigilyph.
  - Fire/Psychic: Delphox, Armarouge.
- **Coverage from secondary types:**
  - Fire is 35 monotype of 70, so half its roster brings no coverage.
  - Psychic is 29 monotype of 75.
  - Flying is 2 monotype of 96, and 27 of its secondaries are Normal.

## 2. Crit ratio and Speed for one side only

**Yes. The mechanism is `Battle#onEvent(eventid, format, ...)`.**

- It is defined at `sim/battle.js:1073-1112` and accepts only a target with
  `effectType === 'Format'`. Handlers are stored on `battle.events` and found
  by `findBattleEventHandlers` (`battle.js:989-1008`) on every `runEvent`.
- They would be registered in `core/battle/driver.ts` right after
  `new Battle(...)` (`driver.ts:947`) and before `setPlayer`. That keeps
  `@pkmn/sim` inside the adapter.
- **Telling the sides apart:**
  - `ModifySpe` receives `(spe, pokemon)` and runs inside `Pokemon#getStat`
    (`pokemon.js:367`).
  - `ModifyCritRatio` receives `(critRatio, source, target, move)`
    (`battle-actions.js:1603`).
  - Both check `pokemon.side.id === 'p1'`.
- **Proven:** a p1-only `chainModify([4506, 4096])` gave
  `getStat('spe')` 55 against 50, and `getActionSpeed` 55 against 50. p1 moved
  first in 7 of 7 turns. `storedStats.spe` stayed at 50.
- The repo registers no handler today (`format.ts:52-54` only fetches
  `gen9customgame@@@!Team Preview`).

### Fire streak

- **Crit table** (`battle-actions.js:1603-1621`): `critMult = [0, 24, 8, 2, 1]`,
  and a move's `critRatio` defaults to 1. So +1 is 1/8, +2 is 1/2 and +3 is
  certain, exactly the prompt's numbers.
- **Where the streak lives:** an `AfterMove` handler counts consecutive uses of
  the highlighted slot in `pokemon.m`, the sim's free per-Pokemon bag
  (`pokemon.js:82`). `ModifyCritRatio` adds the count, capped at 3.
- **Resetting it:** `pokemon.m` is *not* cleared by `clearVolatile`
  (`pokemon.js:1242-1280`), so the reset on switch and faint is explicit, in
  `SwitchOut` and `Faint` handlers. A custom dex-free volatile does not work,
  because handler lookup re-fetches the condition from the dex by id
  (`battle.js:944`).
- **Prototype measurement:** over 200 seeds, the four uses critted at
  0.045 / 0.135 / 0.525 / 1.000, and a different move reset the rate to 0.045.
  **The prototype counted from 0, one step behind the spec**, so its uses 2 to
  4 are the spec's +1 to +3. The mechanism is sound and the offset is a
  one-line choice.
- **Asserting it against the protocol:**
  - The only crit line is `|-crit|` (`battle-actions.js:1765`), already parsed
    at `flags.ts:167`. No line carries the ratio.
  - Test 3 can assert "third use crits" deterministically, because +3 always
    crits.
  - For +1 and +2, the handler can emit `this.debug(...)`. Custom Game runs
    with `debug: true` (`config/formats.js:180`), so the ratio appears on the
    protocol as a debug line. That is what I propose to assert.
- **`AfterMove` does not fire for a move that never runs** (flinch, full
  paralysis, sleep). See ruling R7.
- **Badge eligibility should be fixed at battle start, from the spec's species
  types**, not from live types. Burn Up removes Fire mid-battle, and Soak or
  Forest's Curse rewrite types. A badge that switched off when a mon used Burn
  Up would be a surprise, not a rule.

### Flying Speed: what reads it today

| reader | source | shows 1.1x? |
|---|---|---|
| engine turn order | `getActionSpeed` | yes |
| `ActiveFacts.speed.engine` | `driver.ts:658`, `getStat('spe')` | yes |
| "faster" marker, `fasterSide` | `view.ts:991-996` | yes |
| stat view `effective` | `view.ts:869` | yes |
| stat block number at stage 0 | `ui/stat-block.ts:166` shows `facts.stats.spe` = `storedStats` | **no** |
| **AI turn-order read** | `ActiveView.baseSpeed` = `storedStats.spe` (`driver.ts:569`), via `speed.ts:87-90`, read at `ai.ts:742` and `ai.ts:1056` | **no** |
| AI damage bodies | `@smogon/calc` from species and level (`ai.ts:312-319`) | no; it does not use speed for order |

The prompt requires every Speed readout and the AI's Speed read to agree with
the sim. Two rows fail.

- **Do not switch the AI to `getStat('spe')`.** That would also pick up Scarf,
  weather abilities and Unburden in attacker mode, and change attacker AI
  output.
- **Proposed instead:** a per-Pokemon badge speed multiplier on `ActiveView`
  that is 1 everywhere in attacker mode, folded into `effectiveSpeed`, and the
  same factor in the stat block's stage-0 number. Attacker AI output stays
  byte-identical. Whether `AI_VERSION` moves for it is ruling R5.

## 3. A fifth move

**Not today. The adapter cuts it off silently.** Everything above and below the
adapter would accept one.

**Where it is blocked:**

- `toPokemonSet` is `moves: spec.moves.slice(0, 4)` (`driver.ts:103`).
  `describeSpecCard` shares it (`driver.ts:258`), so cards, PP and carry-over
  are all capped at 4.
- `MOVESET.slots = 4` (`data/scaling.ts:492`) drives the randomizer's draw
  loop and learn/replace (`party.ts:400`).

**What would carry it through:**

- **Sim:**
  - Custom Game sets `Max Move Count = 24` (`config/formats.js:186`).
  - The team validator is never run.
  - `Pokemon` builds one slot per `set.moves` entry (`pokemon.js:117-141`).
  - `chooseMove` accepts any index the request offers (`side.js:376-383`).
- **Proven with the slice bypassed:** `request.active[0].moves.length === 5`,
  `move 5` was accepted, and the protocol showed the move.
- **AI and view:**
  - `readMoves` (`driver.ts:683-705`) and `legalChoices`
    (`switching.ts:116-130`) iterate whatever is present.
  - Over a five-move view, `decide()` returned slot 5.
- **Battle UI:** `renderMoves` (`ui/scene.ts:1746-1771`) maps `view.moves` with
  no count, but the bar is a two-column grid (`styles.css:2264`), so a fifth
  card would wrap into a third row.

**Proposed shape:** do not grow `PokemonSpec.moves`. That would teach
learn/replace, TMs, the randomizer and the PP carry-over about a slot none of
them should touch.

- Add a battle-only field on the spec handed to the driver. `toPokemonSet`
  appends it as slot 5.
- At battle start, a handler sets that slot to `pp = maxpp = 1`.
- It is excluded from PP carry-over.
- A fresh `Battle` per fight gives "resets every battle" for free.

**Pluck has an effect**: it eats the target's berry and gains it. Trainers roll
held items (`randomizer.ts:833`). That is real sim behaviour and I would leave
it in, but it means Pluck is not just Peck with more power.

**UI stop.** The bible's Party row specifies four move cards
(`design-bible.md:681`). CLAUDE.md says work that needs "a third move-card call
site **stops and files an amendment before building**". A fifth button outside
the 2x2 grid is at least a new layout of the existing call site, and plausibly
a new one. Step 7 should not start until that is settled. See ruling R9.

## 4. Does the AI commit before, and independently of, the player?

**Yes on every normal turn.**

- **Where:** `runBattle` (`driver.ts:1703-1714`) asks every pending policy in
  one `Promise.all`, then submits p1 before p2.
  - The human policy only parks a promise (`policy.ts:358-385`).
  - The AI policy (`ai.ts:1190-1206`) is synchronous, so its choice exists
    before the player has chosen anything.
- **What it reads:** only its own `BattleView` (`driver.ts:1029-1056`). Nothing
  in it reflects the other side's pending choice.
- **Proven:** the turn-1 AI choice was identical under two different player
  choices, and "AI decided" logged before "HUMAN submits" on every normal turn.
- **Its randomness:** `createAiStream(simSeed, 'p2')` (`rng.ts:288`), consumed
  only by the tier's noise and switch-failure draws (`ai.ts:1141, 1150, 1175`).

**Can it be surfaced?** Yes.

- Today the committed choice lives only in the local `chosen` array. The
  change: when the AI resolves inside that same pass, stash its result on the
  `BattleSession` and thread it through `factsFor` into the view.
- **The displayed choice must be that one result.** Calling `decideWith` again
  to render it would consume extra noise draws and desync replay.
- **Versions:** the AI's inputs, its call order and its stream position are all
  unchanged. Opponent choices are not logged (`run.ts:2479-2486`), and
  submission order is untouched. So **the Psychic reveal does not force an
  `AI_VERSION` bump**, and `ENGINE_VERSION` holds.

**Forced replacements:**

- When p2 faints, only the AI is asked, for its send-in. That is the prompt's
  "not revealed" case, and nothing is pending on the player's side to show it
  beside.
- When p1 faints, p2 waits. The AI's next move is computed on the following
  normal turn, after it sees the send-in, and is revealed then as usual.
- Revealing the AI's move *during* the player's forced send-in would mean
  computing it before it can see the replacement. That is an AI behaviour
  change, and the prompt does not ask for it.

**What "the action the opponent attempts" means for test 4.**

- The revealed action is the submitted choice.
- The protocol shows it as `|move|` or `|switch|` when it executes, and as
  `|cant|` or nothing when it does not: flinch, sleep, or fainting before
  acting.
- I propose test 4 compare the reveal against the submitted choice on every
  turn, and against the protocol on the turns where the opponent acts.

## 5. IVs today

**Both sides get 31 in every stat, 0 EVs and a Serious nature, written
explicitly.** The sim's default is never reached.

- **The adapter:** `toPokemonSet` writes `ivs` 31 (`driver.ts:124`), `evs` 0
  (`:123`) and `nature: 'Serious'` (`:104`). Player, trainer and gym teams all
  pass through it (`driver.ts:948, 950`).
- **`PokemonSpec` has no IV field** (`types.ts:51-74`), so it carries nothing
  to the sim.
- **These copies of 31 sit outside the sim:**
  - `stats.ts:40` (`GYMRUN_IV`), used by `hpAtLevel` and `statAtLevel`.
  - The foe's facts in `toActiveFacts` (`driver.ts:606-621`).
  - `view.ts:1012` (`visibleSpeed`) and `statBandAt` (`driver.ts:1486-1506`).
  - The AI's `@smogon/calc` bodies, `ai.ts:315` and `ai.ts:343`.
  - The comment at `driver.ts:566-569` and `speed.ts:81-84` justifies reading
    the foe's `storedStats` because "with one fixed spread it equals the number
    `stats.ts` computes". Per-rank opponent IVs break that premise. The rank
    table is public data, so the readouts stay honest **only if** they read
    the rank's IV too.
- **The build spec line being reversed**, `pokerun-build-spec.md:149` (Named
  risks):
  > Breeding, EVs, IVs, natures, and multiplayer stay out through Stage 5.

  It refers to "the out of scope list". No section of that name exists in the
  file, and this is the only scope line.

**Proposed shape:**

- An optional flat `ivs?: number` on `PokemonSpec`, absent meaning 31. Attacker
  specs never set it, so attacker generation and attacker battles stay
  byte-identical.
- It is read by `toPokemonSet`, the `describeSpec` probe cache key
  (`driver.ts:245`), `stats.ts`, the foe facts and the AI calc bodies.

## 6. Trainer classes and `generateTrainerTeam`

**No trainer class concept exists** in `src/`. Every hit for Youngster, Bug
Catcher, Hiker, Ace Trainer and the rest is in the new prompt.

- A trainer is unnamed: the node label is `'Trainer battle'`
  (`encounters.ts:1146`).
- The only trainer sprite is the player marker, `trainerImg(avatar)`
  (`ui/sprites.ts:104-134`). It already takes a key, so a class sprite key
  plugs in. Bible D61 limits trainer sprites to that one use, so a class sprite
  at the door is another UI-stage bible question. With no new art, a class
  would show its name only.

**`generateTrainerTeam(segment, tier, stream)`** (`randomizer.ts:989-999`):

- **Keys:** the caller passes `rng.randomizer.at(nodeKey(id))`
  (`encounters.ts:1125`), where `nodeKey(id) = node/${id}`
  (`streamKeys.ts:45`) and `id = s${segment}-${locale}-${step}-${option}`
  (`encounters.ts:498`).
- **Tier:** drawn separately, on `seg${segment}/${locale}/route`
  (`streamKeys.ts:69`), by `assignTiers` (`encounters.ts:1059`).
- **Level:** `playerLevel` + `levelOffset.trainer` + the tier's `levelShare`
  (`scaling.ts:1022`).
- **Size:** `expectedPartySize(segment)` + the tier's `team` (`scaling.ts:991`).
- **Species:** `speciesFor`, with an admit of `() => true`. There is **no type
  restriction on trainers.** The only type-set filter in the codebase is the
  gym's (`gymSpeciesFor`, `randomizer.ts:479`), which is the template for a
  class's type set.

**Gym bosses:** `generateGymTeam(gym, segment, stream)` (`randomizer.ts:1008`)
on key `node/s${n}-gym`. It is **type-locked** to `gymForSegment(segment)`,
which is fixed per segment (Rock through Dragon), not drawn. Fire is Cinder at
segment 4, Psychic is Solene at segment 5. Size is `partyCapacityAfter(segment)`,
the move band is one higher, and the AI is always `hard`.

**Consequences:**

- "Bosses are not type locked" means defender bosses cannot reuse
  `generateGymTeam`. They need a sibling that takes the gym's level, size and
  move-band bonus with an untyped pool.
- The class draw is new. I propose a sibling `generateClassTeam` so the
  attacker function is untouched.

## 7. What an out-of-battle consumable needs

**The precedent is TMs**, a list beside the backpack:

- **State:** `RunState.tms: string[]` (`run.ts:629`), a separate list from
  `backpack`.
- **Capacity:** both count against `backpackCapacity` = `partySlots` +
  `tuning.backpackSlack` (2, `tuning.ts:760`) + relic `backpackSlots`
  (`items.ts:172-186`). That is checked as
  `inventoryLoad = backpack.length + tms.length` (`items.ts:153`), "one number
  over two lists". A third list joins it with no new rule.
- **Logging:** a teach is not a top-level decision. It rides inside
  `ItemPlan.teaches`, logged as `{ kind: 'items' }` or as a party edit
  (`types.ts:658-702, 727, 840`). `applyItemPlan` (`items.ts:283-424`) applies
  it.

**Why Potions cannot go in `backpack`:**

- `stow` silently drops anything not in `ITEMS` (`items.ts:199`).
- Everything in `backpack` is assignable as a held item and goes to the sim.
- `@pkmn/sim` gen 9 reports `potion`, `superpotion` and `hyperpotion` as
  `exists: false`.
- `ItemEntry.consumable` already means "berry" (`data/items.ts:69-86`), so the
  new table and field need another word to keep the two apart.

**The heal primitive exists:** `recoverParty([member], fraction, ppFraction)`
(`party.ts:298`), already used single-target by events (`events.ts:835`).
Passing `ppFraction = 0` restores HP only. The prompt asks for values in data,
and those are flat HP amounts, which `recoverParty` does not take. That needs a
small flat-HP sibling.

**Touch points, cheapest path:**

1. `data/consumables.ts`: id and HP restored. Its copy goes in an `itemCopy`
   style table.
2. `RunState.consumables: string[]`, counted by `inventoryLoad` and by the
   capacity check at the end of `applyItemPlan` (`items.ts:415`).
3. A reward kind, `{ kind: 'consumable', id }`, in `rewards.ts` /
   `rewardPools.ts`, plus `applyReward`.
4. Use as `ItemPlan.uses: { id, slot }[]`, applied in `applyItemPlan`. Also
   update `reconcileItemPlan`, `clonePlan` (`run.ts:2394`) and
   `defaultItemPlan` (`run.ts:2690`), which is where the benchmark bot's
   "under half HP" rule goes. This reshapes a logged decision, and
   `RUN_LOG_VERSION` is bumping anyway.
5. **"Never in battle" needs a guard that does not exist.** `editParty`
   (`run.ts:1778`) and `partyEditRefusal` (`run.ts:923`) do not refuse an edit
   while a battle question is open. Test 8 needs that refusal to be loud: the
   run throws, and the screen dims the control.
6. UI: a use control on the party screen beside the TM panel, and a reward-card
   face for the new kind.

## 8. The wave structure: tune the segment generator, or write a new one

**Recommendation: a new, thin generator.** It would live in
`core/defender/waves.ts` and emit the existing `Segment` / `Step` / `NodeSpec`
shapes, reusing the existing building blocks. Do not branch inside
`generateSegment`.

### Tuning alone builds the door skeleton

This was measured. `createRun` under `withTuning`, 200 seeds, **0 violations**.
Every rank had exactly `waveLength[rank]` steps, each with two trainer nodes and
a 3-card reward offer. The settings:

- `stepsPerSegment = [2,2,3,3,4,4,5,5]`
- `nodeChoiceCount {2,2}`
- trainer-only `nodeWeights`
- `distinctKindsPerStep: false`
- `localeOfferCount {1,1}`
- every floor at 0
- `battlePairFromSegment: null`

### Five things tuning cannot reach

Each would become a mode branch in attacker code:

1. **Locales.** Pass 0 always draws a locale offer (`encounters.ts:541`), node
   ids carry the locale, and the `locale` question is always asked and logged.
2. **The intermission.**
   - No knob places a shop after the last door.
   - A one-option shop step would log a decision the player never made, which
     `nodeOptions` (`run.ts:788`) forbids.
3. **Trainer classes, and distinct classes per door.** These are new
   cross-option draws.
4. **TMs only at the intermission.**
   - `canTeachAt` is rest or shop (`run.ts:442`).
   - `teachableAt` (`run.ts:462`) also lets a battle's own TM be taught at that
     battle.
5. **Defender pools.**
   - Adding the off-type relic to `RELIC_IDS`, or filtering it, changes the
     length of the attacker's `shuffledRelics` (`rewards.ts:524`) and moves
     attacker draws.
   - It must be a separate defender list, whichever generator is used.

### Tuning is never logged

`RunLog` is `{ seed, versions, decisions }` (`types.ts:931`). `replayRun` and
`resumeRun` default to `DEFAULT_TUNING` (`run.ts:3048`). So a mode expressed
only as tuning would replay a defender log as an attacker map with all four
version axes matching. That is precisely the silent reinterpretation CLAUDE.md
forbids. **`RunLog.mode` is needed either way.**

- It belongs at the top level, as an input like the seed, not in `versions`.
  Mode is not a build axis.
- `test/run-replay.test.ts:120` and `test/versions.test.ts:56` assert the log's
  keys are exactly `['decisions', 'seed', 'versions']`. Those two assertions
  change.

### Why the new generator

The keyed-stream contract makes new keys free (`test/stream-keys.test.ts` group
3: "a new key moves nothing").

- **Disjoint keys and ids.** Defender keys such as `rank${r}/…` and node ids
  such as `r${r}-d${door}-${side}` leave `generateSegment` byte-identical, and
  keep defender seeds isolated from every future attacker composition tweak.
- **Easy to throw away.** Throwing the branch away is one directory and one
  `createRun` branch.
- **Attacker code untouched.** The five gaps cost about the same either way. In
  the tuned option, they land inside the attacker's most fragile code.

**Files, roughly:**

- **New:** `core/defender/`, `data/defender.ts`, `data/trainerClasses.ts`,
  `data/consumables.ts`.
- **`core/streamKeys.ts`:** the new keys.
- **`core/encounters.ts`:** only `export` added to `sampleWeighted`,
  `assignTiers`, `drawRange`. No logic edits.
- **`core/run.ts`:**
  - mode on `RunState` and `createRun`
  - no locale question
  - the intermission as a non-choice phase before the boss, as the gym itself
    is today
  - a defender gate in `teachableAt`
  - mode read from the log, with a loud mismatch
- **`core/types.ts`, `core/preview.ts`, `core/seedString.ts`:** the mode
  parameter.
- **`LocaleRoute.locale`** becomes nullable, or takes a sentinel value. I have
  not audited what the UI reads off it, so step 7 will.

### Proving attacker generation is unchanged

The existing fixtures do not do it.

- `test/sim-fixture.test.ts` covers 1, 7 and 12 visited nodes, and stamps all
  four versions in its header.
- Nothing guards an unvisited route.

**First commit of step 2, before any `src/` change:** a fixture holding the
sha256 of `JSON.stringify({ starterOptions, segments })` from
`createRun(seed, DEFAULT_TUNING)` over 200 seeds.

- It covers every route, team, sim seed, offer, shop, event and acquisition.
- It carries no version field, so it must stay byte-identical through the
  whole branch, with no re-mint allowed.
- It costs about 12 seconds.
- It also catches the real hazard: an edit to a shared data table (reward
  pools, relics, scaling) moving attacker draws while `contentHash` only
  re-stamps.

---

## 9. Rulings needed before step 2

**R1. Three-mon draft against the shipped slot schedule: a contradiction.**

- `SLOT_UNLOCK_SCHEDULE = [2, 3, 3, 4, 4, 5, 5, 6, 6]` (`partyTuning.ts:53`).
  The run opens at **2** slots, and slots unlock after bosses 1, 3, 5 and 7.
- The prompt drafts **3** and requires "a party never exceeds the slot
  schedule" (test 9).
- Both cannot hold. Options:
  - **(a) Recommended:** defender reads the shipped schedule one row ahead,
    `partyCapacityAfter(bossesBeaten + 1)`. That gives 3, 3, 4, 4, 5, 5, 6, 6,
    with recruit drafts after bosses 2, 4 and 6, reaching 6 at the last rank.
    The offset of 1 lives in `data/defender.ts`.
  - **(b)** Draft 2.
  - **(c)** A separate defender schedule in data.

**R2. "Today's relic pool minus capability relics" is empty.**

- Every relic grants a capability (`data/relics.ts:18`).
- **Recommended reading:** drop the two relics whose passive is `none`
  (`woodsmans-hatchet`, `windrider-feather`), because they are capability and
  nothing else. Keep the other eight for their passives, with their capability
  inert, since there are no events. Add the off-type slot relic.
- This is a separate defender list, per section 8.

**R3. Gym type is a player decision, so every type-dependent draw is drawn
three times.**

- This is not optional under CLAUDE.md's constant-consumption rule. The draft,
  every recruit draft and every trade offer depend on the gym type. So each is
  drawn at generation for **all three** types, and the decision selects one.
- The Fire highlight slot is drawn for every generated mon regardless of type.
- I am stating this rather than asking, because the invariant decides it. It
  triples those draws, which is cheap.

**R4. Door choice: new decision kind, or the existing `node` decision?**

- A door is structurally an existing `Step` with two options. The `node`
  decision would carry it with no new kind.
- The prompt lists "door choice" among new logged decisions.
- **Recommended:** a distinct `door` kind. The log then says what the player
  chose, and an attacker `node` cannot replay into a defender door. The
  `RUN_LOG_VERSION` bump is happening anyway.

**R5. `AI_VERSION` and the Flying Speed read.**

- The Psychic reveal does **not** force a bump (section 4).
- The Flying requirement does change an AI input: the AI's turn-order read must
  include the multiplier, and today it reads `storedStats`.
- With the multiplier as an `ActiveView` field that is 1 everywhere in attacker
  mode, attacker AI output is byte-identical.
- **Recommended:** hold `AI_VERSION`, record the reasoning in
  `docs/generation.md`, and say so in the step-4 report.
- If you would rather any new AI input bump the axis, it is one string.

**R6. Bosses.**

- Not type-locked, so not `generateGymTeam` (section 6).
- **Proposed:** a sibling that uses the segment's gym level, the
  `partyCapacityAfter(segment)` team size, the move-band bonus and `hard` AI,
  with an untyped pool.
- **Open:** do bosses keep the existing leader names (Cinder, Solene and the
  others, who are themselves type specialists), or show as an unnamed "Rank N
  boss"? The prompt's pre-boss screen shows only team size and level.
- **Recommended:** unnamed for v0.

**R7. Fire streak edge cases.**

- A turn on which the highlighted move does not execute (flinch, full
  paralysis, sleep) is neither "another move" nor a switch.
- **Recommended:** the streak holds, unchanged.
- **Also recommended:** read eligibility off the spec at battle start, not
  live types (section 2).

**R8. Trade "acquisition order".**

- Members carry only `joinedSegment` (`types.ts:577`). Party order is a player
  decision (lead and reorder edits), so it is not acquisition order.
- **Needed:** a monotonic acquisition index stamped on each member at
  recruitment. Then the selector value resolves as
  `selector mod party.length` over members sorted by that index.
- Also: "one quality step above the rank's norm" is read here as **the next
  tier up** (`TIER_MODIFIERS`).

**R9. Bible stops ahead of step 7.**

- **The fifth button.** The Party row specifies four move cards
  (`design-bible.md:681`), and CLAUDE.md treats a third move-card call site as
  an amendment stop.
- **Other new surfaces** that need the same reading before step 7:
  - the opponent's revealed action
  - the crit chance on a move button
  - class names at the door (D61 limits trainer sprites to the player marker)
  - the 1.1x Speed in the stage-0 stat block
- Steps 2 to 6 are headless and touch none of this. I will read the bible in
  full and report which rules each surface touches before step 7 writes any
  UI.

**R10. Smaller defaults I will take unless told otherwise:**

- `betweenNodes`' 50% revive of fainted members stays as "the existing
  attrition rules" inside a rank.
- Party management stays available whenever a question is open, as `editParty`
  allows today, except during a battle (section 7.5).
- The intermission's shop stock is drawn on a new key, from the existing
  `generateShopStock` tables.
- Opponent IVs ride an optional flat `PokemonSpec.ivs`, absent meaning 31.
