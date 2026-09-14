# GYMRUN Content Patch: Event Rejig

Four-tier outcomes, real downside, option archetypes, rarity, and a 24-event chart.

Paste into Claude Code on top of merged 4.8. This is a content patch, not a stage. It changes `data/` heavily, `core/events.ts` moderately, and the run log schema once.

---

## PROMPT

You are patching **GYMRUN**. Read `docs/spec/pokerun-build-spec.md`, `docs/generation.md`, `src/core/events.ts`, `src/data/events.ts`, `src/data/relics.ts`, `src/data/rewardPools.ts`, and the 4.6c section of `docs/spec/` before writing anything.

Events are currently the weakest node on the map. Each one names a relic and pays something at every band, so the node reads as a small guaranteed handout with a relic check bolted on. Nobody routes toward one and nobody remembers one. This patch turns the question mark into the highest variance node in the game: it can pay better than an elite reward and it can cost you a segment's worth of attrition.

Two references drive the design. Slay the Spire, for the shape of an event as a menu of asymmetric bets where one option is a known price and another is a coin flip. Chaos Zero Nightmare, for the posture that a question mark node is allowed to ruin a run, not only bless it.

### Report before you write any code

Four questions. Each one can change the shape of this patch.

1. **What does an event look like after 4.6c?** Stage 3 specified prompt plus 2 or 3 choices with declarative outcomes. 4.6c layered three capability bands on top. Report whether **choices survived** or whether bands replaced them and an event now auto resolves. If choices are gone, this patch reintroduces them and that is a bigger job than it reads.
2. **What does `resolveCapability` return now that relics satisfy capabilities?** The 4.6c signature was `none | latent | known`. Under relics the middle band may be dead. Report the live signature and what `latent` means today, if anything.
3. **What can the outcome union express?** Specifically: HP loss, gold loss, forced backpack discard, a granted move, a granted relic, and a spawned encounter. Band 3 shipped encounters in 4.6c so that one should exist. Report which of the six are missing.
4. **Is the logged event decision an index or an ID?** If it is an index into the presented option list, this patch breaks replay, because the option list length now varies with relic state. Report which it is.

Stop and report all four. Do not proceed until reviewed.

---

## Part 1: Four outcome tiers

Every event outcome resolves into exactly one tier. Contents live in `data/eventPools.ts`, new file, keyed by tier and segment band.

| Tier | Name | Contents |
|---|---|---|
| T0 | Setback | A real cost, always paired with a consolation. Costs: 15 to 25 percent HP off the lead or the party, loss of a berry, loss of 30 to 40 percent of gold against a floor, or one forced backpack discard. Consolation: a small gold lump, a berry, or a partial heal. Never a cost with nothing attached. |
| T1 | Minor | One held item, or two berries, or a mid gold lump, or a full heal on one member. |
| T2 | Major | A move at the segment's current band, or a Pokemon at the segment's current band via a spawned encounter and capture, or a premium held item, or a common relic. |
| T3 | Windfall | A move at band plus one, or a Pokemon at band plus one holding an item, or a strong relic, or a large gold lump plus a held item. |

**T3 is reachable only through a satisfied relic.** That is the whole payoff of the relic system and it is the one hard rule in this patch. No option, no rarity, and no tuning number may put T3 in reach without the event's relic.

T2 Pokemon rewards reuse the 4.6c band 3 encounter spawn and the 4.6a capture flow unchanged. Do not add a second acquisition path. Declining the capture still grants a fallback from the T1 pool, matching the existing 4.6c rule that both paths pay.

---

## Part 2: Four option archetypes

An event is a prompt plus 3 or 4 options. Every option is one of four archetypes. The archetype determines the outcome distribution, the event data determines the copy and the price.

| Archetype | Cost | Outcome | Present |
|---|---|---|---|
| **Safe** | None | Flat T1, no variance | Always |
| **Gamble** | None | Rolls T0 to T2 on the rarity distribution | Always |
| **Toll** | A stated, exact price paid up front | Guaranteed T2 | Always |
| **Attune** | None | Rolls T2 to T3, weighted to T3 | Only when the event's relic is satisfied |

