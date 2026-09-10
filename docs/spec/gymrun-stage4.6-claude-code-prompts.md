# GYMRUN Stage 4.6: Locales, Reward Ramp, and Capability Events

Three sub-stages. Paste them one at a time, in order, each after the previous is merged. Do not paste all three at once.

**Why split.** Three of these systems move every number in the balance table. Landed together, the first simulator report tells you the run got harder or easier with no way to attribute it. Split, each report has one variable.

- **4.6a Locales and Capture.** Structural. Segment opens on a locale choice, one guaranteed wild encounter per segment, capture offered on every wild victory.
- **4.6b Reward Ramp and Berries.** Economic. Moves band by base power, rewards ramp with tier, berries become the low denomination, species leaves the reward pools.
- **4.6c Capability Events and HMs.** Content. Events resolve into one of three bands depending on what the party can do, HMs become acquirable items, band 3 spawns an encounter.

Read `gymrun-seeds-and-mappability.md` before starting 4.6a. It contains a stream refactor that 4.6a depends on.

---

## Rules that hold across all three

- `core/` never imports from `ui/`. No `Math.random`.
- Every balance or copy number a tuning pass would touch lives in `data/`.
- The Part 4 editorial rule from Stage 4.5.1 still governs all copy: the UI presents attributes, never verdicts. No recommendations, no scores, no "best" markers, no ordering that implies ranking. The one exception remains live type effectiveness against the Pokemon currently on the field.
- UI comes last in every sub-stage.
- Commit at each checkpoint and stop for review.

## Out of scope for all of 4.6

The priority-blind and speed-blind AI. `MoveView` has no priority and `BattleView` has no speed, and fixing it needs its own `AI_VERSION` bump and its own balance report. It stays out of 4.6 deliberately so its effect on the table is separable from everything here.

Also out: PP restoration changes, move storage or relearning, box storage, selling to shops, reward rerolls, and everything in Stage 5.

---
---

# PART A: Locales and Capture

## PROMPT

You are building **Stage 4.6a** of GYMRUN. Read `pokerun-build-spec.md`, `docs/generation.md`, `gymrun-seeds-and-mappability.md`, and the existing `src/core/` before writing anything.

Stage 4.5.1 gave the player a party, a backpack, and attrition. 4.6a gives the map a geography. A segment now opens on a locale choice that commits the player to a region, and every segment contains exactly one wild encounter in that region which the player can catch.

### Do the stream refactor first

`gymrun-seeds-and-mappability.md` specifies a move from sequential RNG streams to keyed sub-streams. Do that refactor as step 1 of this sub-stage, with its isolation test passing, before adding any locale draws. Every draw added across 4.6a, 4.6b, and 4.6c depends on it. Adding locale generation on top of the current sequential streams means three forced `randomizerVersion` bumps instead of one.

### Order of work, stop for review after each

1. Keyed sub-stream refactor and its isolation test. No new features.
2. Locale data, locale selection in map generation, wild encounter placement, determinism tests. No UI.
3. Capture flow in `core/`, headless, with the recipient-selection shape reused from 4.5.1.
4. Simulator: locale pick distribution, capture rate, party composition at each gym.
5. UI: locale select screen, map rendered as a region, capture offer on the result screen.

### Locales

`data/locales.ts`. Eight locales, four types each, exact coverage across all 18 types. Dragon, Psychic, Fairy, and Steel appear once. Every other type appears twice.

| Locale | Types |
|---|---|
| Cave | Rock, Ground, Dark, Steel |
| Shore | Water, Poison, Ground, Normal |
| Summit | Flying, Rock, Ice, Dragon |
| City | Normal, Electric, Poison, Fairy |
| Forest | Grass, Bug, Fighting, Flying |
| Ruins | Ghost, Dark, Psychic, Fire |
| Marsh | Water, Grass, Bug, Ghost |
| Badlands | Fire, Ice, Electric, Fighting |

Flavour is tunable data, not logic. If a type reads wrong in a locale, that is a table edit.

**What a locale determines:** the wild encounter species pool for that segment, and which events are available in that segment.

**What a locale does not determine:** trainer battles, shops, rests, and node tiers. Those stay locale agnostic. A locale is where you are, not how hard it is.

### Segment structure

A segment now opens with a **locale select step**, which is not a node and does not consume a step from the node budget.

