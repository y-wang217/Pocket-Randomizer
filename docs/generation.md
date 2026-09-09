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

## 1b. Keyed sub-streams, and what stopped being a contract

**Stage 4.6a moved every draw in the game onto a keyed sub-stream.** A stream is
no longer one sequence per run: `rng.map.at('seg3/cave/route')` is a sequence of
its own, derived from the seed, the stream name and the key, and independent of
every other key. `src/core/streamKeys.ts` is the namespace and
[`gymrun-seeds-and-mappability.md`](spec/gymrun-seeds-and-mappability.md) is the
argument.

Three things follow, and the third is the reason the stage did it:

- **The pass list below is no longer a draw order.** It is still a pass list —
  pass 2 needs pass 1's kinds, and the passes read well — but "the list only
  ever grows downward", the discipline every stage from 3 onward followed, is
  retired. Reordering the passes is a refactor now, not a break.
- **A new draw's blast radius is one key.** A draw added to a node's reward
  offer moves that node's cards. It cannot move the node beside it, that node's
  team, or its battle seed.
- **A new key costs nothing at all.** Which is what lets 4.6b and 4.6c add
  draws without every seed's map moving underneath the report that measures
  them.

What did *not* change: order **within** a key is still a contract, eager
generation is still the rule, and a payout is still drawn when the map is built
rather than when a node is completed. Those arguments were never about stream
layout.

## 1c. Locales, and generating a road you will not walk

**Stage 4.6a opens a segment on a locale choice.** Two or three regions are
offered (`tuning.localeOfferCount`), each has its own route, and the player
commits to one before the first step.

- **The offer is a pre-step, not a node.** It consumes nothing from
  `stepsPerSegment`, so the node budget is exactly what 4.5.1 measured and the
  balance table stays comparable across the stage.
- **Every offered locale's route is generated at run creation**, contents and
  all, and the unpicked ones are discarded at selection time. That is §1's rule
  applied to a new decision rather than a new rule.
- **The weighting rule lives in `data/locales.ts`**, not in the generator: a
  locale offered last segment has weight zero, and one nobody has been offered
  outweighs one they have. The generator only knows "sample without replacement
  by weight", which is the same `sampleWeighted` that draws kinds and tiers.
- **A locale decides the wild species pool and nothing else.** Not trainers, not
  shops, not rests, not tiers, not the gym. A locale is where you are, not how
  hard it is — and a second dial on difficulty is a dial the balance report
  cannot attribute.

### Why generate three roads to walk one

With keyed sub-streams the alternative — deriving the picked locale's route at
selection time — produces the *identical* route, because a route is a function
of `(seed, 'map', 'seg<i>/<locale>/route')` and of nothing else. So the choice
is made on other grounds: eager generation is what the codebase already does
everywhere, and a lazy path would be a second way for content to come into
existence, differing from the first only in circumstances nobody would think to
test. The cost is a few hundred microseconds and some data nobody sees.

A replay also needs the unpicked routes to still be there. A log records the
locale as an **index into the offer**, like every other decision it stores, and
resolving that index requires the offer and its routes reconstructed exactly.

### The composition guarantees

Enforced in pass 1, per route, in a fixed order, with a set of *claimed* steps
so that one guarantee cannot satisfy itself by breaking another:

| guarantee | tuning | how |
|---|---|---|
| Exactly one unavoidable wild encounter | `wildStepsPerSegment` | one step's options are **all** wild, `wildStepOptionCount` wide |
| At least one event offered | `minEventSteps` | convert a step's last option if none rolled |
| At least one reachable rest | `minRestSteps` | as before, no earlier than `restEarliestStep` |

The wild step is the one place `distinctKindsPerStep` is deliberately broken: a
wild encounter has to be reachable *whatever* the player picks, and a step with
one option is not a choice — this codebase already refuses to hand `chooseNode`
a list of one. It stays a decision because the options carry **different
tiers**, which is on the map before the click.

Its width is a constant (`wildStepOptionCount`), not the number of tiers the
segment can draw. Deriving it from the tier weights was the first version and
`test/tiers.test.ts` rejected it immediately: it made `tierBands` reshape every
map, and the rule that table is tuned under is that it moves risk and nothing
else.

## 2. The passes

`generateSegment(index, rng, tuning, offerContext)` runs its passes over keyed
sub-streams.
They are separate on purpose, and the boundaries between them are the parts that
would be expensive to change later.