Read the decision this produces. Without the relic the player picks between a guaranteed small thing, a swing, and a known price for a known reward. With the relic a fourth option appears that beats all three and still is not certain. That is the routing incentive the relic system was supposed to create and currently does not.

Toll prices are per event and live in `data/events.ts`. Gold tolls take `max(floor, fraction of current gold)` so a broke player still pays something. HP tolls apply after the attrition rules, never below 1 HP, and never faint a member.

---

## Part 3: Rarity and distributions

Rarity is the variance knob. Each event node draws a rarity at map generation.

**Node rarity draw**, in `data/scaling.ts`, weighted upward by segment:

| Segments | Common | Uncommon | Rare |
|---|---|---|---|
| 1 to 3 | 60 | 30 | 10 |
| 4 to 6 | 50 | 33 | 17 |
| 7 to 8 | 40 | 35 | 25 |

**Gamble distribution by rarity**, in `data/eventPools.ts`:

| Rarity | T0 | T1 | T2 | T3 |
|---|---|---|---|---|
| Common | 35 | 45 | 20 | 0 |
| Uncommon | 25 | 45 | 30 | 0 |
| Rare | 20 | 35 | 45 | 0 |

**Attune distribution by rarity:**

| Rarity | T0 | T1 | T2 | T3 |
|---|---|---|---|---|
| Common | 0 | 10 | 60 | 30 |
| Uncommon | 0 | 5 | 50 | 45 |
| Rare | 0 | 0 | 40 | 60 |

Every number above is a starting hypothesis and belongs in a data table. None of them is a finding.

**Pool exhaustion.** An event drawn once is removed from that run's pool and cannot reappear. Twenty four events against roughly one event per segment means a run sees a third of the table, so repetition inside one run is the thing most likely to make the system feel small.

---

## Part 4: The event chart

Twenty four events, three per locale, one of each rarity per locale. Locale availability follows the 4.6a rule that a locale determines which events are reachable in that segment.

| ID | Locale | Relic | Rarity | Hook | Toll price |
|---|---|---|---|---|---|
| CAVE-01 | Cave | Strength | Rare | A collapsed shaft, and something metallic under the rubble | 20% HP, lead |
| CAVE-02 | Cave | Flash | Common | A gallery with no light and echoes coming back wrong | Lose a berry |
| CAVE-03 | Cave | RockSmash | Uncommon | A fossil seam that someone started on and abandoned | 40% gold |
| SHORE-01 | Shore | Dive | Rare | A crate on the seabed, deeper than it looks | 25% HP, party |
| SHORE-02 | Shore | Surf | Common | A riptide channel between you and the far bank | 15% HP, lead |
| SHORE-03 | Shore | Strength | Uncommon | A beached trawler, hull intact, hatch jammed | Discard one backpack item |
| SUMMIT-01 | Summit | Fly | Rare | A ledge across a wind shear, nothing below it | 20% HP, party |
| SUMMIT-02 | Summit | RockSmash | Uncommon | A cairn of offerings, sealed | Fixed gold by segment |
| SUMMIT-03 | Summit | Strength | Common | A cache frozen into the ice face | Lose a berry |
| CITY-01 | City | Flash | Uncommon | A derelict substation, power still humming somewhere | 15% HP, party |
| CITY-02 | City | Waterfall | Common | A flooded underpass with a current running through it | 30% gold |
| CITY-03 | City | Fly | Rare | A courier stranded on a rooftop with a package | Discard one backpack item |
| FOREST-01 | Forest | Cut | Common | A thornwall grown across the only path | 20% HP, lead |
| FOREST-02 | Forest | Cut | Uncommon | A sap still, tapped and left running | 35% gold |
| FOREST-03 | Forest | Strength | Rare | A fallen giant across a ravine, something nesting in it | 25% HP, party |
| RUINS-01 | Ruins | Flash | Rare | A sealed antechamber, no light past the threshold | 25% HP, party |
| RUINS-02 | Ruins | Cut | Common | A stair choked with roots | Lose a berry |
| RUINS-03 | Ruins | Waterfall | Uncommon | A reliquary font running hard the wrong way | 40% gold |
| MARSH-01 | Marsh | Surf | Common | A causeway drowned past the markers | 20% HP, lead |
| MARSH-02 | Marsh | Dive | Rare | A sinkhole pool with a clear bottom and no shallows | 30% HP, party |
| MARSH-03 | Marsh | Dive | Uncommon | A leech bed over something worth having | Discard one backpack item |
| BAD-01 | Badlands | Waterfall | Rare | A magma vent with a spring above it | 25% HP, party |
| BAD-02 | Badlands | RockSmash | Common | A shattered mesa, a seam running through it | 15% HP, lead |
| BAD-03 | Badlands | Fly | Uncommon | A thermal updraft and a ridge on the far side | 35% gold |