- Offer 2 or 3 locales, count in `tuning.localeOfferCount`.
- Weight the offer so all eight appear across a full run and no locale is offered in two consecutive segments. Put the weighting rule in `data/locales.ts`, not in the generator.
- After selection, the segment's route generates as it does today: the existing per-step choice of 2 or 3 nodes, `tuning.stepsPerSegment` steps, then the gym.

**Composition guarantees per segment, enforced at generation, in `tuning.ts`:**

- Exactly one wild encounter node, always reachable regardless of which nodes the player picks. Place it on a step where it is the only option, or on every option of that step.
- At least one event node offered somewhere in the segment.
- At least one rest node reachable on some path. Rest frequency was cut in 4.5.1 and this guarantee is the floor under that cut, not a reversal of it.

Generate the entire structure at run creation, in one pass, including all unvisited branches. Locale selection is a player decision, so generate the route for **every** offered locale at map generation and discard the unpicked ones at selection time. Do not generate the route lazily after the player picks. Write this into `docs/generation.md`.

### Capture

Capture is offered on every wild encounter victory. It is guaranteed, not rolled. This is deliberate and it departs from the source games: a capture roll on a seeded run is a punch with no counterplay, and the cost of a catch already exists in that the wild encounter occupies one of the segment's limited steps.

- The captured Pokemon arrives at the level and moveset it was fought with, holding whatever it held.
- If the party has an empty slot, it fills it.
- If the party is full, the player picks a member to replace, reusing the recipient-selection shape from Stage 4.5.1 Part 7. The replaced member is gone. No box.
- A held item on the captured mon goes to the backpack. Over capacity triggers the existing discard choice.
- Declining is always available and is logged.

The capture offer renders on the existing post-battle result screen from the playtest round 2 patch. Do not add a second path by which a node completes.

**Reuse the coverage one-liner.** `offensiveCoverage(party)` from 4.5.1 already exists and is pure. The capture card renders before and after coverage as a factual readout, exactly as the species reward card did. Part 4 applies in full: "adds Dragon, Steel. Loses Ghost." is correct, "improves your coverage" is not.

### Determinism and logging

- Locale selection, capture accept or decline, and capture recipient are all player decisions. They consume no RNG and they serialize into the run log in order.
- Bump the run log version. A 4.5.1 log throws on replay with a message naming the mismatch.
- `randomizerVersion` bumps once, here, and the seeds-and-mappability doc explains why it should not need to bump again for 4.6b or 4.6c.

### Simulator

Add to the report:

- Locale pick distribution under a random locale policy, confirming no locale is unreachable.
- Capture rate: fraction of wild victories where a greedy policy catches, and party size entering each gym.
- Party type composition entering gym 8, to confirm locales actually diversify parties rather than every run converging on the same few species.
- Add `--policy catch-greedy` (always catch, replace the lowest-level member when full) and `--policy catch-averse` (never catch). The gap between them is the crude measure of whether the capture system does anything.

### Tests required

1. Same seed produces identical locale offers, identical routes for every offered locale, and identical wild encounter placement, twice.
2. Every segment contains exactly one reachable wild encounter, at least one event, and at least one reachable rest, over many seeds.
3. Wild encounter species are drawn only from the selected locale's type set, over many seeds.
4. No locale is offered in consecutive segments, over many seeds.
5. Capture with an empty slot fills it. Capture with a full party replaces the chosen member and the replaced member is gone. Decline changes nothing.
6. A headless `playRun` completes under Node with a policy that picks locales, catches, and declines.
7. Save mid-run between a wild victory and the capture decision, reload, replay to identical state.
8. Version guard: a 4.5.1 log throws.
9. Stream isolation under the new keyed streams, per the seeds doc.
10. All prior suites pass.

### UI

- **Locale select screen.** 2 or 3 cards, each showing the locale name, its four types, and nothing else. No difficulty rating, no reward hint, no recommendation.
- **Map screen.** The current segment renders inside its locale as a named region. Keep the vertical chain and the scroll-to-current-step behaviour from the round 2 patch. The 350px of setup chrome that was reclaimed stays reclaimed: the decision point must stay above the fold on a 390x844 phone.
- **Capture card** on the result screen, using the party management stat component unchanged so a caught mon looks identical to a party mon.

### Definition of done