### Pass 0 — the locale offer, from `map`, keyed per segment

Two or three locales, sampled without replacement by `localeOfferWeight`. The
context — what the previous segment offered, and what the run has offered at
all — is threaded by `createRun`, which is the only reason segments are
generated in order.

### Pass 1 — shape, from `map`, keyed per route

1. The number of steps, from `tuning.stepsPerSegment`.
2. For each step, in order: how many options (`tuning.nodeChoiceCount`), then
   which node *kinds* they are.
3. The composition fix-ups (see §4 and §1c), which may rewrite kinds.
4. For each step, in order: the **tier** of each of that step's battle nodes.

Kinds are sampled **without replacement** when `tuning.distinctKindsPerStep` is
on, and the option count is capped at the number of kinds available. The map
hides encounter contents, so two wild nodes side by side read as one option
printed twice — that is not a choice, it is a choice-shaped rectangle.

**Tiers are the Stage 3 addition, and their position in the sequence is the
contract.** Three decisions are recorded in it:

- **They come from `map`, not from `randomizer`.** A tier is part of the *shape
  of the choice*: the map screen shows it before the player knows anything about
  what the node contains. Putting it on `randomizer` — where the encounter it
  scales is rolled — would also mean a randomizer change could reshuffle the
  risk profile of a recorded seed's map.
- **They come after the rest fix-up.** The fix-up rewrites node kinds, so a tier
  drawn before it could belong to a node that is no longer a fight, which would
  strand a draw in the middle of the sequence.
- **One draw per fight, and none for anything else.** Rest nodes and gyms take
  no tier draw and carry no tier. How many draws a step costs is therefore fixed
  by pass 1 step 2, before any tier is known — so retuning `tuning.tierBands`
  changes which tier every node carries and changes nothing at all about the
  map's shape. `test/tiers.test.ts` asserts exactly that.

Tiers within one step are sampled **without replacement** too
(`tuning.distinctTiersPerStep`), for the same reason kinds are: a step offering
two `hard` fights is one trade printed twice.

### Pass 2 — contents, from `randomizer`, keyed per node

For each node, in index order (step 0 option 0, step 0 option 1, …, then the
gym): the whole team, member by member. Within a member the order is species,
level, ability, then moves in slot order.

This runs after pass 1 completes, which is what lets the rest fix-up rewrite a
node's kind: at the point the fix-up runs, nothing has yet been drawn for that
node's contents, so changing its kind does not strand a draw.

**The stream changed in Stage 2** — from `map` to `randomizer` — and that is the
change the whole stage rests on. A randomizer adds draws constantly (a fourth
move slot, a tier modifier, a bigger gym team), and every one of them would
otherwise have shifted the *shape* of every map generated after it. The shape is
now fixed by `map` and the contents by `randomizer`, and neither can move the
other. `test/randomizer.test.ts` asserts it directly rather than trusting it to
the construction.

### Pass 3 — sim seeds, from `battle`, keyed per node

One `sodium` PRNG seed per battle node, in the same index order.

This is a separate pass and a separate stream so that changing what a node
*contains* cannot shift the damage rolls of a node earlier in the map.

It also fixes a bug that would otherwise be invisible: `createBattle` derives
its PRNG seed from the run seed, so a run that let every battle do that would
play the *same* damage rolls, crits and accuracy checks in every fight, eight
nodes running. `test/generation.test.ts` asserts every battle in a segment gets
a distinct seed.

### Pass 4 — payouts and contents, from `rewards`, keyed per node and purpose

One sweep in node index order, filling in whichever of three things the node
needs:

| node | drawn |
|---|---|
| has a tier (wild, trainer) | the three-card reward offer |
| `shop` | the shelf: N items, each with a price |
| `event` | the prompt, and **one resolved outcome per choice** |

Rests and gyms take no draw at all.

**This is the decision §1 was written for, one level down.** The build spec
allows drawing an offer when the node is *completed*; this draws it when the map
is built, and the reason is that a lazy draw would make the roll a function of
*how the battle went*. Turn count, damage rolls consumed, whether a move
missed — all of it would sit between the node starting and the offer being
drawn. Two players on the same seed making the same choices would get different
rewards because one of them got a critical hit.

Drawing early is not revealing early. `playRun` asks the player which card they
want **after** the fight, and only when `winner === 'p1'`. A lost fight pays
nothing, which is what makes an elite node a risk rather than a slower payout.