Relic coverage across the table: Strength 4, Cut 3, RockSmash 3, Fly 3, Waterfall 3, Dive 3, Flash 3, Surf 2. The skew toward Strength and away from Surf is deliberate and tunable in one column.

**Copy is written from the template, not bespoke per event.** Each event supplies the hook line, four option labels, and the toll price. Outcome contents come from the tier pools. If you find yourself writing a bespoke outcome for one event, the pool is missing an entry.

---

## Part 5: What this retires

Delete these rules rather than flagging them off, and record the replacement in `docs/generation.md`.

- **"Events pay at every band. A player with nothing is not punished, only unrewarded."** Retired. T0 punishes. The floor is now that the Safe option exists on every event, so a player who wants no downside can always take a flat T1 and walk. Downside is opt in, not imposed.
- **Three capability bands as the outcome selector.** Bands selected the outcome. They now only decide whether the Attune option is present. If `latent` is dead under relics, collapse to a boolean and delete the dead band.
- **The 4.6c note about weighting events toward capabilities nobody would slot voluntarily.** That reasoning was about move slots. Relics cost no slot, so it is void.

---

## Part 6: Determinism and versioning

- **Draw every tier outcome for every option at map generation**, from the `rewards` key, regardless of which option the player picks and regardless of relic state. RNG consumption per event node must be constant. This is the same rule 4.6c applied to the three bands and it is why relic state cannot shift a stream.
- Rarity and pool exhaustion order are drawn at map generation too.
- **Log the option ID, never the index.** The option list length varies with relic state, so an index is not a stable identity. If the log currently stores an index, this is a schema change and it bumps `RUN_LOG_VERSION`. Bump it, and reject a pre-patch log loudly with a message naming the mismatch.
- `contentHash` moves, since `data/events.ts`, `data/eventPools.ts` and `data/scaling.ts` all change. No hand bump needed, but confirm the new hash and update the seed string prefix in any docs that quote it.
- `randomizerVersion` bumps once: draw composition inside the event node changes.
- Stream isolation tests pass unchanged.

---

## Part 7: Simulator

Add to the report:

- Outcome tier distribution across all resolved events, split by rarity and by whether the relic was satisfied.
- **Attune availability rate**: the fraction of events where the party held the matching relic. If this is under about 15 percent, relics are decoration and the fix is relic acquisition rate, not the event table.
- T0 rate and the mean HP and gold actually lost to events per run.
- Take rate per archetype under a greedy policy. If any archetype takes more than about 60 percent, the menu is decorative.
- Add `--policy event-gambler` (always Gamble, Attune when available) and `--policy event-safe` (always Safe). The gap is the crude test of whether the variance is worth taking.

**Benchmark posture unchanged.** Record mean gyms cleared with its seed prefix, seed count and AI version, compare against the pinned benchmark, and keep going. Do not stop to retune. Determinism, stream isolation, version guards and the suite still gate absolutely.

Expected direction, as a hypothesis: `event-gambler` should beat `event-safe` by a visible margin, because the Gamble distribution's expected value exceeds a flat T1 at every rarity. If it does not, the T0 costs are overtuned relative to the T2 payouts and the fix is in `data/eventPools.ts`.