A player opens a segment, picks a region, walks a route through it, meets exactly one wild Pokemon of that region's types, beats it, and chooses whether to keep it. Two people on the same seed making the same choices get identical runs.

### Defaults I am taking, flagged for review

- Locale select is a pre-step, not a node, so the node budget is unchanged from 4.5.1.
- Routes for all offered locales are generated up front and discarded on selection. Cheaper alternative is to derive the route from a keyed stream at selection time, which the keyed refactor makes safe. Take whichever is simpler once the refactor lands.
- Captured mons keep their held item.

---
---

# PART B: Reward Ramp and Berries

## PROMPT

You are building **Stage 4.6b** of GYMRUN. 4.6a is merged. Read the existing `src/core/randomizer.ts`, `data/movePools.ts`, `data/rewardPools.ts`, and `data/scaling.ts` before writing anything.

Today every moveset is a flat random draw and every reward tier is roughly the same table with more entries. 4.6b turns the run into a ramp: the player starts with weak moves and climbs, and reward tier controls how fast.

This sub-stage will move every balance number. Expect a full retune, not a diff.

### Report before you write any code

1. **How is `data/movePools.ts` currently keyed?** Segment band only, or type as well? Banding by base power on top of existing keys may or may not need a restructure. Report the current shape.
2. **How does `data/rewardPools.ts` key entries after the 4.5.1 gym pool was appended?** Report the key structure before adding a third axis to it.
3. **Do berries currently appear anywhere in `data/items.ts`?** Stage 3 excluded consumables. Confirm nothing is half-built.

Stop and report. Do not proceed until reviewed.

### Order of work, stop for review after each

1. Base power banding, the override table, and banded move pools. Unit tests. No rewards yet.
2. Reward pools rekeyed to tier and band. Species entries removed.
3. Berries: item data, backpack handling, `-enditem` protocol sync, trainer and wild mons holding them.
4. Simulator run, report, retune. This is the long step.
5. UI: reward cards showing band, berry display in the backpack.

### Base power bands

Four bands in `data/movePools.ts`:

| Band | Base power |
|---|---|
| 1 | 50 and under |
| 2 | 51 to 75 |
| 3 | 76 to 95 |
| 4 | 96 and over |

Band assignment is automatic from base power, with a small **override table** for moves where base power is a bad proxy. Boosting moves, multi-hit, priority, drain, fixed damage, and heavy-drawback moves all lie about their strength. Start the override table near empty and populate only from simulator evidence, with a comment per entry explaining why, same posture as `data/blacklists.ts`. Blacklist OHKO moves outright.

Status moves are band free. They are gated by a separate `impact` tag in the override table so a Swords Dance does not read as a band 1 reward.

**Segment to band mapping** lives in `data/scaling.ts` as a weighted distribution per segment, not a hard step. Starting proposal, to be moved by the report:

| Segments | Band weighting |
|---|---|
| 1 to 2 | band 1 only |
| 3 to 4 | mostly 2, some 1 |
| 5 to 6 | mostly 3, some 2 |
| 7 to 8 | mostly 4, some 3 |

Opponents draw from the same table. Gym leaders draw at +1 band, which is the difficulty spike and it must be a single number in `scaling.ts`.

The player's starter draws band 1 only, regardless of anything else.

### Reward pools, rekeyed

`data/rewardPools.ts` keys on tier, segment band, and now base power band. What each tier pays:

- **Normal.** A berry, or a move in the segment's current band. Sidegrades and coverage, not power.
- **Hard.** A move one band above the segment's current band, or a held item.
- **Elite.** A move two bands above, or a competitive held item, or a large currency lump.
- **Gym.** Unchanged from the 4.5.1 patch, still strictly better than elite, still keyed by segment index rather than tier.

**Species rewards come out entirely.** Capture from 4.6a is the acquisition path now. Delete the species entries from the pools and delete `tuning.allowSpeciesRewards` rather than leaving it behind a flag. Keep `offensiveCoverage` and the coverage line, which 4.6a moved onto capture cards.

The open item where gym currency took 59.7 percent of picks at 120 seeds is expected to close here, because currency was winning against a weak field. Report the new figure. If currency still exceeds 50 percent against a banded field, that is a pricing problem in `data/shop.ts`, not a pool problem.

### Berries