It is pass *four* — appended rather than inserted — because appending a pass
cannot move the three before it. Every seed's map shape, encounter contents and
battle PRNG seeds are the same with rewards as without.

**An event's coin is flipped here, not when the player picks.** A choice in
`data/events.ts` carries weighted outcomes; the instance on the map carries
exactly one per choice. So an event that reads "might be a trap" has already
resolved before the player sees it — reloading a save cannot reroll it, and two
players on the same seed who make the same choice get the same result. Resolving
at pick time would mean the seed stops fixing the run, which is the one promise
the whole design exists to keep.

The event draw is the only one in the codebase whose *count* depends on what it
drew — different events have different numbers of choices. That is safe because
it is the last thing a node consumes from `rewards`, and nodes are visited in a
fixed index order, so a variable count inside one node shifts only that node's
successors on that one stream. What it must never do is move `map`,
`randomizer` or `battle`, and it cannot: it never touches them.

### Pass 5 — encounter captures, from no stream at all

Every **wild** node offers the Pokemon it just fielded, if the player wins.
Trainers and gyms offer nothing: a trainer does not hand over their team and a
gym leader certainly does not.

**Stage 4.6a removed the roll.** This was one draw per wild node at a rate keyed
to tier (0.55 / 0.7 / 0.85), and the pass existed partly to keep that draw count
independent of the tier table. There is no rate now, so the pass consumes
nothing.

The argument for removing it is the one this whole document is about. A capture
roll on a *seeded* run is a punch with no counterplay: the player cannot see it,
change it, or learn from it, and two players on one seed who both win the same
fight end up with different parties for a reason neither of them can name. The
cost the rate was standing in for is now a cost on the map — a segment
guarantees exactly one wild encounter and it occupies one of that segment's
limited steps — so the question becomes "is this worth a slot", which is a
decision, rather than "did the seed feel like it", which is not.

The offer is the node's own lead, **exactly as it was fought**: level, moveset,
ability, gender and held item. 4.5.1 re-levelled it down to
`joinLevelFor(segment)` as the price of a free Pokemon; the price is the step and
the slot now, and a captured Pokemon weaker than the one just beaten is a readout
the player cannot square with what they watched. Species *reward cards* still
join at the discount — they cost no step at all.

Two properties survive from Stage 4, and both are asserted in
`test/capture.test.ts`:

- **The offer is the node's own lead, never a fresh roll.** One species
  generation path, not two.
- **Whether an offer appears cannot depend on how the battle went** — only on
  whether it was won.

A held item on a captured Pokemon goes to the **backpack**, not into its hands.
That is the reading of the spec that makes its next sentence work: going over
capacity triggers the existing discard choice, which can only happen if the item
lands in the bag. Nothing is lost — the party screen hands it straight back for
free.

It stays a pass rather than folding into `buildNode` because it is still a
*payout*, and it belongs beside the other four things a node pays. The key
(`node/<id>/capture`) already exists for the day a capture needs a draw again.

### Node kinds

Stage 3 took the choosable kinds from three to five:

| kind | tier | encounter | pays currency |
|---|---|---|---|
| `wild`, `trainer` | yes | yes | yes |
| `gym` | no — it is the segment's difficulty statement | yes | yes |
| `rest` | no | no | no |
| `shop` | no | no | no |
| `event` | no | no | no |

`BattleKind` in `data/tuning.ts` is the narrowed set of the three that fight,
and the curve tables in `data/scaling.ts` are keyed by it. That replaced
`Record<NodeKind, …>`, which had already accumulated a meaningless
`rest: { min: 0, max: 0 }` row and would have grown two more.

### Before all of it — starter options

`generateStarterOptions` draws from the `randomizer` stream **before** the first
segment, so widening the starter pool changes what a recorded seed offers but
does not reshape its map.

The player's Pokemon is randomized like everything else — species, ability and
moveset. A randomizer where the opponents are randomized and the player's
Pokemon is a curated set piece is a game about reacting to chaos rather than a
game about playing it. The one concession is the band window in
`data/starters.ts`, which is also Stage 5's unlock seam.

## 3. Levels and tiers

```
player level    = scaling.SEGMENTS[segment].playerLevel
encounter level = player level
                + draw(scaling.SEGMENTS[segment].levelOffset[kind])
                + scaling.TIER_MODIFIERS[tier].level
```