---

## Part 8: UI

Event screen, reusing existing components only.

- Every option shows its archetype cost and its outcome tier range as plain attributes. Toll: the exact price and `Reward: T2`. Gamble: `Reward: T0 to T2`. Safe: `Reward: T1`. Attune: the relic name and `Reward: T2 to T3`.
- **Part 4 editorial carve out.** Tier labels are ordinal and Part 4 bans ordering that implies ranking. They are allowed here on the same precedent as the `BAND n` badge: the label names which pool the outcome draws from, which is an attribute. Record the carve out in `docs/generation.md`. Nothing else moves: no recommendation, no highlighting of the better option, no expected value shown, no marker on the Attune option beyond the relic requirement it already carries.
- The map already reveals the relic requirement and the party's band. Add rarity to that readout, since rarity now changes the payout distribution and a player routing toward an event deserves to know which one they are routing toward.
- The T0 consolation must render on the result screen as its own line. A cost that appears without its consolation reads as the game taking something and giving nothing, which is the exact misread that made the old "unrewarded, not punished" rule exist.

---

## Tests required

1. Every event resolves to exactly one tier, and T3 is unreachable across many seeds with no relic satisfied.
2. RNG consumption per event node is identical for two runs on the same seed with deliberately different relic sets. Assert directly.
3. Option ID logging: a run replays identically when the relic state changes the presented option list, including a save taken between the event prompt and the choice.
4. T0 always grants its consolation. Property test over the whole T0 pool: no outcome is a pure cost.
5. Gold and HP tolls never take a member below 1 HP, never faint anyone, and never take gold below zero, including through a replayed log.
6. Pool exhaustion: no event ID appears twice in one run, over many seeds.
7. Rarity distribution matches the table within tolerance over many seeds, per segment band.
8. A T2 Pokemon outcome spawns an encounter, victory offers the capture, and declining still grants the T1 fallback.
9. Version guard: a pre-patch log throws with a message naming the mismatch.
10. Determinism and stream isolation pass unchanged. All existing suites pass, except those asserting events never punish, updated with a comment naming this patch rather than deleted.

---

## Order of work, stop for review after each

1. The four report questions. Report, do not code.
2. `data/eventPools.ts`, tier definitions, distributions. Unit tests. No wiring.
3. Option archetypes in `core/events.ts`, outcome resolution, map generation draws, determinism tests. No UI.
4. Costs: HP, gold, and forced discard outcomes wired through run state, with the safety clamps.
5. Option ID logging and the version bump. Headless `playRun` with a policy that takes every archetype.
6. The 24 event entries in `data/events.ts`.
7. Simulator policies and report additions. Record the benchmark row.
8. UI last, as always.

---

## Definition of done

A player sees a question mark two steps ahead, checks that they hold Strength, and routes three nodes out of their way to reach it. A different player without Strength reaches the same node, takes the Gamble, loses a quarter of their party's HP going into a gym, and can name exactly which decision did it. The simulator reports a visible gap between `event-gambler` and `event-safe`, and no archetype takes more than 60 percent of picks.

---

## Defaults I am taking, flagged for review

- **Safe option on every event.** Without it, an event node becomes a forced bet, and a forced bet on a map where the player chose the node is a punish for routing. The alternative is removing Safe and letting Gamble be the floor, which makes events strictly scarier and is a one line change if you want it.
- **T3 is relic gated with no exceptions.** Per your instruction. It means a run that finds no relics never sees the top tier, which is a strong statement about relic acquisition rate being the real lever.
- **Three options without the relic, four with.** Not two and three. Four options on a phone is the ceiling before the screen needs scroll, and the Pocket density mode will have to prove it fits.
- **Tolls are paid before the outcome is known to the player but the outcome is guaranteed.** So a Toll is a price, not a bet. If you want Tolls to be bets too, that is a distribution change, not a code change.
- **Rarity is shown on the map.** Arguable. It makes routing more informed and reduces the surprise that the question mark is supposed to carry. Hiding it is a one line UI change.