Berries are the low denomination of the whole economy. They matter early, they fade as HP totals scale, and that fade is the design, not a flaw.

- Curated whitelist in `data/items.ts` alongside held items: Oran, Sitrus, Lum, Chesto, the type resist berries, Leppa. Roughly 10 to 15 entries.
- Berries are held items in Showdown terms, so the sim already resolves them. The new work is the **consumption sync**: read `-enditem` off the battle protocol and remove the berry from run state permanently. A consumed berry is destroyed. It does not restock between nodes.
- Berries occupy backpack slots against `tuning.backpackCapacity`, competing with held items. This is what makes them fade gracefully: a late-run player discards berries to hold gear.
- Trainer Pokemon frequently hold berries. Put the hold rate in `data/scaling.ts` as a per segment number, weighted higher in early segments. Wild Pokemon hold them less often.

### Simulator

Add to the report:

- Base power band distribution of the player's moveset entering each gym. If the player is still on band 1 at gym 5, the ramp is not ramping.
- Berry consumption rate per segment, and the fraction of runs where berries occupy backpack slots at gym 6 or later. If berries clog the backpack late, the discard flow is not being used and capacity is wrong.
- Reward take rate by kind under the banded pools, replacing the pre-4.6 figures.
- Full per-gym clear rate retune. Stage 2 targets are no longer valid as a diff. Define fresh targets from the first report and write them into the report header.

### Tests required

1. Band assignment is correct for a sweep of every move in the pool, and override entries win over computed base power.
2. No generated moveset has zero damaging moves, still, under banding. Property test.
3. A starter never receives a move above band 1, over many seeds.
4. Normal, hard, and elite reward offers draw from the correct bands for a fixed segment, over many seeds, and the ordering is monotonic.
5. A berry fires in battle and is removed from run state afterward, asserted against the battle protocol and then against the backpack.
6. A berry consumed in battle does not reappear at the next node.
7. Every reward offer is still exactly 3 distinct options.
8. Determinism and stream isolation pass unchanged.
9. Version guard: a 4.6a log throws.

### Definition of done

A run that starts with Tackle and Growl and ends with something that hits like a truck, where the climb is visibly faster on the risky path. Berries carry the early game and are being discarded by segment 6. The simulator produces a fresh report with per gym clear rates inside newly stated targets.

---
---

# PART C: Capability Events and HMs

## PROMPT

You are building **Stage 4.6c** of GYMRUN. 4.6a and 4.6b are merged. Read `data/events.ts` and `core/events.ts` before writing anything.

Events are currently a prompt with choices and declarative outcomes. 4.6c makes them reward what your party can do, not just what you pick. This is the HM homage: a utility Pokemon occupying a roster slot pays off.

### Report before you write any code

1. **Can `@pkmn/dex` return a gen 7 learnset for an arbitrary species?** Cut, Surf, Strength, Rock Smash, Fly, Waterfall, Dive, and Flash exist through gen 7 and were removed in gen 8. Confirm the query works against a gen 7 dex instance while the battle format stays gen 9. Report the exact call.
2. **Can `core/events.ts` currently produce a battle as an outcome?** Band 3 below requires an event to spawn an encounter. Report whether the outcome union and the run state machine can express that today or whether the node model needs to.

Stop and report.

### Order of work, stop for review after each

1. Capability resolution as a pure core function, with tests. No events yet.
2. HM items: acquisition, teaching, move slot replacement.
3. Three-band event outcomes, drawn at map generation.
4. Band 3 event-spawned encounters.
5. Simulator: gate pass rate per band.
6. UI: capability requirement on the map, event screen bands, HM teaching screen.

### Capabilities

```ts
type Capability = 'cut' | 'surf' | 'strength' | 'rockSmash' | 'fly' | 'waterfall' | 'dive' | 'flash';
type CapabilityBand = 'none' | 'latent' | 'known';
resolveCapability(party: PokemonState[], cap: Capability): CapabilityBand
```

- `known` if any party member has the HM move in one of its four slots.
- `latent` if any party member's species can legally learn it in a gen 7 learnset, but no one has it slotted.
- `none` otherwise.

Pure, no RNG, in `core/capabilities.ts`. Property test it: a Water type resolves at least `latent` for Surf, a genderless rock resolves `none` for Fly, and teaching an HM moves a party from `latent` to `known`.