A tier does exactly two things, and `data/scaling.ts` owns the first of them:

| axis | where | normal | hard | elite |
|---|---|---|---|---|
| level | `TIER_MODIFIERS[t].level` | +0 | +3 | +1 |
| stat quality | `TIER_MODIFIERS[t].band`, applied to both band windows | +0 | +1 | +2 |
| team size | `TIER_MODIFIERS[t].team`, on top of the segment's advantage | +0 | +0 | +1 |

`hard` buys difficulty with levels and stat quality; `elite` buys it with a
second Pokemon and *pays* for that with levels. That asymmetry is the Stage 2
finding applied at node scale — team size is the dominant lever at `PARTY_SIZE`
1, and a step up in team size not paid for elsewhere is a wall rather than a
curve. It also keeps the axes attributable: an `elite` that exceeded `hard` on
every column at once would leave the balance report unable to say which column
moved a number.

The second thing a tier does is select a reward pool, and that lives in
`data/rewardPools.ts`. The rule there is that **elite pools contain strictly
better entries, not merely more entries** — the expected value of three draws
from one table is the expected value of that table however many times you shake
it, so a pool that was the normal pool plus extras would produce no gradient at
all and the simulator would correctly report the tier as noise.

A reward pool entry may carry a `bandOffset` on top of the node's tier shift, so
an elite node's tutor reaches two bands above an elite node's *encounter*. Both
shifts go through the same clamp-and-widen rule below.

A tier **shifts values and never consumes a draw** inside the randomizer. A
`hard` node and a `normal` node in the same map position roll the same number of
times, so the tier a node carries cannot reshuffle anything downstream of it.

### The band ceiling

`speciesBandsFor` and `moveBandsFor` clamp the shifted window to the highest
band the generated pool actually contains, then widen it back downward to its
original width. Both halves are load-bearing. Without the clamp, segment 7's
`elite` window asks for species band 6, the filtered pool comes back **empty**,
and generation throws mid-map. With the clamp but without the widening, that
same window collapses onto band 4 — the eighteen strongest species in the game —
and every elite fight in the last segment would draw from the narrowest pool
there is.

The consequence is that a tier which has run out of headroom stops raising stat
quality and keeps raising level and team size. That is a curve that flattens
rather than one that crashes, and it is the honest answer: the table has five
species bands and the last segment already draws from the top two.

Stage 1 computed this as `starterLevel + segmentIndex * levelPerSegment`. It is
an eight-row table now, because a multiplication is a straight line and a
straight line is the one difficulty curve you cannot bend at the segment the
report says is a cliff.

There is no XP and no grinding. The player's level is a pure function of segment
index and moves exactly once per segment, when a gym falls. Encounters chosen
within a segment affect *what you get*, not *how strong you are*.

The offsets that ship were measured, not guessed — see docs/balance.md.

## 4. Guarantees generation makes

| Rule | Why |
|---|---|
| No rest node before `tuning.restEarliestStep` | A rest on step 0 heals nothing, and a step whose only interesting option is a no-op teaches the player the map does not matter |
| At least `tuning.minRestSteps` steps offer a rest | Weighted draws can produce a segment with nowhere to heal. That is not a hard run, it is a run whose seed decided the outcome |
| No two options in one step share a kind | The map hides contents, so a repeated kind is a duplicate button |
| The gym is never an option | It is not a choice, so it must not reach `chooseNode` — a policy asked to pick from a list of one records a decision the player never made |
| Every *fight* carries a `tier`, and nothing else does | A rest node and a gym have `tier: null`, not `'normal'`. Stage 3 keys reward pools off the tier, and `REWARD_POOLS[node.tier]` on a `'normal'` rest node would compile perfectly and be wrong. Absence makes it a type error at the call site |
| A step's fights carry different tiers | The tier is the whole of what the player can see about a node's trade. Two `hard` fights in one step is a decision-shaped rectangle |
| `elite` never appears in segments 0-1 | Not for fairness — the player can decline it — but for legibility. A tier label is worthless to someone with no baseline for what a normal fight costs |
| Only wild nodes carry an `acquisition` | A trainer does not hand over their Pokemon, and the offer is the *defeated* species, so a node with no encounter has nothing to offer |
| **Every** wild node carries one | Stage 4.6a: capture is guaranteed, not rolled. A capture roll on a seeded run is a punch with no counterplay; the cost is the step the encounter occupies. See pass 5 |
| An acquisition offer is the node's own lead, at its own level | One species generation path, not two, and no discount — the price is the step and the slot |
| Exactly one wild step per route, all of its options wild | The guaranteed encounter has to be reachable whatever the player picks. Its options carry different tiers, so it is still a decision. See §1c |
| At least one event and one reachable rest per route | The floor under capability events and under the 4.5.1 rest cut |
| The party can never exceed `PARTY_SIZE` | Enforced in `acquisition.applyAcquisition`, which *refuses* an illegal decision rather than clamping it — a decision silently turned into a different decision is a log that replays into a different run |

## 5. What a seed does *not* fix

The seed fixes the map, the encounters and the PRNG for each battle. It does
not fix the run: the player's decisions do the rest. Two players on the same
seed making the same choices get the same run, turn for turn. Two players on the
same seed making different choices get different runs on the same map — which is
the property the whole thing exists for.

## 5b. Money

Currency is a single scalar on `RunState` and **may never go below zero**. That
is enforced in `core/economy.ts`, on the transition, not at the shop screen: the
same purchase arrives from a replayed log and from the balance simulator, and
neither has buttons to grey out.

A basket is committed whole or refused whole. A player who selects three things
and can afford two has not said *which* two, so a partial purchase would be a
decision nobody made — and an unaffordable basket in a faithful replay is
impossible, so a log that asks for one is corrupt and throws rather than
quietly reconstructing a run that was never played.

Every currency number — payouts, tier multipliers, prices, the segment scale —
is in `data/shop.ts`. An economy is only ever balanced as a *ratio* between what
a fight pays and what an item costs, and two numbers that have to agree should
not live in two files.

---

A reward decision is an **index**, never the reward. The offer was drawn from
the `rewards` stream when the map was built, so replaying the seed reconstructs
all three cards; a log storing `{kind:'item', item:'leftovers'}` would keep
replaying happily after a pool edit and hand the player an item their run never
offered.

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

`npm run sim -- --seeds 1000` plays a thousand full runs headless under two
policies and reports the distribution. **docs/balance.md carries the report and
the four findings that moved the numbers**; this section says only where the
numbers live.

| file | holds |
|---|---|
| `data/scaling.ts` | the curve: eight rows of level, band window and team size |
| `data/starters.ts` | what the player begins with, including the move band |
| `data/tuning.ts` | map shape, rest, and recovery between segments |
| `data/blacklists.ts` | the exceptions, each with the evidence that earned it |
| `data/speciesPools.ts`, `data/movePools.ts`, `data/abilities.ts` | generated from the dex by `npm run gen:pools`; the inventory, not the levers |

If a balance pass ever requires editing `core/randomizer.ts`, the split between
logic and data is wrong and that is the bug to fix first.

## 7. Versioning, and the thing that silently breaks a seed

A `RunLog` carries three strings:

- `seed` — the run.
- `version` — the log format and the engine. Moves when a decision sequence
  would replay differently because the *engine* changed.
- `randomizerVersion` — the data and the draw order. Moves when a tuning pass
  changes what a seed *rolls*.

The second one is the interesting addition. A band window widened in
`scaling.ts` leaves every recorded decision sequence perfectly replayable and
quietly reinterprets it as a completely different run — the worst available
outcome for a game whose whole promise is that a shared seed is a shared run.
So it is checked separately, with its own message, and a mismatch throws rather
than replaying.

`RUN_LOG_VERSION` went to `gymrun-run-4` and then `-5` in Stage 3, as
`RunDecision` grew a `reward` member and then `shop` and `event` members. A Stage 2 log replayed against this build would run out of step
the first time a node paid out — the run asks for a reward decision and finds a
battle one — but only *partway through*, after reconstructing several nodes of a
run that was never played. The guard refuses it up front and names both
versions.

Bump `RANDOMIZER_VERSION` in `core/randomizer.ts` for: a regenerated pool, a
moved band window, a changed level curve, a new draw inside `rollMoveset`, a
reordered data table. It went to `-2` on the first balance pass, where not one
draw changed position and every seed rolled a different team anyway.

## 8. Capabilities, and why `latent` is not a learnset