### Event bands

Every event names exactly one required capability and carries three outcome sets.

- **`none`.** A minor payout: a berry, a small heal, or a little currency. The event still resolves and still pays. A player with nothing is not punished, only unrewarded.
- **`latent`.** A real payout: a larger heal, a held item, a move one band above the segment's current band, or a large currency lump. The party can improvise the job.
- **`known`.** An encounter with a Pokemon that holds a good held item. This is the top band and it is the payoff for spending a move slot on a bad move.

Band 3 resolution: the event routes into a battle. On victory the player is offered the capture, exactly as in 4.6a. **Taking the capture takes the mon and its item. Declining the capture still yields the item alone.** Both paths pay, and the choice is a roster slot against a guaranteed item.

**Draw all three band outcomes at map generation**, from the `rewards` key, and select at resolution time. Do not draw the band that will be used, because which band applies depends on party state, and party state depends on player decisions. Drawing all three keeps RNG consumption constant regardless of how the party is built, which keeps the streams isolated by construction. The band 3 encounter spec is drawn at map generation too.

### HMs

Two acquisition paths, per your design:

1. **A starter offered with an HM already slotted.** Some starter options in `data/starters.ts` carry an HM in one of their four moves. That option is visibly weaker in battle and visibly stronger for events, and the starter select screen shows the moveset already, so the trade is legible without a hint.
2. **HM items in reward pools and shops.** An HM is a `data/hms.ts` entry, not a held item. It is retained permanently, does not occupy backpack capacity, and can be taught at any time outside battle to any party member whose species can legally learn it in gen 7.

Teaching reuses the `chooseMoveToReplace` flow from Stage 4.5.1 Part 6 unchanged. There is no decline once teaching is initiated, same rule as move rewards. An HM in a slot is a real cost and the player should feel it.

Do not add HM moves to the general move reward pools. HMs arrive only as HM items or preslotted starters.

### The map reveals the requirement

An event node on the map shows which capability it needs, and the player's current band for it. It does not show the reward.

This is inside the Part 4 editorial rule. "Requires Cut. Your party: latent." is an attribute readout. "Take this, you will do well" is a verdict. The distinction matters because revealing the requirement is what makes routing a plan rather than a lottery, and it is what makes catching a utility mon a strategy rather than an accident.

### Simulator

Add to the report:

- Gate pass rate per capability: the share of events resolving at `none`, `latent`, and `known` under a greedy policy. If `known` fires in under about 5 percent of events, HMs are too expensive or too rare and the mechanic is decoration.
- HM acquisition rate and the fraction of runs carrying at least one HM at gym 8.
- Completion rate for runs that slotted an HM against runs that did not. Correlational and noisy, so print sample sizes and do not act on a split with fewer than about 50 runs a side.
- Add `--policy hm-greedy`, which teaches any HM it acquires immediately. Its completion rate against `catch-greedy` is the direct test of whether a utility slot is affordable.

### Tests required

1. `resolveCapability` over known cases including a `none`, a `latent`, and a `known`, plus a property test that teaching an HM always moves `latent` to `known`.
2. All three band outcomes are drawn at map generation and RNG consumption is identical regardless of which band resolves. Test this directly with two runs on the same seed and deliberately different parties.
3. A band 3 event spawns an encounter, victory offers the capture, declining still grants the item.
4. Teaching an HM replaces the chosen slot, the displaced move is gone, and an illegal species is rejected.
5. Event outcomes still serialize and replay to identical state under the three band shape.
6. A saved run replayed with the same decision log resolves the same band.
7. Determinism and stream isolation pass unchanged.
8. Version guard: a 4.6b log throws.

### Definition of done

A player looks at a fork, sees that one path holds an event needing Surf, remembers the Poliwag they caught in the Marsh two segments ago, and routes toward it deliberately. A different player without Surf takes the same event, gets a berry, and understands exactly why.

### Defaults I am taking, flagged for review

- HM items are permanent and free of backpack capacity, matching the source games.
- Band 3 declining capture still grants the item. The alternative, capture or nothing, makes band 3 hostile to a full party.
- Events pay at every band. The alternative, `none` pays nothing, makes an unrouteable event a dead node and punishes early runs hardest.
- One capability per event. Multi capability events are a later idea and would need a UI for partial satisfaction.