Stage 4.6c gates some routes on a capability — Surf, Fly, Cut and five others.
A party reads at one of three bands for each: `known` if a member has the move
in a slot, `latent` if nobody has it but somebody could plausibly carry it,
`none` otherwise. `core/capabilities.ts` resolves it; `data/capabilityTypes.ts`
holds the table.

`known` needs no table. `latent` is the one that had to be decided, and the
obvious answer was a real gen 7 learnset: ask the dex which species can
legally learn Surf, and let a party of eligible species read `latent`.

**That was built as far as measuring it, and then rejected.** The measurements,
so the decision can be re-opened on evidence rather than re-derived:

- A generated table keyed by capability over the 635 species reachable through
  `speciesPools.ts`, `starters.ts` and `locales.ts` costs **12.8 kB** of source.
  The full national dex costs 26.2 kB. Size was never the problem.
- It needs a codegen script, because the bundle has no learnsets: the Vite
  plugin in `build-config/trim-sim-data.ts` strips them, correctly, and turning
  that off to answer a map-screen question would trade ~5 MB for one band.
- It needs a prevo walk. A species learnset entry holds only that species' own
  moves, so Raichu resolves `none` for Surf and for Fly without one — both sit
  on Pikachu. Kleavor inherits Cut from Scyther, Annihilape Strength from
  Primeape. This is not an edge case; it is most of the third stage of the pool.
- It needs a generation filter. `Dex.forGen(7)` and `Dex.mod('gen7')` return the
  *same* modern learnset table, with sources tagged per generation
  (`gyarados.surf → ['9M','8M','8V','7M','7V','6M','5M','4M','3M']`), so a
  plain `!!learnset[move]` answers yes for moves only learnable in gen 8 or 9.
- It needs a drift test, byte-identical against a regenerated table, because a
  dependency bump that quietly moves a species between bands is exactly the
  failure this project spends effort preventing elsewhere.

None of that is prohibitive. The reason it was dropped is that **legality is
the wrong question for this game.** GYMRUN runs Custom Game specifically so the
randomizer can hand the engine a Magikarp with Levitate and Boomburst. Move
legality is not a rule this project enforces; it is a rule it exists to break.
A `latent` band read off a legality table would be the single place in the game
that asked whether a Pokemon is *allowed* to know something, and it would have
answered out of a table nothing else consults.

It is also worse to play against. A player who sees a Water type pass a Surf
gate has learned the rule. A player who sees one specific Water type fail it
has learned only that there is a table they cannot see.

So `latent` is type-based, and the type sets were derived from the gen 7
learnsets rather than invented — queried once, offline, ranked by which types
can actually learn each move, then edited where the ranking was an artifact
rather than a theme. `data/capabilityTypes.ts` carries both the ranking and the
edits, and names the one lever that was deliberately not pulled: `surf`,
`waterfall` and `dive` are all Water alone, so one type clears three of the
eight gates. 4.6c ships the simulator's per-band gate pass rate, which is the
instrument that would say whether that needs splitting. Splitting it first
would be guessing.

**Slots are checked before types**, and the order is load-bearing rather than
an optimisation: teaching a capability move always yields `known`, whatever the
member is. A fix the map screen offered and the party screen refused for some
species would be a broken promise, and it is exactly what a legality-based
`latent` would have produced. `test/capabilities.test.ts` asserts it as a
property across all eight capabilities, from both prior bands.

The decision is not scheduled for revisiting. If it is revisited, the numbers
above are the starting point.

## 9. `contentHash`, deferred

`gymrun-seeds-and-mappability.md` specifies a `contentHash` computed over the
data tables, replacing the hand-bumped `RANDOMIZER_VERSION`, plus seed strings
that carry that hash and a `previewRun` that builds a map without playing it.
None of the three is built. `RANDOMIZER_VERSION` is still hand-edited, and the
`hmLearnsets.ts` that would have been the first entry on the hash's file list
is not being built either.

They are **their own release, scheduled after 4.6c and before the freeze**, for
the reason the seeds document gives: the freeze stamps a `contentHash` as the
first shareable baseline, and it cannot be stamped without one. They are
deliberately not bundled into a data-generation step — a hash mechanism built
as a side effect of shipping a table is a mechanism nobody reviewed.

Until then the hand bump stands, with the failure mode the seeds document names
and this paragraph does not solve: a forgotten bump silently reinterprets a
shared seed. `docs/keyed-streams.md` tracks what is missing.
