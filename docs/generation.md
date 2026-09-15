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

### The one discipline keying requires

**A key must be a stable string, never derived from anything that varies with
player behaviour.** No turn counts, no party size, no visit counts. A key
containing any of those reintroduces the exact coupling the refactor removed,
and it does it invisibly: the draw still happens, the test still passes, and two
players on one seed diverge because one of them switched more often.

`core/streamKeys.ts` says the same thing from the other side — *a key names a
thing that draws, never a moment in time* — and the two phrasings are one rule.
`node/s3-cave-2-0` names a thing; "the fourth draw of segment 3" names a moment.
The design document
([`gymrun-seeds-and-mappability.md`](spec/gymrun-seeds-and-mappability.md)) asks
for the rule to be recorded here specifically, and until Release 0.5 it was in
`CLAUDE.md` and `keyed-streams.md` but not in the file the design named.

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

The offer is the node's own lead: moveset, ability, gender and held item, exactly
as they were fought.

**The level is the exception, and Stage 4.7 made it one.** A joining Pokemon
arrives at `playerLevel(segment)` — the same level the rest of the party is
sitting at — whatever level it was fought at. See §11.

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
| An acquisition offer is the node's own lead | One species generation path, not two — the price is the step and the slot |
| An acquired Pokemon joins at `playerLevel(segment)` | Stage 4.7. Only the level normalizes; moveset, ability and item are the ones that were fought. See §11 |
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

## 7b. Party slots, and the one number the curve reads

**Stage 4.8, item 1. `RANDOMIZER_VERSION` is `gymrun-randomizer-13` from here.**

Party capacity used to be `PARTY_SIZE`, a module-scope constant in
`data/partyTuning.ts`, and the whole of item 1 is that it is now a function of
**gyms cleared**:

| gyms cleared | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| party slots | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 6 | 6 |
| backpack (`+ backpackSlack`) | 5 | 5 | 6 | 6 | 7 | 7 | 8 | 8 | 8 |

`SLOT_UNLOCK_SCHEDULE` is the table; `partyCapacityAfter(gyms)` is the only thing
that reads it; `core/run.ts`'s `partyCapacity` is the `RunState` form and composes
it with `gymsCleared`. Nothing else in the codebase computes a capacity.

**`PARTY_SIZE` was deleted rather than kept beside the schedule.** A constant
named for the party's size is what a later call site reads instead of asking how
wide the roster is now, and the prompt names the consequence exactly: a slot
unlock that does not reach the capture flow means a player is told they have room
and then asked to replace someone. Removing the name is what forced all sixteen
read sites through review; the compiler found them, not a grep.

### Why this moves a version axis

`scaling.expectedPartySize` reads the schedule as its **cap**, and
`opponentTeamSize` is `expectedPartySize(segment) + advantage`. So the schedule
reaches opponent team sizes, team sizes decide how many Pokemon are drawn, and a
different count moves every draw after it in that node's sequence.

Two quantities meet there and they are **not the same number**, which is the
distinction section 3 of `balance.md` paid for once already:

- `partyCapacityAfter(segment)` is what the player is *allowed* to field.
- `EXPECTED_PARTY_SIZE` is what they are *measured* to field.

The second may never exceed the first, and `test/party-slots.test.ts` asserts it
at every segment. Sizing opponents against the ceiling instead of the measurement
is the largest single finding of the Stage 4 balance pass, pointed the other way.

`EXPECTED_PARTY_SIZE` moved from `[1, 2, 2, 3, 3, 3, 3, 3]` to
`[1, 2, 2, 3, 4, 4, 5, 5]`. **Segments 0 to 3 are unchanged to the number**, so
the early benchmark rows stay comparable across the patch and a move in them
means something other than this landed. The four rows that did move extend the
*rate* the original rows measured — `[1, 2, 2, 3]` is about seven tenths of a
Pokemon per segment, not one, because filling a slot takes a wild encounter and
players decline — which carried on from 3 gives 3.7, 4.4, 5.1, 5.8. That lag is a
*claim*, and the simulator's `party.sizeBySegment` section is what holds it to
account: it prints the measured party beside this column, segment by segment.

### The engine's limit decides the last row, and the suite is what found it

`opponentTeamSize` is `min(MAX_TEAM_SIZE, expectedPartySize + advantage)`, and
`MAX_TEAM_SIZE` is **6 because six a side is the engine's hard limit**. So the
*assumed* party size cannot reach 6 without the clamp binding for every tier at
once. The first cut of the table did reach it, and at segment 7 the result was:

| segment 7, trainer node | normal | hard | elite |
|---|---|---|---|
| assumed 6 (first cut) | 6 | 6 | **6** |
| assumed 5 (shipped) | 5 | 5 | **6** |

A normal, a hard and an elite node all fielding six is **Stage 3's entire risk
gradient disappearing at the end of the run** — the thing tiers exist to be. The
same clamp took the gym's advantage at that segment from +2 to +0.

`test/tiers.test.ts`'s "orders normal < hard < elite at every segment" is exactly
that invariant, and it is what caught this. Two assertions there went red on the
first cut; nothing else in the suite noticed.

**So the curve assumes one fewer than the player may field, and the slot schedule
still reaches six.** A player who fills every slot is a Pokemon ahead of what the
last two gyms are sized for — a reward for having filled it, rather than a
miscalibration, and the only alternative was a flat endgame where the elite node
and the ordinary one are the same fight. Levels and band windows could have
absorbed it instead; they are encounter difficulty, which this patch puts out of
scope.

The rule is `EXPECTED_PARTY_SIZE[last] < MAX_TEAM_SIZE`, **not the number 5**, and
`test/party-slots.test.ts` asserts it in that form against both constants by name,
so raising either one fails there rather than silently flattening the endgame and
being noticed a stage later.

### What did not move

`RUN_LOG_VERSION` is unchanged and asserted unchanged. Capacity is derived from
gyms cleared, gyms cleared from history, history from the decision log — so it
reconstructs identically without being stored, consumes no RNG, and adds no
logged decision. The same will hold for nicknames, death records and the score,
which is why this patch moves one axis in total rather than one per item. A
version axis names a content *state*, not a changeset.

`tuning.backpackCapacity` is gone, replaced by `tuning.backpackSlack: 2`. The old
field was `PARTY_SIZE + 2` **evaluated once at module load** and frozen into
`DEFAULT_TUNING`, so the bag was sized from the party at import time and could
not have followed a growing one however the schedule was written. `Tuning` is
passed into a run and must not change inside one, so only the slack can live
there; `core/items.backpackCapacity(slots, tuning)` adds the run's live slots.

`test/fixtures/sim-report.json` is re-minted in the same commit as the bump, which
is the use its header reserves for exactly this case: the diff on that file is the
evidence that the draws moved, and the version string moving beside it is what
stops a recorded seed being silently reinterpreted.

## 7c. The gym pays twice, and segments get longer

**Stage 4.8, items 2 and 3.** Both land under `gymrun-randomizer-13`, which
section 7b already stamped: a version axis names a content state, not a changeset.

### Item 2: a gym clear pays a move *and* a choice of two

| half | what | where it is drawn |
|---|---|---|
| **Part A** | one move, guaranteed, no choice | `GYM_MOVE_ENTRY`, `data/rewardPools.ts` |
| **Part B** | exactly two cards: a relic, or a currency lump | the `GYM` bands, same file |

Both are drawn in pass 6 from the one stream a gym has always used,
`rewards.at(gymRewardKey(segment))`, **Part A first**. Order inside a stream is
the stream's contract, and the move is the guaranteed half, so it is drawn first
and the choice second — which is also the order the player meets them.

**Part A's band reads the existing numbers and introduces none.** The entry's
`bandOffset` is `GYM_MOVE_BAND_BONUS` (+1, `data/scaling.ts`) and it resolves at
tier `elite`, so `REWARD_BAND_OFFSET.elite` adds +2 — the same +3 chain the gym's
own *tutor card* paid at before this item replaced it. `test/gym-rewards.test.ts`
asserts the composition rather than the number 3, so moving either constant moves
the test with it.

**Two cards, not three, and this is the only offer in the game that breaks the
rule.** `GYM_OFFER_SIZE` is its own constant beside `OFFER_SIZE` for that reason —
"how many cards does an offer have" stopped having one answer, and a single
constant covering both would hide it. A relic against a currency lump is a cleaner
decision than either against a padded third option, and the gym already pays a
move beside it. **Do not normalise this back to three.**

What Part B cost, named rather than tidied away: the gym pool's `item` and `tutor`
entries are gone. Premium and Choice items now reach a player through `ELITE` and
the shop alone. The tutor is no longer a card because it *is* Part A. The first is
a narrowing a tuning pass may want to undo; the second is the item working.

### Deviation: item 2 moved `RUN_LOG_VERSION`, which its prompt said it would not

**Recorded 2026-09-10. Protocol 4 — [`spec/README.md`](spec/README.md) — a prompt
is not edited to match what was built, so the deviation is written here instead.**
The prompt is
[`spec/gymrun-stage4.8-claude-code-prompt.md`](spec/gymrun-stage4.8-claude-code-prompt.md).

**What the prompt asked.** Under "Version axes": run log version does not bump,
because "party capacity is derived, nicknames are derived, death records are
derived, score is derived", with an instruction to stop and report before bumping
"because it means something in the derivation is not actually deterministic".

**What was built.** `RUN_LOG_VERSION` is `gymrun-run-12`. All four derived things
are still derived and none of them is logged — that half of the prompt is intact
and `test/party-slots.test.ts` asserts it for capacity. The bump is item 2 Part A's.

**Why.** Part A says the guaranteed move "routes through the existing move
learning flow: recipient selection, then replacement". Those are logged decisions.
A gym win now records a `target`, and a `replace` when the recipient's moveset is
full, **immediately after the gym and before the card pick** — up to sixteen new
entries in a run, the first at the end of segment 0. `RUN_LOG_VERSION`'s own rule
decides it: the guard "does not ask whether the schema changed; it asks whether the
*questions* changed, and a new question in a new place is a changed sequence even
when every entry in it is an old shape". A 4.7 log replayed against this build
would read the gym's move target as whatever its next entry happened to be.

The prompt's stated reason for the stop condition — a derivation that turned out
not to be deterministic — **does not apply**: nothing here is derived. It is a new
reward the player has to aim, and the only way to avoid the bump would have been
to build Part A as a second move-granting path that asks nobody, which the same
item forbids in the same paragraph.

### Item 3: `stepsPerSegment` is a curve

A table in `data/tuning.ts`, one row per segment, read through `stepsRangeFor`:

| segment | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| steps | 4-5 | 4-5 | 5-6 | 5-6 | 5-6 | 6-7 | 6-7 | 6-7 |

45 steps across a run against the old flat 36, so 53 nodes against 44. **Segments
0 and 1 are unchanged**, so the early benchmark rows stay comparable.

It stops well short of Stage 1's shape deliberately. Six to eight was sized for
Stage 1's *single* segment and eight of those measured as "an attrition countdown
rather than a curve"; `test/node-curve.test.ts` guards the run's total against
approaching it again rather than guarding one row.

**The rest guarantee became a density.** It was `minRestSteps`, a flat count,
which was the same statement as a density only because every segment was the same
length. `restFloorFor` takes the larger of the count floor and one rest per
`restStepsPerGuarantee` steps (three), so a 4-5 step segment still guarantees one
and a 6-7 step segment guarantees two. One rest across seven steps is not the
recovery one rest across four is, and the 4.6a guarantee is about recovery.

The other two guarantees stay **absolute per segment** — one reachable wild step,
one event — and `test/node-curve.test.ts` asserts they stay absolute, because
"scale it with length" is the plausible wrong change. The wild step is the capture
the segment owes the player, not a rate.

Every guarantee is checked at **every length the curve can draw**, by driving the
generator at a fixed length rather than hoping real seeds visit the ends.

## 7d. The score, the names, the graveyard, and the map that had to make room

**Stage 4.8, items 4 to 7.** None of these moves a version axis: every one is
derived from a `RunState` a replay rebuilds, which is the argument item 2 could not
make and section 7c records separately.

### Item 4: the score

`core/scoring.ts` counts, `data/scoring.ts` weighs, and neither does the other's
job. The total is the sum of the components **as returned**, in one pass, so the
number a player reads is the list a player reads added up.

Seven components: gyms cleared, elite and hard nodes taken, captures, relics,
survivors, turns. Risk pays because a score that only paid for gyms would teach
players to route around every hard node, which is the opposite of what the tier
system is for.

`turns` is weighted **zero and still computed**, still listed, still rendered. The
data exists for a later decision about pace without this patch taking a position on
fight length. A component that was simply absent would have to be measured from
nothing; one recorded at zero is a column the next pass reads history out of.

Score is a verdict about a *finished* run, so it appears on the result screen and
nowhere else. `test/scoring.test.ts` asserts that per surface and twice over: no
node card, tier badge, reward card, locale screen or pre-gym screen may import either
scoring module, and none may carry the word in a string literal either — the second
catches a surface that computed "+30" inline, which would pass the first.

### Item 5: nicknames, and why they are a correctness feature

`nicknameKey` is the one new RNG key in Stage 4.8. A name is drawn at map
generation beside the draw that created the spec — starters by option index,
captures by node id — so the key names *the thing that offers the Pokemon* and never
the moment the player took it. Being a new key, it shifts no other key's output:
every Pokemon in the game gained a name and no recorded map moved.

**The graveyard is why they exist.** The battle protocol names its victim by
`spec.nickname ?? spec.species`, so before item 5, two Weepinbells in one party were
the same string in every line of the log — `core/battle/contribution.ts` has said so
since 4.7. No work on the death record fixes that, because the ambiguity is upstream.

One real bug fell out of it, found by reading rather than by a test:
`describeSpecCard`'s vitals cache keyed on species, ability, moves, level and item
but **not the nickname**. Free while no spec had one; with every Pokemon named, two
otherwise-identical Pidgeys collide and the second renders under the first one's
name, on every surface at once, from a single cache hit. The nickname is in the key.

`core/graveyard.ts` records **every** faint, not only unrecovered ones.
`reviveFaintedBetweenNodes` is true, so the only faints never recovered are those in
the wipe that ends a run; read literally the graveyard would hold one node's
casualties. Revives are out of scope, so changing recovery to justify a readout was
not available and would have been a readout deciding a mechanic.

**The level is captured at faint time, in `Casualty` itself**, beside the killing
move the 4.7 attribution work already wrote there. `runBattle` reads it off the specs
the battle was built with — the party as of node entry — and `readCasualties` takes a
name-to-level map rather than deriving one, because nothing in that file may see
anything but protocol strings.

The first cut looked the level up in the live party instead, and was wrong twice:
`levelParty` raises the whole party at every gym clear, so a survivor reported the
level it had *climbed to*; and a member released since matched nothing and read null.
One field fixed both, and **a released member now keeps a complete record** — which a
party snapshot per `NodeVisit` would also have done, at the cost of a copy of the
whole party per node.

Both failure modes are pinned in `test/nicknames-graveyard.test.ts`, and both tests
were rewritten once because the first versions were **vacuous**: the level test ran on
a seed with no stale survivor, and the release test's set of no-longer-held victims
came back empty on every seed, so both passed against the broken lookup. The level
test now sweeps every seed and asserts the discriminating case was present; the
release case is a hand-built fixture, because a state that specific is one a fixture
should construct rather than one a sweep should hope for.

### Item 6: the shareable result

`ui/copy/share.ts`, pure, and under `ui/` rather than `data/` so a word changed
there cannot move a seed. Text on a clipboard is the whole feature: no image, no
canvas, no share sheet. The destination is a chat client, which decides the format —
no monospace assumption, no column alignment, and the graveyard capped at
`GRAVE_LIMIT` so a long run is not a wall. `seedLine` is the single place a seed is
rendered into shared text, so `contentHash` replaces it in one function.

### Item 7: the readout moved, and the map had to make room

The threat readout is **off the map** and on the party screen alone. The map renders
the gym leader's name and type chip, so a readout there paired "watch for Ground"
with "the next gym is Ground" — a routing recommendation. Three smoke checks retired
with the placement they protected.

**The map's fold `xfail` is closed**, and it took three changes, each of which bounds
the decision's position rather than shaving pixels off it:

| change | why it is structural |
|---|---|
| taken steps collapse to one line | the current step stops moving down as a segment is walked, so the fix holds at any length in item 3's curve |
| the map's party cards lose their move lists and go to three columns | item 1's six-member roster had made that panel 697px of an 844px phone; ~250px now |
| a step's option cards stop wrapping (grid floor 150px → 96px) | the third card on its own row cost 119px and broke the comparison the row exists to make |

Measured: offered cards end at **737 of 844** on the smoke's own point and **788** at
the worst position a real run reaches; `heights.json`'s `map.decisionBottom` went
728.22 → 669.72. The battle did not move on any field. The `xfail` marker is removed
rather than re-marked, and `phoneCheckExpectedFail` is deleted with it — it worked as
designed on the way out, reporting "passes now; take the marker off" rather than
letting the marker hide a real assertion.

`test/map-fold.test.ts` is the check the fixed-seed ones could not be: it drives the
app to the worst position a run reaches and asserts the two *properties* that bound
the height, not a pixel count that would pass for the wrong reason the first time a
font changed.

## 8. Capabilities, and why `latent` is not a learnset

> **Superseded 2026-09-10. Kept because the measurements are still good.**
>
> Capabilities have been designed three times. Both earlier versions are still
> in `docs/spec/`, and both are wrong.
>
> **Version 1 — HMs as items** (original Stage 4.6c Part C). A separate item
> class: permanent, exempt from backpack capacity, taught into a move slot.
> Retired because it needed a teaching flow, a legality table, and a
> build-config artifact to answer which species could legally learn what.
>
> **Version 2 — HMs as ordinary moves** (QoL rev2 §7, and what the section
> below describes). Capability moves join the general move pools and band
> normally; `known` means a party member has the move slotted. Retired because
> it made capability value track move quality. Surf is a move a player keeps
> anyway, so Surf gates resolved `known` constantly and cost nothing; Cut is a
> move nobody keeps, so Cut gates resolved `none` constantly and were passable
> only by luck. The premise the whole mechanic rested on — that a utility slot
> is a real sacrifice — held for one half of the capability list and collapsed
> for the other, and the same mechanic behaving oppositely depending on which
> move it names is not a mechanic.
>
> **Version 3 — capabilities as relics** (current). A capability is granted by
> a permanent, run-scoped, passive object that occupies no move slot, costs no
> backpack capacity, is never displaced and is never taught. It grants one
> capability and carries one small always-on effect for the rest of the run.
> Chosen over a third variation of the same idea because accumulating passives
> that are not always applicable are the thing that makes a roguelike run feel
> like it is building toward something: a relic that does nothing in six fights
> and wins the seventh is a better object than a move slot that is dead weight
> in all seven.
>
> So there is no such thing as a capability move, and **knowing a
> capability-named move grants nothing** — Surf-the-move and
> Surf-the-capability are unrelated systems that share a name. The `known` band
> as described below is wrong, and the slots-before-types ordering it justified
> is moot, because relics are neither slots nor types. `resolveCapability` now
> takes a `RunState` rather than a party, because a relic belongs to the run.
>
> The type table survives intact, moved from `data/capabilityTypes.ts` to
> `data/capabilities.ts`, and still answers `latent`. Nothing measured here is
> lost.
>
> Two things below stay true and are the reason this section was not deleted.
> The first is the learnset investigation: the 12.8 kB measurement, the prevo
> finding, the generation-source finding, and the argument that legality is the
> wrong question for a game that runs Custom Game. All of it applies to any
> future scheme that wants to ask what a Pokemon could learn. The second is the
> type-affinity ranking the table was derived from, which is real data about the
> games and cost a dex query to produce.
>
> The admission of Cut and Flash to the move pools, which this section's
> reasoning led to, was reverted the same day for the same reason: no move
> proves a capability, so neither move has any special claim on a pool slot.
> `RANDOMIZER_VERSION` went to 9 admitting them and to 10 removing them. See
> `docs/engine-notes.md` for the durable half of that work — the engine will run
> a move the current generation calls nonstandard, which is a fact worth keeping
> even though the feature that needed it is gone.
>
> Under version 3 those two moves are back to being ordinary moves excluded by
> ordinary curation rules, with no relationship to capabilities whatsoever.

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

## 9. `contentHash`, built

**Built 2026-09-11, Branch 1 of the overnight run, on
`claude/overnight-1-contenthash`**, from
[`spec/gymrun-overnight-contenthash-ai-tutorial.md`](spec/gymrun-overnight-contenthash-ai-tutorial.md).
The mechanism `gymrun-seeds-and-mappability.md` specified at 4.6a: a hash over
the data tables, seed strings that carry it, `previewRun`, and the deletion of
the unkeyed stream API. This section says one thing about each.

Until this date the section carried two readings of what the hash covers — a
glob over `src/data/`, argued at Release 0.5, and an explicit file list,
required at 4.7 and re-argued at Release C — and neither was marked superseded.
Both are deleted here, per `CLAUDE.md`: a superseded rule is removed and
recorded with a dated note, not out-argued in a third paragraph. The record of
the two is the git history of this file; the decision is below.

### What it is

`CONTENT_HASH` is a sha256 over the source files under `src/data/`, computed
**at build time** by [`build-config/content-hash.ts`](../build-config/content-hash.ts)
and served to the app as the virtual module `virtual:gymrun/content-hash`, of
which [`core/contentHash.ts`](../src/core/contentHash.ts) is the one importer.
Vitest, `vite-node` and `vite build` all load `vite.config.ts`, so the suite,
the simulator and the bundle see one constant, and nothing is checked in that
could go stale. It is never computed at runtime from bundled data, because the
trimmed bundle is not the source of truth.

It is stable across machines: paths are sorted and hashed as repo-relative
posix paths, contents are hashed rather than mtimes, and line endings are
folded to `\n`. The display form is the first six hex characters; the log
stores the full hash. `npm run content-hash` prints both, and `--files` lists
what it covers. `test/content-hash.test.ts` shuffles the file order, rewrites
the line endings, edits a number, adds a table, renames one, edits a `core/`
comment and edits every excluded file, and asserts the hash moves exactly when
it should.

### Decided: a glob over `src/data/**`, with one exclusion list

**Decided 2026-09-11.** The hash covers every file under `src/data/` minus one
list in `build-config/content-hash.ts`, each entry carrying the reason.

The glob is the design document's own argument applied to itself. The hand
bump was rejected because "a forgotten bump is the failure mode that silently
reinterprets a shared seed"; an enumerated file list that somebody must
remember to extend fails in precisely that way, and had already failed by one
full stage — the design's list of eleven tables was missing eleven
balance-bearing files and naming one that no longer existed. A table added
tomorrow is hashed the day it lands, by construction.

The exclusion list answers the objection Release C raised against the glob,
that a copy edit would invalidate every shared seed, and it answers it with a
rule a test can hold rather than a judgement per file: **a file is excluded
only if nothing under `src/core/` imports it, directly or transitively.** A
file only `ui/` reads cannot change what a seed generates, resolves or pays,
because none of that happens in `ui/`. `test/content-hash.test.ts` walks the
import graph of `src/` and refuses an entry the moment a `core/` module
reaches it, so the list cannot rot quietly. The list today, ten files:

| excluded | why |
|---|---|
| `abilityOverrides.ts` | tooltip prose; `ui/tooltips.ts` only |
| `bandInfo.ts` | the BAND badge's sentences; `ui/tooltips.ts` only |
| `categoryInfo.ts` | what PHYS, SPEC and STAT mean; `ui/` only |
| `flagWords.ts` | the words a flag is shown as; the truths are read in `core/battle/flags.ts`, which does not import it |
| `moveTargets.ts` | a target keyword as a sentence; `ui/move-explanation.ts` only |
| `statInfo.ts` | the six stat abbreviations explained; `ui/` only |
| `statusInfo.ts` | what each status does, in prose; `ui/tooltips.ts` only |
| `tierInfo.ts` | the three tier sentences; the numbers they restate are in `scaling.ts`, which is hashed |
| `seedCopy.ts` | the paste-time refusal for a foreign seed string; `ui/seed-bar.ts` only |
| `mons.ts` | Stage 0's fixed matchup, pinned by the determinism tests; no run reads it |

Four copy-shaped files are **hashed although they are copy**, because `core/`
reaches them: `archetypes.ts`, `moveCopy.ts` and `data/moveTags.ts` through
`core/battle/view.ts`, and `abilityEffects.ts` through `core/typeMatchup.ts`.
Their values are believed to flow nowhere that decides a roll or a turn, and
"believed" is the failure mode the rule exists to remove. Rewording one moves
the hash and a seed shared across that edit is refused; that is a false
rejection, visible and recoverable, and the safe direction. The hash may refuse
a seed that would have reproduced. It may never accept one that will not.

`tuning.ts` is hashed whole, display fields included. Release C recommended
moving `battleFeedbackMs` and `maxMoveTagsOnFace` into a display-only module;
that is not done here, because moving a field out of `Tuning` changes what the
simulator can sweep and what every report's `tuning` block records, and that is
a decision with its own release rather than a side effect of this one. The cost
is a false rejection when a display number moves. **Open, small.**

The workflow this implies, for the next table: a balance file under
`src/data/` needs nothing; a copy-only file wants an exclusion entry with a
reason, and the test says no if `core/` imports it.

### The versions block

`RunLog` is `{ seed, versions, decisions }`, and `versions` is

```ts
{ runLog: string; contentHash: string; aiVersion: string; randomizerVersion: string }
```

written by `currentVersions()` in `core/run.ts` and read by `versionMismatch`
in the same file, so the stamp and the guard cannot disagree. One guard, the
axes checked in that order, one message format naming the axis and both
values. A log with no block — every log from before this release — is refused
on `runLog` with its old loose `version` quoted. `RUN_LOG_VERSION` moved from
`gymrun-run-12` to `gymrun-run-13`; the decision sequence did not change, the
header that carries it did.

`aiVersion` is recorded from `AI_VERSION` in `core/battle/ai.ts`, which closes
the audit's unguarded-`AI_VERSION` finding and means the AI patch that follows
bumps one constant and the guard picks it up.

**Two deviations from the prompt, recorded here rather than by editing it.**
The prompt's block has `runLog: number` and three axes. `runLog` is a string,
because `RUN_LOG_VERSION` composes the engine version into itself
(`gymrun-run-13/gymrun-0.3.0`) and a number would drop the half that says the
*battle* would replay differently. And the block carries a fourth axis,
`randomizerVersion`, for the reason in the next paragraph.

### `randomizerVersion` is kept, not retired

The prompt allowed retirement if the only readers were the replay guard and
the sim report stamp. They are not: `ui/stamps.ts` renders it in the build
stamp, `scripts/visual/baseline.ts` stamps every baseline record with it, the
sim fixture's header carries it, and the benchmark filename is built from it.
So it stays, and it stays in the log as a guarded axis rather than as a loose
constant, because it names something the hash cannot see: **draw
composition**. A draw added, removed or relocated in `core/` with no table
edited rolls a different run under an identical `contentHash`. `CLAUDE.md`
lists it as its own axis for that reason, and a guard that dropped it would be
a regression.

### Seed strings, and `previewRun`

`GYMRUN-<hash first 6>-<seed>`, rendered by `formatSeedString` in
[`core/seedString.ts`](../src/core/seedString.ts) and rendered nowhere else:
the seed bar, the corner stamp, the summary's copy button, the share text and
the URL all call it. `parseSeedString` reads one back, case-insensitively, as
`bare`, `match` or `foreign`. The seed bar
([`ui/seed-bar.ts`](../src/ui/seed-bar.ts)) refuses a `foreign` string before
a run starts, with the wording in [`data/seedCopy.ts`](../src/data/seedCopy.ts)
naming both hashes, and leaves the bare seed in the box so a second Start is a
fresh run on it. A bare seed is unchanged.

`previewRun` did not exist — the 4.6a refactor never built it — so it exists
now, in [`core/preview.ts`](../src/core/preview.ts): `previewRun(seed,
contentHash)` over `createRun`, which already draws every structural thing up
front, refusing a foreign hash by the same `matchesContentHash` the seed bar
uses and accepting the full hash or its display form.

### The unkeyed sequence is deleted

A named stream is `at(key)`, `keys` and `totalDraws`, and is not drawable
itself. The audit's "one src caller" in `ui/seed.ts` had already been ported
at Release 0.5; the one left was the sim-seed fallback in
`core/battle/driver.ts`, reached by the Stage 0 fixture battles and the
determinism suite and never by a run. It draws through `FIXTURE_BATTLE_KEY`
now, the boundary test's exception list is empty and asserts it stays empty,
and the recorded fixture battle (`docs/visual/baseline/battles/GYMRUN01.json`)
moved once with it. The simulator's scripted bots draw through
`SIM_POLICY_KEY`. Tests that drew off a root now draw off a key; the two
determinism cases that only exercised the root are deleted, held at the key
level by `test/stream-keys.test.ts` groups 2 and 4; and the deletion itself is
asserted at runtime and at the type level, in `test/determinism.test.ts` and
`test/stream-keys.test.ts` group 5.

### What did not move

Seeded run output is byte identical to the branch's Step 0 baseline. The sim
fixture's diff is its two header lines (`version`, and a new `contentHash`);
the visual baseline's run records differ in the `versions` stamp and nothing
else; SMOKE24 plays the same run. The benchmark at RETUNE, 400 seeds,
reproduced the 4.8 row to the digit (mean gyms 4.96, completion 40.25%) before
any code was written, and `contentHash` changes what is recorded, not what is
generated.

### Three things the prompt assumed that the tree did not satisfy

Recorded as deviations because they change what the next reader should expect,
not because anything was built differently.

- **Stage 4.8 is in the tree.** The prompt says it "does not exist in the
  tree"; all eight steps were merged as PR #21 before this branch started, so
  the baseline is `RANDOMIZER_VERSION` 13 and `RUN_LOG_VERSION` 12, not the
  4.7 pair.
- **SMOKE24 has no xfail marker.** The prompt expects one on the 4.7 map
  overflow; 4.8 step 7 closed that miss and deleted the marker helper, so the
  smoke is a plain pass-or-fail.
- **`main` did not typecheck, and one visual test was red.** `ui/screens/summary.ts`
  passed `renderMember` straight to `party.map`, so its third argument was
  the party array where a `Tuning` was declared; fixed as the branch's first
  commit. And `docs/visual/baseline/data-digest.txt` had not been re-recorded
  after 4.7.2's merge touched `src/data/`, so `test/visual-baseline.test.ts`
  and `test/summary.test.ts`'s digest check were red on `main`; re-recorded
  here with the rest of the baseline.

## 9b. Deviation: keyed streams shipped two levels, not one

**Recorded 2026-09-10, Release 0.5. Protocol 4 —
[`spec/README.md`](spec/README.md) — a prompt is not edited to match what was
built, so the deviation is written here instead.**

**What the design said.** `gymrun-seeds-and-mappability.md` specifies a single
flat keyed namespace. Named streams go away entirely and every draw comes off
`rng.at(key)`, keys colon-separated:

```ts
rng.at('locale:segment3:offer')
rng.at('rewards:segment3:node2:offer')
```

**What shipped.** 4.6a kept the five named streams and added keys one level
underneath them, `#` between the stream and the key:

```ts
rng.map.at('seg3/cave/route')          // gymrun:map#seg3/cave/route:<seed>
rng.rewards.at('node/s3-cave-2-0/offer')
```

4.6a was built before the design document was in the repository, from the
prompt's description of it. [`keyed-streams.md`](keyed-streams.md) is the
implementation record and section 1b above describes what exists; neither is
wrong, and this note exists because the *design* the repo treats as canonical
says something else.

**Why it is not a seed break.** The two derivations produce different values,
but no seed predates the keying: 4.6a was itself the one intentional break of
the refactor, and `RANDOMIZER_VERSION` moved to `gymrun-randomizer-7` to
announce it. Nothing in circulation was recorded against the flat form, because
the flat form never ran. Every property the design bought — a new key moves
nothing, a new draw's blast radius is one key, isolation is structural rather
than tested per stage — holds identically in the two-level form, because it is
the same construction applied twice.

**The one consequence, and the reason this note exists.** A Stage 5 shared-seed
scheme built by reading the design document would address sequences the code
does not draw from. `rng.at('rewards:segment3:node2:offer')` is not the sequence
`rng.rewards.at('node/s3-cave-2-0/offer')` returns — different domain string,
different generator, different values, and no error anywhere, because both are
legal keys. Seed sharing, daily seeds and `previewRun` all read off this
derivation. **Build them against `core/streamKeys.ts` and `core/rng.ts`, never
against the key spellings in the design document.**

## 10. Relics, and the shape of a capability gate

Stage 4.6c, 2026-09-10. Section 8 above is the history of how this was decided
and why the two earlier designs were retired; this is what shipped.

### The three bands

An event names exactly one capability and pays at one of three bands.

- **`known`** — the run holds a relic granting it. An encounter: a Pokemon
  offered with no fight in front of it, through the mechanism built for band 3.
- **`latent`** — no relic, but a party member's species carries a satisfying
  type. A real payout.
- **`none`** — neither. A small payout, and never nothing. A player who cannot
  answer the requirement is unrewarded, not punished: an event that cost a run
  something for a routing decision made four segments earlier and now
  un-makeable would be a node the player can only lose at.

**Nothing a Pokemon knows grants a capability.** A party member holding Surf
does not make `surf` read `known`. Surf-the-move and Surf-the-capability are
unrelated systems that share a name, and if that confuses a playtester the fix
is to rename the capabilities rather than to reconnect them — reconnecting them
is exactly the version-2 design that failed.

### All three outcomes are drawn, one is used

Every band's outcome is drawn when the map is built, and the band selects
between them at resolution. This is the rule the feature rests on: **RNG
consumption is identical regardless of which band applies.** If the band were
consulted before drawing, two players on the same seed with different parties
would diverge on a roll neither of them made, and a seed would stop describing
one run.

`test/event-bands.test.ts` asserts it directly rather than arguing it: two runs
on one seed, one holding every relic and one holding none, generate
byte-identical events.

The same rule governs relic *offers*, from the other direction. A relic already
held must never be offered again, but what a run holds is unknown when the map
is built — so a relic card is drawn abstract (a shuffled relic order, plus an
ordinary fallback card from the same pool) and collapsed at resolution by
`concreteReward`. Filtering at draw time would have made a relic taken in
segment 2 silently move every reward roll after it.

### Where relics come from

Elite and gym reward pools, and the later shop shelf. **There is no tier check
anywhere in the code**: relics are elite-and-gym-only because those are the only
tables carrying a `relic` entry, which is how every other tier restriction in
`data/rewardPools.ts` already works. Putting one in the normal pool would
decouple relics from the risk gradient Stage 3 exists to protect.

Taking one is an ordinary card pick and adds no logged decision. That is why
`RUN_LOG_VERSION` did not move for this stage while `RANDOMIZER_VERSION` did:
the questions are unchanged, the answers mean something different.

### The common-type skew, and the lever for it

`latent` is satisfied by type, so capabilities keyed to common types resolve
`latent` more often. Water is common and covers `surf`, `waterfall` and `dive`
between them; Ghost and Dragon are not. Measured over 120 seeds the per-capability
`latent` rate spreads roughly 29% to 50%.

**This is corrected by how many events name each capability, in
`data/events.ts`, and never by narrowing the type sets in
`data/capabilities.ts`.** Narrowing those would make them say something false
about the games in order to fix a different table's problem. The simulator
reports a per-capability band split for exactly this purpose, and the report
says so where it prints it.

Today every capability is named by exactly one event, which is a flat starting
point rather than a tuned one.

### What the screen says about the band, and where that copy lives

**Recorded 2026-09-11, patch 4.8.0.2.** The bands above shipped with no copy
for them. The choice hints in `data/events.ts` were written against the
`latent` table — the one each event was authored for — and were shown at
every band, so at `none` a hint that promised coins paid a berry with no word
about why, and the reveal was one label. `latent` is still `choice.outcomes`,
the v1 table verbatim, and `none` and `known` are still one shared table each:
**this patch changed what the event screen says and not what it pays.**

The copy is `src/data/eventCopy.ts`: a hint per choice at `none` and `known`,
a conclusion per choice at all three bands naming the standing and what it
did, and the capability and band labels the map card and the event screen
both print. It is read by `ui/` only and is on the `contentHash` exclusion
list, so a reworded sentence moves no seed. The authored hint stays the
`latent` hint, because any byte in `data/events.ts` moves the hash.

**Still open, for a patch that moves `RANDOMIZER_VERSION`:** the 4.6c prompt
described `latent` as its own payout table — a larger heal, a held item, a move
a band up, a currency lump — and `known` as a Pokemon holding a good item with
the item granted even when the capture is declined. Neither shipped; `known`
is a bare acquisition and a declined capture at the top band pays nothing.


## 11. Acquisition levelling, and the rule it replaced

Stage 4.7, 2026-09-10.

**Anything entering the party after run start arrives at
`scaling.SEGMENTS[segment].playerLevel`, and every member re-normalizes to the
segment level at each segment boundary.** Only the level moves. Moveset, ability
and held item are the ones the Pokemon was fought with.

The second half of that sentence is not new — `party.levelParty` has re-levelled
the whole party on every gym clear since Stage 2, which is why
`data/partyTuning.ts` says there is no bench experience to model. The first half
is, and it replaces the 4.6a clause "the offer is the node's own lead, exactly as
it was fought: level, moveset, ability, gender and held item". That clause is
deleted from §Pass 5 above rather than annotated, because a rule that has been
superseded and left in place is a rule two readers will disagree about.

### What the deleted clause actually did

It read as generosity and was the opposite. Wild encounter level is
`playerLevel + draw(levelOffset.wild) + TIER_MODIFIERS[tier].level`, and
`levelOffset.wild` runs from `-11..-9` in segment 0 to `-26..-21` in segment 7.
So a capture in segment 3 joined a party of 48s at **level 28 to 32**, and sat
there for the remainder of the segment — including that segment's gym, the one
fight in a segment where a party slot is worth anything. The party-wide re-level
then corrected it at the next gym clear, which is why the tax was invisible to
anyone reading a finished run: by gym 8 every member is at 72 whatever it joined
at.

The tax was unchooseable, unsignposted, and paid at the worst available moment.
That is the same objection 4.6a made to the capture *roll* it removed, and it
survived that stage by accident rather than by argument.

### The hypothesis, and the fact that it was wrong

Stated as a hypothesis because it is a balance claim: that the tax made swapping
worse than it looked, so runs converged on the starter and the party was
decoration.

**The pre-patch numbers do not support it**, and they were checked before the
change rather than after. `docs/balance.md` §10.5 already had `catch-greedy`
(1.68 mean gyms) ahead of `catch-averse` (1.42) at 200 seeds, and the pinned
randomizer-11 benchmark already showed a 33% take rate, 0.76 releases per run,
and 81 distinct species across the 37 parties that reached gym 8. Runs were not
converging on the starter.

So this ships as a **correctness fix** and the swap question is still open. The
likelier cause is in that same §10.5 finding: an always-take policy reaches half
the depth of a selective one, which is a statement about *move quality* rather
than level. A caught Pokemon carries a wild moveset; a starter has been fed
banded reward moves for several segments. `docs/balance.md` §12 has the
post-patch measurement.

### The lever this is not

If captures now arrive at the cap and the report shows the take rate going to
100%, the wild encounter has become strictly better than any move reward. **The
lever for that is the cost of a capture** — the party slot, or the step the
encounter occupies in a segment of four or five — and not the level rule.
Reintroducing the tax would reintroduce all three of the objections above.
`PARTY_TUNING.joinLevelOffset` was deleted rather than set to zero for that
reason: a zero is an invitation.


## 12. The standing rule for decision screens

Stage 4.7, Part 1. Not a generation rule, recorded here because this is the
document a new screen is written against and the rule is one every future screen
inherits.

**Any screen that asks the player for a decision must expose current party state
without leaving the decision.**

Before 4.7 the player picked a locale, a node, a reward, a recipient, a
replacement and a shop purchase, and on none of those screens could they see
what their party currently looked like. Every one of those decisions was being
made from memory. That is not difficulty — the information is not hidden by any
rule, it is merely absent — and a game that makes a player hold six stat blocks
in their head is measuring the wrong thing.

The implementation is **one drawer, not one panel per screen**: a persistent
trigger in the same position on every decision surface, opening an overlay over
the current screen. Three properties are what make it a readout rather than a
mechanic, and all three are asserted per surface in
`test/party-drawer.test.ts`:

- Opening it **never advances run state**.
- Opening it **never submits a decision** — including in battle, where a move
  button is a submission and a drawer trigger must not be one.
- Opening it **consumes no RNG**.

It is read-only in v1. Item reassignment stays on the party management screen,
which is where 4.5.1 put it, so there is exactly one write path for party state.
A drawer that could reassign would need its own carve-out from the first rule
above, and that is a v2 decision with its own playtest.


## 12b. Deviation: the 4.7 phone regression patch stopped at step 2

**Recorded 2026-09-10. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written here
instead.** The prompt is
[`spec/gymrun-patch-4.7-phone-regressions.md`](spec/gymrun-patch-4.7-phone-regressions.md);
the measurements are
[`visual/reports/phone-regressions-4.7.md`](visual/reports/phone-regressions-4.7.md).

**What the prompt asked.** Four steps: close the pre-gym softlock; measure the
fourth move button on three trees; if the measurement confirms 4.7 as the cause,
take three named cuts until the button ends at or above y=740; then flip the
fold assertion in `test/visual-v0.test.ts` from `it.fails` to a real assertion.

**What was built.** Step 1 and step 2. **Steps 3 and 4 did not run, on the
prompt's own stop condition** — "if the pre-PR-#10 number is already above 740,
say so and stop". At 390x844 on `SMOKE24` the fourth move button ends at 840 on
the tree before PR #10, 840 on `main` after PR #10, and 946.5 on `main` now. The
first of those is 100px past the fold line, so the miss predates the stage and
the three cuts, worth about 106.5px together, cannot reach 740 from 206.5px out.

**Two corrections this carries, both about attribution rather than about a
number.** Stage 4.7 did not arrive in PR #10 — PR #10 is the 0.5 verification
release and changed the battle screen by nothing at all; 4.7 arrived in PR #12
and reached `main` through PR #13. And
[`visual/reports/merge-4.7.md`](visual/reports/merge-4.7.md) itemises 4.7's
+106.5 against `0aa2391`, the V4 branch tip, rather than against the pre-4.7
`main`; the rows it names are right and the baseline it compares them to is not
the one that answers "what did the stage cost the fold".

**What is still open.** The 100px that predate 4.7 sit in rows no prompt has
named yet: the battle heading, the two Pokemon panels at 239.25 and 214.25, and
the 2x2 move grid. Reaching 740 is a decision about those, and it belongs to a
prompt that says so rather than to a 4.7 rollback.

## 12c. Deviation: R12 moved `decisionBottom` by one pixel

**Recorded 2026-09-10. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written here
instead.** The prompt is
[`spec/gymrun-patch-r12-band-badge-move-card.md`](spec/gymrun-patch-r12-band-badge-move-card.md);
the measurement is in
[`visual/baseline/README.md`](visual/baseline/README.md) under the R12
correction.

**What the prompt asked.** "Report the height delta per surface from
heights.json; the battle decision point must not move." And, as its own stop
condition: the badge fits on the move button's face without changing the 44px
minimum touch target or the 2x2 grid, and if it does not fit at 390 wide, report
the measurement and stop rather than shrinking the target.

**What was built, and the one number that moved.** The badge fits. At 390x844
on `SMOKE24` a move button is 176 wide with 150 of usable face; the band chip is
45.9 wide and joins the second line of a `.move__meta` row that was already
wrapping before this stage, so it costs 0.5px per grid row rather than a third
line's 24. `battle.decisionTop` is **unmoved at 681.5** and `decisionCount` is
still 4, but `battle.decisionBottom` is **946.5 → 947.5**, and `screenHeight`
and `scrollHeight` each move 1 with it. The 44px target reads 130 and the grid
still fills the width in two 176-wide columns; neither was touched, because R12
added no CSS at all.

**Why this was read as satisfying the rule rather than tripping the stop
condition.** "The decision point" is taken to be `decisionTop` — where the
decision begins, and the number V5's fold budget is keyed off. Release C's own
note in `visual/baseline/README.md` uses the phrase the same way. The stop
condition is about *fit*: it is triggered by a badge that does not fit on the
face, and the failure it exists to prevent is somebody shrinking the touch
target or the chip to make room. Nothing was shrunk, and one pixel of chip
height is not a fit failure. **It is recorded here rather than absorbed**
because a reader who takes "the decision point" to mean both edges of the block
would call this a miss, and that reading deserves the number in front of it
instead of having to re-measure to find it.

**What this changes for V5.** Nothing structural, and it is worth saying so
explicitly because V5's budget arithmetic is already being re-done: the R12
amendment to the V5 prompt says to re-measure at V5 step 1 rather than reuse the
audit's figure, and the starting height that re-measurement will find is 1327.5
rather than the 1326.5 the amendment names — Release C's 36 plus R12's 1.

## 12d. Deviation: V5 met the budget's total and not its rows

**Recorded 2026-09-10. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written here
instead.** The prompts are the V5 section of
[`spec/gymrun-visual-identity-plan.md`](spec/gymrun-visual-identity-plan.md) and
[`spec/gymrun-stage-v5-preflight-reconcile-execute.md`](spec/gymrun-stage-v5-preflight-reconcile-execute.md),
whose section 2 carries the seven amendments. The measurements are in
[`visual/reports/v5-battle-stage.md`](visual/reports/v5-battle-stage.md).

**What the prompt asked.** A pixel budget of six rows summing to 584: opponent
panel 56, scene with both sprites 260, player panel 64, event strip 36, move
grid 128, margins and safe area 40. Two assertions on top of it — layout height
at or under 600 with a full status and stage chip row on both sides, and four
move buttons plus the strip above the fold.

**What was built. Both assertions hold; three of the six rows do not.**

| row | budget | shipped | note |
|---|---|---|---|
| opponent panel | 56 | 121 | overlaid on the band, so it reaches no total |
| scene with both sprites | 260 | **260** | as written |
| player panel | 64 | 121 | overlaid, as above |
| event strip | 36 | **24 + 8 gap = 32** | Release C's strip, already spent |
| move grid, 2x2 | 128 | **228** | below |
| margins and safe area | 40 | 63 | `.battle__header` 47 plus two 8px gaps |
| **total** | **584** | **587** | `battle.screenHeight`, SMOKE24 |
| | | **594** | the same figure on a loaded board |

**The panels are overlaid rather than stacked, and that is a reading of the
plan rather than a departure from it.** Its own sentence is *"stat panels float
over the scene with no chrome"*, Reference B, text on a scrim. Read as three
stacked bands the budget does not close and fails on the gate that matters: 47 +
12 + 260 + 12 + 56 + 64 + 36 + 128 puts the move grid at 632..760, past the 740
line the same table claims 156px of headroom against. Overlaid, the two panels
stop reaching the total at all, both gates collapse onto the move grid, and the
arithmetic works. The report's V5.1 section carries the calculation, and it was
written **before** any code moved, which is what makes it a reading rather than
a rationalisation.

**The move grid is 228 and not 128, and this is the real miss.** 128 is two rows
of 61 plus a gap. A move button's face carries a name (21) and a two-line
`.move__meta` (42) before any padding at all, so 63 of content will not fit in
61 — the plan's number is unreachable without dropping content from the face or
shrinking the 44px touch target, and amendment A6 forbids the second explicitly:
*"Tighten by margin and gap, not by shrinking the 44px target or the two-line
meta."* Both instructions cannot be satisfied, so A6 won, on the argument that
it is the later and more specific of the two and that it names the failure
(R12's band badge overhangs first) rather than a target. The grid tightened by
20px a button out of padding and gaps and stopped there.

**The margins row is 63 and not 40** for the same kind of reason: 40 does not
cover `.battle__header` at 47, and V5 was not asked to remove the battle
heading. Two of its three gaps came down from 12 to 8 at V5.6 when the loaded
board measured 602.

**Why this was read as satisfying the stage rather than missing it.** The
budget table is a means and the two assertions are the end, and the prompt
states the end twice — in the tests and again in the definition of done, which
says what the player can do rather than what anything measures. Both hold, on
the played board and on a deliberately loaded one:

- layout height **587** played, **594** loaded, against 600;
- the fourth move button ends at **700** and the strip at **732**, against the
  740 usable line and the 844 fold, on a document whose `scrollHeight` is 844.

**One thing V5 removed that the budget's notes column implies and its prose
does not.** The six-row stat block is gone from both battle panels; stat stages
render as V2 chips instead, and only when non-zero. 89.75px of rows cannot sit
inside a 56px row, so the budget requires it. **The opponent's exact stats
therefore leave the battle screen** — the player's are a tap away in the party
drawer, the opponent's are now the archetype label alone. It is recorded here
rather than only in the report because it is the one piece of information the
stage takes away, and because giving it back costs the budget nothing: the
panels are overlaid, so a collapsed one-row readout adds about 19px inside a
260px band that has room and changes neither gate. That is the shape step 3 of
the restore-the-fold patch prompt describes — a document that is **not in this
tree**: it sits unbuilt on the unmerged `claude/strict-trim-startup-fix-46g74x`
branch, archived there at `305e5b5`, and its step 3 says of itself "this is the
V5 budget brought forward; note it in the report so V5 does not redo it". It is
the obvious answer if a playtest misses the numbers.

## 12e. Deviation: 4.7.2's font swap shortened the map by 29.69px

**Recorded 2026-09-10. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written here
instead.** The prompt is
[`spec/gymrun-patch-4.7.2-font-stats-verbosity.md`](spec/gymrun-patch-4.7.2-font-stats-verbosity.md),
step 1; the measurement is
[`visual/reports/patch-4.7.2.md`](visual/reports/patch-4.7.2.md) section 1.

**What the rule says.** The visual stages' standing gate, in
`scripts/visual/measure.mjs`: "every visual stage must leave their layout height
unchanged to the pixel." `test/visual-v0.test.ts` asserts both guarded screens
against `visual/baseline/heights.json` as whole objects, so any field moving is
a fail. The patch's own stop condition, from ruling 5, is narrower: report
`decisionTop` and `decisionBottom` before and after, and **stop rather than ship
if the decision point drops below the fold on 390x844.**

**What moved.** `--font-body` went from the system monospace stack to Pixelify
Sans, which is the narrower and shorter face, so text-driven boxes shrank. At
390x844 on `SMOKE24`:

| | before | after | delta |
|---|---|---|---|
| `map.screenHeight` | 976.69 | 947 | **−29.69** |
| `map.scrollHeight` | 1170 | 1140 | **−30** |
| `map.decisionTop` | 614.5 | 614.5 | 0 |
| `map.decisionBottom` | 728.22 | 698.53 | **−29.69** |
| `battle.*` | — | — | **0 on every field** |

`decisionCount` is unchanged at 2 and 4.

**Why this ships rather than tripping the stop condition.** Every number moved
*up*. The stop condition is a floor, not an equality: it fires when a decision
point drops below the fold, and the fold is the 740 usable line that
`test/visual-v0.test.ts` asserts. The map's last offered card moved from 728.22
to 698.53, which is 41.47px of new clearance under a line it already cleared by
11.78, and the battle screen did not move at all — the move grid is a fixed 2x2
of 44px-minimum buttons, so a narrower face changes nothing about it.
`decisionTop`, the number V5's budget arithmetic is keyed off and the one both
R12's note and Release C's take "the decision point" to mean, is **unmoved on
both screens.**

**The baseline was re-recorded, and that is the deviation.** The equality gate
cannot pass otherwise, and re-recording is what ruling 5's "accept the baseline
churn" authorises. It is recorded here rather than absorbed because a reader
comparing `visual/baseline/heights.json` against `docs/visual/reports/v5-battle-stage.md` will
find the map's two numbers disagree with V5's report, and the answer is this
patch and not a regression in V5. **V5's battle figures are untouched and stay
quotable.**

**What this does not buy.** The 29.69px is a *consequence* of a typography
decision, not a budget win to spend: it arrived because the face is narrower,
and it would go back the moment `--font-body` returns to the mono stack — which
is one line, by design. Nothing should be laid out on the assumption that the
map now has thirty spare pixels.

## 12f. Deviation: 4.7.2's chip floor moved the battle decision point by 12px

**Recorded 2026-09-10. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written here
instead.** The prompt is
[`spec/gymrun-patch-4.7.2-font-stats-verbosity.md`](spec/gymrun-patch-4.7.2-font-stats-verbosity.md),
step 2 and ruling 5; the measurement is
[`visual/reports/patch-4.7.2.md`](visual/reports/patch-4.7.2.md) section 2.

**What was asked.** A legibility floor for chips — a minimum font size with a
floor of 11px and a minimum contrast ratio — as numbers in `data/tuning.ts`,
applied to every chip surface. Ruling 5 accepted the baseline churn in advance,
required `decisionTop` and `decisionBottom` before and after, and set one stop
condition: **stop rather than ship if the decision point drops below the fold on
390x844.**

**What moved.** Five chip rules were under the floor and are now at it: `.type`,
`.band`, `.badge--category` and `.badge--tag` at `--fs-xs` (10px), and `.tier` at
`--fs-2xs` (9px). A move button carries three of those, so the button grew.

| | main | after 12e | after this | vs 12e | vs main |
|---|---|---|---|---|---|
| `battle.decisionTop` | 472 | 472 | **472** | 0 | **0** |
| `battle.decisionBottom` | 700 | 700 | **712** | **+12** | **+12** |
| `battle.screenHeight` | 587 | 587 | 599 | +12 | +12 |
| `map.decisionTop` | 614.5 | 614.5 | 616.5 | +2 | +2 |
| `map.decisionBottom` | 728.22 | 698.53 | 701.53 | +3 | **−26.69** |

`decisionCount` unchanged at 4 and 2; `battle.scrollHeight` unchanged at 844.

**Why this ships.** The stop condition is the fold, and the fold is the 740
usable line `test/visual-v0.test.ts` asserts. The fourth move button ends at
**712**, clearing it by 28px; the map's last offered card ends at 701.53,
clearing it by 38px. **`decisionTop` is unmoved on the battle screen** — the
number V5's budget arithmetic is keyed off, and what both R12's note and
Release C take "the decision point" to mean. Against `main` the map is 26.69px
better off and the battle screen 12px worse, and the pair still clears.

**The 12px is bought, not lost.** It is three chip rows on a move button going
from 10px to 11px, which is the thing the patch exists to do. Reading it back as
a regression to reclaim would mean reclaiming it from the floor.

**Also deleted here: the `@media (max-width: 420px)` rule that dropped
`.badge--tag` to 9px.** Per ruling 5, and worth its own sentence: it made text
*smaller* on the device every visual stage is measured at. A chip that does not
fit is a chip to drop or a row to wrap, not a chip to shrink under the floor.

**`--chip-text` moved 70% to 60%, once and globally.** At 70% five of nineteen
hues put their label under 4.5:1 against their own fill. Per hue would have been
five values to re-derive the first time a chip, a surface or a base colour
moved. It desaturates the **label** only — `--chip-fill` is untouched — so a
Dragon chip still reads as Dragon.

**`data-digest.txt` moved and nothing else did.** The two floors are `Tuning`
fields, so they are under `src/data/` and the digest is a glob over it. This is
the third instance of the case §9 calls "the awkward case", after `flagWords.ts`
and `battleFeedbackMs`, and it behaved the same way: of the eight files in
`visual/baseline/`, only the digest changed. Every recorded run, every casualty
list and the recorded battle protocol are byte identical, so two players on one
seed holding different copies of `tuning.ts` still play the identical run. **The
per-field split of that file is still the `contentHash` release's decision and
is deliberately not pre-empted here.**
## 12g. The summary's move cards, and the gap that let them go empty

**2026-09-11.** The fix is not recorded here. It is PR #24's, and
[`visual/reports/patch-4.7.2.md`](visual/reports/patch-4.7.2.md) §7.1 is
where the merge that caused it is written up. This section records the **test**,
because the fix shipped without one and the reason it was needed is not obvious
from the diff.

**The attribution matters and my first draft of this section got it wrong.**
4.7.2 did not leave the call site short of an argument. Its own tip carries
`state.party.map((member, index) => renderMember(member, index, state.tuning))`
at `f52a057` and still at `1539841`. The merge commit `afa2b1f`, resolving 4.7.2
against 4.8's rewritten block, is what reduced it to `map(renderMember)` — and
`Array.prototype.map` passes the array as its callback's third argument, so
`tuning` became `state.party`. A merge resolution dropped it, which is why
§7.1's table can describe the resolution as keeping the tuning and the committed
tree not have it.

**The interesting part is that the surface was under test and the test passed.**
`tagsForFace` computes `slice(0, Math.max(0, tuning.maxMoveTagsOnFace))`; the
field is absent on an array, `Math.max(0, undefined)` is `NaN`, and
`slice(0, NaN)` is empty. So the summary drew **zero** face tags where the other
five surfaces draw up to three — no crash, no blank region, just a missing row.

4.7.2 step 5's claim is that the shared filler reaches six card surfaces, and
`test/visual-move-cards.test.ts` does walk all six. What it asserts on each is
that an expander is present, and an expander comes off `explanation` rather than
off the tags, so it stayed green on a surface whose tag row had gone. The smoke
run's `no move face carries more than 3 tags` is a ceiling, which zero also
satisfies, and it only covers the battle screen. **Between them the two checks
proved the insertion point was reached and not that real data came through it.**

So the gap was 4.7.2's to close rather than 4.8's, and closing it is what these
tests do:

- `test/summary.test.ts` compares the face tags the screen draws against what
  `moveCardData` returns for the same party under the run's tuning. Not "more
  than zero": a cap of three read as zero and a cap of three read as three are
  both non-crashing, and only the comparison separates them. It also asserts the
  expected total is itself above zero, so it cannot pass at `0 === 0` on a party
  whose moves carry no tags — the shape of the bug it exists for. Verified red
  against the pre-#24 call site.
- `test/visual-move-cards.test.ts` gains a tag count per surface beside the
  expander count it already takes, so the next surface to lose its tuning fails
  on the surface that lost it rather than on a screen two steps later.

`state.tuning` and not `DEFAULT_TUNING`, on the rule `ui/app.ts` already states
for the opponent reveal policy: a run started with a swept tuning has to show
what that run was.

## 12h. Deviations: the tutorial (overnight Branch 3)

**Recorded 2026-09-11. Protocol 4 — the prompt is not edited; the five
places the built tutorial differs from
[`spec/gymrun-overnight-contenthash-ai-tutorial.md`](spec/gymrun-overnight-contenthash-ai-tutorial.md)
Branch 3 are written here.**

1. **The move-category sentence lives on the battle screen, not the starter
   card.** The prompt puts "a move is Physical, Special or Status and which
   stat that uses" under starter and party cards; the starter card shows a
   move's type, base power and PP and carries no category chip, so there is
   nothing to point at. The battle's move button carries the chip, and the
   `move` mark there says it. The starter's `moves` mark says what a move
   has and what Status means.
2. **The drawer is read only, and its marks say so.** The prompt's drawer
   section says items are reassigned there; since 4.7 the drawer is a view
   and the party screen is where assignment happens (`ui/drawer.ts` says the
   same in its note). The `items` and `backpack` marks are on the party
   screen; the drawer's `party` mark states that items are assigned on the
   party screen and locked in battle.
3. **The seed mark has two anchors.** On a phone the seed bar is hidden once
   a run starts (`.shell[data-phase='running'] .seedbar`), so the corner seed
   stamp carries the same `data-tutorial="seed"` and the layer takes the first
   painted anchor. One mark, one sentence, two places it can point.
4. **The visual baseline's data digest is `contentHash` now.** It was a plain
   sha256 over every file under `src/data/`, so `data/tutorial.ts` — copy, on
   the exclusion list, read by `ui/` only — moved it without moving anything a
   seed reads. `scripts/visual/baseline.ts` reads the axis instead; the
   recorded digest is `b022fc4e…`, unchanged since Branch 1, and it moves
   exactly when the axis does.
5. **The forbidden list carries twelve words, not ten.** `recommended` and
   `usually` are the prompt's own examples of advice spelled differently from
   the ten it listed, so they are in the data.

One known gap, from the prompt's own default: the copy is written against
Detailed mode. If Pocket mode is built, its marks point at the same anchors
and may name things that mode hides.

## 12i. Deviation: 4.8.0.1 de-prioritised nicknames past what its prompt asked

**Recorded 2026-09-11. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written here
instead.** The prompt is
[`spec/gymrun-patch-4.8.0.1-species-stays-the-label.md`](spec/gymrun-patch-4.8.0.1-species-stays-the-label.md).

**What was asked.** Species primary on every surface where the player is
evaluating a Pokemon, the nickname secondary and subordinate; opponents species
only; the graveyard and share text the one exception, nickname first with the
species after it on the same line; a report before any code.

**What the report found, and the ruling on it.** Case 1 of the prompt's two:
`PokemonSpec` carries `species` and `nickname` as separate fields, every
projection (`ActiveView`, `SwitchView`, `SpecCard`, `DeathRecord`) carries both,
and the only place a nickname replaces a species is the sim's battle name at
`toPokemonSet`, which is the protocol's identifier and is correct. The ruling on
the report went past the prompt: **nicknames are de-prioritised everywhere,
including the graveyard and share text. Every label is the species. The option is
kept, not removed** — the draw, the key, the field on the spec and the sim's
battle name are all untouched, and the name is state the screens do not show.
No `core/` state change, no version axis moved, no new draw. Recorded runs, the
recorded battle protocol and every casualty list are byte identical to the
baseline by `test/visual-baseline.test.ts`.

**The surfaces, as edited.** Both battle panels and the bench (`ui/scene.ts`);
the member card and through it the drawer, party management and the pre-gym
members list (`ui/member-card.ts`); the party and result slot strips, the
release confirm and the give buttons (`ui/screens/party.ts`, `ui/screens/result.ts`);
the map cards (`ui/screens/run-map.ts`); the pre-gym send-in control
(`ui/screens/pre-gym.ts`); the recipient and replacement screens
(`ui/screens/item-target.ts`, `ui/screens/move-replace.ts`); the final party, the
graveyard rows and the closing sentence (`ui/screens/summary.ts`); the share text
(`ui/copy/share.ts`, whose `ShareView.party` no longer carries a name). The
capture card and starter select already rendered the species and were left as
they were.

**The battle text.** The event strip, the history sheet and the flag chips'
subjects print what the protocol says, and the protocol says the battle name.
`ui/species-index.ts` learns name → species off each `|switch|` line and
`ui/screens/battle.ts` relabels the identifiers once per batch, before the turn
reader, the log and the strip see them, so the three agree by construction.
The session's own protocol is never rewritten. The one consequence is recorded
in the file's header: the log's HP tracker keys two same-species members on one
string again, which is how it keyed them before 4.8 named anything.

**Heights.** `battle.decisionTop` **472, unchanged**; `decisionBottom` 712,
`screenHeight` 599, `scrollHeight` 844, all unchanged. A species is one word
where a nickname was one word, and no nameplate gained a line. The map did not
move either — but see the next paragraph, because the pinned map numbers were
not the merged tree's.

**What the gates found on `main`, and what PR #24 did about it first.** This
branch was cut from `0712032`, the merge of 4.7.2 into 4.8. Its typecheck gate
found `tsc` red there — the merge kept 4.8's `state.party.map(renderMember)`
against 4.7.2's three-argument signature — and its height gate found the map's
pinned numbers and `data-digest.txt` were 4.8's, recorded on a tree without
4.7.2's font swap (12e) and chip floor (12f). Both were fixed on this branch,
and while it was open PR #24 (`c28d050`) fixed both on `main` independently:
the same one-line restoration of 4.7.2's call, the same re-record. The merge
takes `main`'s versions; 12g above and
[`visual/reports/patch-4.7.2.md`](visual/reports/patch-4.7.2.md) §7 are the
record. What this branch adds is the independent confirmation, measured on
`main` at `0712032` from a `vite build` that bypassed the red `tsc`, and on the
branch, agreeing to the hundredth:

   | | pinned by 4.8 | `main` at `0712032` | this branch | PR #24 |
   |---|---|---|---|---|
   | `map.screenHeight` | 836.41 | 810.72 | 810.72 | **810.72** |
   | `map.scrollHeight` | 1029 | 1004 | 1004 | **1004** |
   | `map.decisionTop` | 556 | 558 | 558 | **558** |
   | `map.decisionBottom` | 669.72 | 643.03 | 643.03 | **643.03** |
   | `battle.decisionTop` | 472 | 472 | 472 | **472** |
   | `battle.decisionBottom` | 712 | 712 | 712 | **712** |

**Four suite failures this branch inherited, diagnosed wrong here and right in
PR #24.** `visual-v1` "data-locale is absent on the summary", `visual-v3` "the
world mounts once" and "is absent on the summary", and `visual-verbosity`
"changes the threat readout" failed on `main` at `0712032` and on this branch
identically. This branch's report blamed the visual bot clicking a chip at each
move button's centre. That was wrong: the panel was opened by the tooltip
layer's **hover** enhancement, with Playwright's mouse parked wherever the last
click left it, on an ability chip 4.7.2's shorter map had moved under it — a
state no phone can reach. PR #24 parks the pointer after every step
(`scripts/visual/browser.mjs`) and re-aims the verbosity test at the party
screen, where the readout has lived since 4.8. `visual/reports/patch-4.7.2.md`
§7.4 has the trace. Recorded rather than deleted because a wrong diagnosis on
the record is how the next reader avoids repeating it.

**Two `core/` follow-ups this patch leaves, both older than it:**

- `CauseOfDeath.species` (`core/run.ts`) is filled from the `|faint|` line, so it
  is the battle name, not the species. Harmless while no spec had a name; wrong
  since 4.8. The summary's closing sentence resolves it through the final party
  display-side. The field wants renaming or filling from the member.
- `deathsFrom` (`core/graveyard.ts`) falls back to `species: casualty.name` when a
  casualty matches no current member. A member released after fainting would get
  a tombstone naming its nickname as its species. `3ed2f66` on `main` captured
  the casualty's *level* at faint time for exactly this case; the species still
  comes from the party match, so recovering it is the same shape of `core/`
  change, one field over.

**Docs corrected on the way.** `docs/README.md` section 4 said 4.8 was in flight
and not merged a day after it and 4.7.2 both landed; the register rows for both
said the same. Both now say `merged` with their commits.

## 12j. Deviation: 4.8.0.2 took the pixel face off, and the map grew back by 29.69px

**Recorded 2026-09-11. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written here
instead.** The prompt is
[`spec/gymrun-patch-4.8.0.2-readability.md`](spec/gymrun-patch-4.8.0.2-readability.md);
the measurement is
[`visual/reports/patch-4.8.0.2.md`](visual/reports/patch-4.8.0.2.md) sections
1 and 2.

**What the prompt asked.** "Choose a different px size or abandon pixel
fonts." The plan's rule was to measure the face's pixel module first and keep
the face only at sizes that land on it; if no uniform module exists, abandon
it.

**What was found.** There is no module. Pixelify Sans draws each "pixel" as a
rounded outline square of about 90 units on a 1000-unit em with a 10-unit gap
to the next (39 in Bold), and its rows vary between 80 and 91 units. No CSS
size at any device pixel ratio puts both the square and the gap on whole
device pixels; Chromium's antialiased share of the ink at 12px on a 3x phone
is 43%, and under 44px it is never below 20%. So the second half of the
instruction applied, and all three face tokens now point at the monospace
stack. The `@font-face` blocks and the woff2 files are deleted rather than
left unreferenced.

**What moved.** Section 12e recorded the swap *onto* the face as −29.69px on
the map and said it "would go back the moment `--font-body` returns to the
mono stack." It did, to the hundredth:

| | before | after | delta |
|---|---|---|---|
| `map.screenHeight` | 810.72 | 840.41 | **+29.69** |
| `map.scrollHeight` | 1004 | 1033 | +29 |
| `map.decisionTop` | 558 | 558 | 0 |
| `map.decisionBottom` | 643.03 | 672.72 | **+29.69** |
| `battle.*` | — | — | **0 on every field** |

The map's last offered card clears the 740 line by 67px and the battle's
fourth button by 28px, unmoved. `heights.json` is re-recorded in the commit
that moved it, and that re-recording is the deviation: the equality gate
cannot pass otherwise. Runs, the battle protocol and `data-digest.txt` are
byte identical.

**One line the guarded heights did not see.** V5's loaded board (a status and
a stage chip on both sides) went from 591.5 to 604.5 against its 600 ceiling,
all of it a status move's one-line readout — `Raises Attack by 2 stages` —
taking a third line, because the monospace face sets 25 characters at 150.5px
where the pixel face set them at 129 and the button face is 150. The readout
line alone now runs one spacing step into the button's side padding on each
side, 166px, which is the character count the old face fitted; nothing else
on the button moves, and the loaded board is 591.5 again, identical to the
base. `visual/reports/patch-4.8.0.2.md` section 2.1.

**Two rulings from 4.7.2 that this patch reverses, named so nobody
rediscovers them.** Ruling 3 (Detailed shows the bar and the number together)
is reversed: Detailed shows the number alone and Simple the bar alone, the
Stage 4.5.1 Part 5 definition, because a bar beside every number read as
"stats are bars now" on the phone. Ruling 7 (`--font-numeral` as a separate
token pointing at the same face) is kept as a token and used as intended: it
was the first thing to go back. Everything else 4.7.2 built stands — the
painted fill, the attribute-driven mode, the chip floor, the move
explanations.

**Copy for the capability events lives outside the hash.** Section 10 has the
dated note. `src/data/eventCopy.ts` joins the exclusion list on the same rule
as `data/tierInfo.ts` and `data/tutorial.ts`: nothing under `core/` imports it, so a
reworded sentence moves nothing.

## 12k. Superseded: 4.5.2's phone rule hid the seed bar for the whole run

**2026-09-11, the mobile seed bar patch**
([`spec/gymrun-patch-mobile-seed-bar.md`](spec/gymrun-patch-mobile-seed-bar.md)).

4.5.2 checkpoint 6 (`8a7897d`, item F of the playtest round 2 patch) measured
that the header and the seed bar cost a phone about 350px above every screen,
and reclaimed it with `.shell[data-phase='running'] .seedbar { display: none; }`
under the 760px media query. Its note said the bar "stays reachable — the
summary screen restores the setup phase".

**What that missed.** `app.ts` starts a run at page load, so the phase is
`running` before the player has seen the starter screen, and the only return to
`setup` is the summary. On a phone, Start run, Copy seed, New seed and Resume
saved run were therefore unreachable from the first screen to the last. The
player's own screenshot (Safari, iPhone 14 Pro Max, the starter screen, no bar)
is in the prompt file. The summary screen's action row was never affected.

**The rule now.** The bar collapses rather than vanishing. `ui/seed-bar.ts`
carries `data-collapsed` on its root and a `toggle` button that the shell mounts
on the header's Detail row (`app.ts`, `createVerbosityToggle`). The stylesheet
reads both only under the same media query and phase as before:

```css
.shell[data-phase='running'] .seedbar[data-collapsed='true'] { display: none; }
.shell[data-phase='running'] .seedbar__toggle { display: inline-block; margin-left: auto; }
```

so a desktop and the setup phase see exactly what they saw. `start()` collapses
the bar at every run start, so each run begins with the space reclaimed. The
copy for the toggle lives in `data/seedCopy.ts`, which is on the `contentHash`
exclusion list: no axis moved.

**Why the header row and not a row of its own.** The header's height is the
map's and the battle's vertical budget (12c, 12e, 12f). A toggle row under the
header would have moved `decisionTop` on both guarded screens and forced a
re-record of `docs/visual/baseline/heights.json`. On the Detail row it costs
nothing: `test/visual-v2.test.ts` reads the baseline unchanged to the pixel, and
`test/visual-phone-seed-bar.test.ts` asserts the toggle shares the Detail
toggle's `y`.

**The tutorial's seed mark is unchanged.** 12h point 3 gave the mark a second
anchor on the corner stamp because the bar was hidden during a run. The bar is
still hidden while collapsed, so the layer still takes the stamp; when expanded
it takes the bar. Both carry `data-tutorial="seed"` as before.

Superseded rule deleted, not flagged, per `CLAUDE.md`. The 4.5.2 prompt is not
edited. Report and screenshots:
[`visual/reports/patch-mobile-seed-bar.md`](visual/reports/patch-mobile-seed-bar.md).


## 12l. Deviation: the density modes prompt describes a battle screen V5 had already fixed

**2026-09-11, the density modes patch**
([`spec/gymrun-patch-density-modes.md`](spec/gymrun-patch-density-modes.md)).

The prompt's Part 3 says "Battle at 1376 is the hard case. It is roughly 530px
over", and its closing sequencing note argues for landing Pocket before V5.
Both were true when the prompt was drafted and neither was true when it was
committed: V5 had merged to `main` (`docs/visual/state/V5.done`:
`battle.scrollHeight 1376 → 844, -532`), so on the tree this patch started
from the Detailed battle screen already fits a 390x844 phone with zero
scroll, and `heights.json` matched to the pixel. The prompt is not edited,
per protocol rule 4; the ruling on the report asked for the correction to be
recorded, and this is it.

**The real hard cases**, measured on SMOKE24 at the first moment the run
reached each screen (samples of one run state, not worst cases):

| screen | scrollHeight | over 844 by |
|---|---|---|
| pre-gym | 2608 | 1764 |
| summary | 3741 | 2897 |
| party (via Manage) | 1638 | 794 |
| starter | 1083 | 239 |
| map | 1033 | 189 |
| result | 997 | 153 |

**Six rulings on the report**, recorded here because three correct the
prompt's own lists. The rulings are appended verbatim to the prompt file.

1. The prompt file carries the rulings as an appendix rather than an edit.
2. The coverage gate compares rendered output in a browser, because the mode
   is a root attribute read only by the stylesheet (4.7.2 ruling 4) and the
   DOM is identical across modes by design.
3. Fixtures are worst case per screen: six members on party, pre-gym and the
   drawer; six held items and the maximum relic count on the drawer; a full
   backpack on the party screen; eight gyms cleared with a full graveyard on
   the summary.
4. **The Pocket gate is split.** Decision surfaces — starter, locale, map,
   battle, result, target, replace, party, pre-gym, shop, event, and the
   drawer gated on its sheet's own scroll extent — are zero scroll at
   390x844, a hard gate with no exemptions. Archive surfaces — summary and
   the log sheet — must hold the complete outcome in the first screenful (the
   outcome block's bottom edge at or above 844) and may scroll below it. The
   prompt's list named "reward", which is not a screen, omitted "replace",
   and named "graveyard", which is a section of the summary.
5. Two of the fourteen surfaces stay two-valued, with the measured reason in
   the report: the log sheet (protocol lines, no labels, no descriptions, no
   stat block) and the target screen (member buttons with no stat block and
   one question). The coverage test asserts the exemption rather than
   skipping it: Detailed differs from both, Simple equals Pocket.
6. The tutorial guard is per screen: Detailed is forced only while a screen
   still has unseen marks, applied before anchors resolve, and released when
   that screen's marks finish or Skip fires. A browser assertion holds that
   on the worst-case fixture no mark is ever silently dropped.

## 12m. Deviations: what the density modes patch built against what it asked

**2026-09-11, the density modes patch, step 4**
([`spec/gymrun-patch-density-modes.md`](spec/gymrun-patch-density-modes.md)).
Each is a place the built work departs from the prompt's words. The prompt is
not edited; the argument for each is in
[`visual/reports/patch-density-modes.md`](visual/reports/patch-density-modes.md).

1. **The numbers live in `src/data/densityTuning.ts`, not `data/tuning.ts`.**
   The prompt puts every number the patch introduces in `tuning.ts`. That
   file is inside `contentHash` (it is imported under `core/`), so a padding
   scale in it would move every seed on a tuning pass, which the prompt also
   forbids. The scales sit in their own `data/` table, excluded from the hash
   with a reason in `build-config/content-hash.ts`, and `test/density.test.ts`
   holds that nothing under `core/` reaches it. A density pass is still a
   table edit.
2. **Fixtures are constructed, not walked.** Ruling 3 asks for the worst case
   per screen; SMOKE24 reaches none of them. `ui/gallery-fixtures.ts` builds
   each worst case from the seed's own draws (a six-member party with six
   held items, a full backpack, every relic, eight gyms cleared with a full
   graveyard, a 24-turn battle) and the gallery renders it through the app's
   own screens. The seeded run is untouched: `test/density.test.ts` replays
   SMOKE24 in all three modes and compares the run log byte for byte.
3. **The stat line on a pick card keeps abbreviations in Detailed.** The
   definition gives Detailed full labels. On the starter and capture cards the
   six stats are one row at 390 wide, and six full names do not fit a row;
   the six-row block on a member card has the full names. Recorded rather
   than fixed, because a wrapped stat row is a worse readout than an
   abbreviated one.
4. **The member card's HP line is the bar in Pocket.** The prompt names stat
   blocks and move cards as what folds. Measured on the worst case, a card's
   HP line ("116 / 116 HP (100%) · PP 112/112") wrapped to two lines at half
   a phone's width and put 33px under every card; six cards two-up did not
   fit with it. In Pocket the bar is the readout and the number is the bar's
   tap (`member-card.ts`, `hpTip`), the stat block's own rule applied to a
   seventh number. A fainted member keeps its word on screen. The battle
   scene's HP text and the target screen's buttons are not under this rule:
   the scene is the live board, and a tip inside a button is a second tap
   target inside a first.
5. **Controls fold with the body.** The archetype chip, the ability, the
   held item's "to bag" control, the lead and release controls, all sit in
   the card's fold in Pocket, and every card on a surface folds together.
6. **The relics list folds in Pocket** behind a title that carries the
   count. Measured, every relic as a name chip ran 151px on a screen whose
   decisions are the lead, the items and a release.
7. **The result screen's slot row is off screen in Pocket while the capture
   block is up.** The block's comparison list is the same six members; to
   make it the row's equal the cards gained the slot number, the status chip
   and PP on the bar's tap, in every mode. The held item's "(returns to your
   bag)" became a chip and a two-form note, and the release control's label
   is "Release" alone in Pocket, the species being the line above.
8. **The battle button carries a `?` chip** on its PP line, so a Pocket
   player reaches the base power, the category and the effect line in one
   tap on the button that decides the turn. Open item 9 of 4.7.2 closed by it.
9. **The two-valued exemption is empty.** Ruling 5 exempted the log sheet and
   the target screen. Measured against pixels, both differ in all three modes
   through the chrome scale, so `TWO_VALUED_SURFACES` is an empty list with
   the assertion kept behind it.
10. **The picker's lines are one line each**, not the fuller descriptions
    first written: the drawer is under the Pocket gate and three wrapped
    lines put its sheet over by 25px. The prompt's own example line is the
    Pocket one.
11. **The tutorial guard found nothing to guard on this tree.** Measured
    without it on the worst-case fixtures, Pocket leaves all 29 anchors
    painted. It is kept, as the prompt said it would be, because the copy
    was written against Detailed, and its assertion
    (`test/visual-tutorial-guard.test.ts`) is what makes a future fold that
    hides an anchor fail loudly.
12. **The existing two-valued suites were rewritten, not deleted**, each with
    a comment naming this patch: `test/density.test.ts` (renamed from
    4.7.2's verbosity suite), `test/visual-density.test.ts`,
    `test/visual-stat-bars.test.ts`, `test/party-stats.test.ts`,
    `test/threat-readout.test.ts`, `test/party-drawer.test.ts`,
    `test/pre-gym-confirm.test.ts`, `test/visual-phone-seed-bar.test.ts`.

## 12n. Patch 4.8.0.3: the measured heights, and a stale Pocket baseline

**Recorded 2026-09-14.** Prompt
[`spec/gymrun-patch-4.8.0.3-battle-readout-visuals.md`](spec/gymrun-patch-4.8.0.3-battle-readout-visuals.md),
committed verbatim before any work. It asks for the measured numbers to be
recorded here beside the existing entries, whether or not anything moved.

### The constraint, and what it did

"The strip must not move `decisionTop`. If it does, the strip gets a compact
height variant rather than the budget getting a deviation."

It did not move, in any mode. The strip and the band meter together took 4px
*off* the battle screen, which is a reduction and needs no variant.

| field | before | after | delta |
|---|---|---|---|
| `battle.decisionTop` | 472 | 472 | **0** |
| `battle.screenHeight` | 599 | 595 | **−4** |
| `battle.decisionBottom` | 712 | 708 | −4 |
| `modes.simple.battle.decisionTop` | 445.44 | 445.44 | **0** |
| `modes.simple.battle.screenHeight` | 581.44 | 577.44 | −4 |
| `modes.simple.battle.decisionBottom` | 677.94 | 673.94 | −4 |
| `modes.pocket.battle.decisionTop` | 355.39 | 355.39 | **0** |
| `modes.pocket.battle.screenHeight` | 481.89 | 477.89 | −4 |
| `modes.pocket.battle.decisionBottom` | 498.39 | 494.39 | −4 |
| `map.*`, `modes.*.map.*` | — | — | **0 on every field** |

Both columns are measurements taken on 2026-09-14 at 390x844, seed SMOKE24,
`scripts/visual/measure.mjs` — the "before" column from a checkout of merged
main at `46b5978`, not from the file. Which matters, because:

### The recorded baseline was stale on four Pocket fields before this patch

**And the correction is its own commit** (`46135b6`), ordered after the patch's
code and before this entry, so a diff of `heights.json` against 4.8.0.3 is not
read as one change. It is two, and only the second is the patch's.

| field | file said | main measures | out by |
|---|---|---|---|
| `modes.pocket.map.decisionTop` | 302.89 | 278.89 | 24 |
| `modes.pocket.map.decisionBottom` | 394.77 | 370.77 | 24 |
| `modes.pocket.battle.decisionTop` | 379.39 | 355.39 | 24 |
| `modes.pocket.battle.decisionBottom` | 522.39 | 498.39 | 24 |

Measured on merged main at `46b5978` with none of this patch applied. **The
24px predates 4.8.0.3** and belongs to whatever landed between the last
recording and `46b5978`; `modes.pocket.battle.screenHeight` was the one Pocket
field already correct, which is why the drift reads as a decision point moving
rather than a screen resizing.

It was found by isolation and it is worth saying how, because the first
reading was wrong. The patch's own measurement showed nine fields differing
from the file, and three of them were the 24px Pocket rows. Reverting the
archetype removal changed nothing; restoring the `BAND n` text changed the
battle rows and not the Pocket ones; only checking out `46b5978` entire showed
the four Pocket rows already differing with no patch present at all. **A
delta against a recorded file is not a delta against the tree.** The file is
now rewritten from a measurement of this tree, so all four are correct again,
and the 24px is attributed to whatever landed between the last recording and
`46b5978` rather than to this patch.

### Deviation: `tuning.maxMoveTagsOnFace` no longer reaches a face

Item 2 replaces the tag row on the card face with the fact strip, and the
strip is uncapped: `MOVE_FACT_IDS` bounds it at nine, no move carries nine,
and there is nothing to cut. So `tuning.maxMoveTagsOnFace` — and the
`tagsForFace` cut it drives, and `MoveUiView.tags` and `MoveCardData.tags` —
are computed and unread.

They are left in place deliberately. `src/data/tuning.ts` is read by `core/`
and is therefore hashed, so deleting the number **moves `contentHash`**, which
this patch is required not to do. Removing it belongs to a pass that is
allowed to move the hash. Until then `scripts/smoke.mjs` asserts the strip
against a measured ceiling of five rather than against the tuning value; the
worst real case is Fake Out at four — accuracy, a 100% secondary, a +3
priority bracket and contact.

**Closeout, check 3: that ceiling now lives in `data/`.** It was a `const` in
the smoke script, which is the one place such a number must not be. It is
`src/data/moveFactCeiling.mjs`, excluded from `contentHash` and imported by
the smoke script rather than restated in it. Plain ESM rather than TypeScript
because that script runs under Node against a *built* bundle and cannot import
a TypeScript module — which is the exact reason `tuning.maxMoveTagsOnFace` was
restated inline before it. Nothing under `src/` imports the file: the app does
not cap the strip, and the cap is an assertion about a viewport.

### Deviation: the copy fix went where the marker was, not where the prompt said

Item 3 names `run-map.ts:87` as carrying "best rewards". It does not, and had
not since `6351009` moved the tier copy into `data/tierInfo.ts` — the prompt
is quoting the `8c3bff8` audit line, which `docs/README.md` had already marked
"moved, still open". The surviving marker was `data/statusInfo.ts`'s Disable
advice, "Usually your best move, by design", and that is what was rewritten to
the attribute it was describing: Disable always takes the move just used. The
register line is closed.

One nearby line was left alone: the crit entry's "so it is strongest into a
wall". It is a consequence of a mechanic rather than a ranking of the player's
options, it was not what the register tracked, and widening the item on my own
reading is not this patch's call.

### What the strip took off the face, and where it went

Four tags are no longer on a card face: STAB, high crit, bypasses Protect and
sound. None is gone from the game — `moveTags` is unchanged, and the
explanation behind the existing tap prints the full set, as it always did. The
face now carries the nine fields that change this turn's arithmetic.

## 13. The AI tiers patch, and six rulings that changed what it built

**2026-09-11.** Prompt
[`spec/gymrun-patch-ai-tiers.md`](spec/gymrun-patch-ai-tiers.md), committed
verbatim before any work. Report
[`reports/ai-tiers-report.md`](reports/ai-tiers-report.md). Numbers in
[`balance.md`](balance.md) section 16.

The prompt's five report questions came back with four answers that
contradicted its picture of the tree, and the rulings on that report changed
the patch. **Recorded here rather than by editing the prompt**, per protocol 4:
the prompt is what was asked, and this is what was built.

### 13a. `fullDamageModel` was withdrawn, and easy is built by subtraction

The prompt specifies a `fullDamageModel` flag carrying "accuracy, expected
hits, stat ratio, boost stages, STAB, item", on the brief's premise that the
AI was a max-damage picker missing all six. **It was missing one.**
`core/battle/ai.ts` does not use a heuristic damage proxy at all — it calls `@smogon/calc`, which
has given it accuracy, multi-hit sums, the real stat ratio, boost stages read
off `ActiveView.statStages`, and STAB since Stage 0. Only the held item was
genuinely absent.

Porting the reference formula would therefore have replaced a real damage
calculation with poke-env's approximation *of* one. So: the calc is the
baseline, `crudeDamage` is a **handicap flag** that takes it away, easy tier
holds it, and `itemAware` is the one additive piece of the original flag that
survived. Handicaps and features share one flag space, as they do in
pokeemerald-expansion.

### 13b. `fullKnowledge` was cut

The prompt's hard tier reads the player's full spec. That needs a privileged
channel `BattleView` deliberately does not have, and the moment it exists the
prompt's own definition of done — no opponent has information the same tier on
the player side would not — depends on the simulator's player bot getting the
identical construction. Cut. Hard is medium plus `oneStepLookahead`.

`seenKnowledge` became the patch's real knowledge work instead, because the
report found the AI was **below** it: no foe moves in the view, the foe's
ability always null, and no reveal tracking anywhere. It is built in
`core/battle/knowledge.ts`, folded out of each side's own channel of the
protocol, and forgotten when the body leaves the field.

### 13c. `RUN_LOG_VERSION` does not move, and `contentHash` needed nothing

The prompt says to add `aiVersion` to the versions block and bump
`RUN_LOG_VERSION`. **`aiVersion` has been in the block and guarded since the
`contentHash` release** — `VERSION_AXES` lists it, `versionMismatch` checks it,
`test/ai-priority.test.ts` already asserted the refusal. The bump is one
string. No logged decision is added, removed, reordered or reshaped, so the
schema is untouched and `RUN_LOG_VERSION` stays at `gymrun-run-13`.

The prompt also says to add `data/ai.ts` to the hash composition "and to the
list in section 9", and to resolve a glob-versus-explicit-list contradiction.
Section 9 resolved it on 2026-09-11 in the glob's favour and states the
workflow for exactly this case: "a balance file under `src/data/` needs
nothing". It was hashed the day it landed; `contentHash` moved `b022fc` →
`5b6131` and refuses seeds shared across the patch, correctly.

The register's scope correction — "`AI_VERSION` is guarded nowhere, and
guarding it is a log-version bump" — is stale as of the `contentHash` release
and is closed by this patch.

### 13d. `--policy heuristic` was never built

Step 2 of the prompt asks for `heuristic` and `lookahead`. `heuristic` is
defined as "the medium feature set applied to the player side", and the
simulator's `greedy` bot **is** `decide(view)` with that feature set already.
It would have landed on top of `greedy` by construction and the prompt's own
reading of a sub-0.3-gym gap — "the battles do not reward skill" — would have
been drawn from an artefact. Only `lookahead` was built. `--policy ladder` runs
the three rungs that mean something: `random`, `greedy`, `lookahead`.

### 13e. The order of work changed: the refactor landed before the disconfirmer

The rulings put the lookahead benchmark before the scorer refactor. Building it
that way would have meant writing the lookahead term twice — once bolted onto
the old scorer, once as a flag — so the flag seam landed first, with the frozen
baseline proven byte identical against the recorded fixture *before* any
behaviour moved. The disconfirmer ran on the next commit. The ability fix still
came first, and still has its own row, which is what the ruling was protecting.

### 13f. Two defects found while reading, one fixed and one reported

- **The unknown ability**, fixed first and alone, with its own benchmark row.
  `docs/engine-notes.md` carries the finding.
- **The threat probe's comment says 80 base power and its code says 65.**
  Reported, not changed, per ruling 8. The number is load-bearing for every
  switch decision in the game, so which of the two is intended is a question
  for whoever wrote it and not a thing to guess at in a patch about something
  else. `src/core/battle/ai.ts`, `probeFor`.

### 13f-bis. `itemAware` shipped, and the defect writing it down exposed

Asked before the pull request, and worth recording rather than answering once:
**both of the report's named fixes landed, and both landed before every number
in `balance.md` section 16.**

- The unknown-ability fix is `829c42e`, `AI_VERSION` `-4`. The earliest
  benchmark row that reads it is stamped `gymrun-ai-4-ability` and was started
  twenty seconds after that commit; every row after it is `-4`, `-5` or `-6`.
  The one `-3` row in the table is the deliberate control, taken with the fix
  reverted in a throwaway worktree.
- `itemAware` shipped, in medium and hard, reaching both the calc bodies and
  the kill line.

Writing down *how far* the flag reaches is what found `-6`: `-enditem` is how a
berry announces itself — by being eaten — and the tracker read that line as
"holds this", so an `itemAware` tier kept pricing a spent berry into the kill
line for the rest of the battle. Fixed, versioned, and the affected rows
retaken; they came back identical to four decimals, which is its own small
finding. `balance.md` section 16.5d has the reach and 16.4 the retake.

### 13g. What did not move

Map generation is untouched: no keyed stream is opened, no structural draw is
added, and `previewRun` is a function of the tables alone. The AI's noise draws
from a sequence derived from each battle's own sim seed — a value
`encounters.ts` already drew under `nodeKey` — so a run log, which records the
player's decisions and not the opponent's, still replays into the same run.
That is asserted directly in `test/ai-tiers.test.ts` rather than left to
inference, because noise made it load-bearing for save and resume rather than
only for the benchmark.

## 14. The event rejig: what the four report questions found, and what moved

**2026-09-14, the event rejig patch**
([`spec/gymrun-patch-event-rejig.md`](spec/gymrun-patch-event-rejig.md), report
[`reports/patch-event-rejig-step1.md`](reports/patch-event-rejig-step1.md)).

The prompt opens with four questions and a hard stop. Three of the four
answers changed the shape of the patch, and a fifth finding nobody asked for
changed it more. Recorded here rather than by editing the prompt, per protocol
rule 4.

### What the prompt expected, and what the tree held

| the prompt's premise | the tree |
|---|---|
| bands may have replaced choices, and reintroducing them is "a bigger job than it reads" | choices survived. 4.6c widened each choice to three outcomes and kept the menu, the policy hook and the screen |
| `latent` "may be dead" under relics | `latent` is the common case. `data/capabilities.ts` measures a party of four missing a capability only 30 to 50 percent of the time |
| band 3 shipped a spawned encounter | band 3 shipped a *fightless* offer. There is no event battle, and there must not be one |
| the logged event decision may be an index, which "breaks replay" | it is an index, and the index rule in `core/types.ts` is the reason it should stay a stable identity rather than a content id |

### Deviation: `latent` is kept, not collapsed

Part 5 says to collapse the three capability bands to a boolean "if `latent` is
dead under relics". It is not dead, so the collapse is not taken.

The boolean Part 2 asks for is kept exactly where Part 2 puts it: the Attune
option is present at `known` and nowhere else, and `T3` is relic-gated with no
exception. What `latent` buys instead is strictly smaller — five points off
`T0` onto `T2` on the Gamble table, in `GAMBLE_TIERS_LATENT`. A party that
rolled a Water type reads a Surf event a little more kindly than a party that
did not, and no more kindly than a party holding the Tidecaller Shell.

Collapsing it would delete the only thing a party's *typing* currently says
about an event it holds no relic for, on a tree where that is the majority
case. If the simulator reports the difference as noise, the fix is to delete
one table and point `tierWeightsFor` at `GAMBLE_TIERS` for both bands — which
is the collapse Part 5 describes, taken on evidence rather than in advance.

### Deviation: `T3` pays a relic plus an item, not a "strong relic"

Part 1 asks for a common relic at `T2` against a strong relic at `T3`. There is
no strength axis on `data/relics.ts`, and adding one means ranking ten relics
by taste — which `CLAUDE.md` rules out directly: "it feels strong" is not a
reason, and a table populated that way cannot be corrected from evidence
later.

So `T3` pays **a relic and a held item**: the same object `T2` offers plus a
`T1`-grade rider. Strictly better by construction rather than by judgement, and
it needs no new column.

### Ruled: rarity was doing two jobs, and the fix is to decouple them

**2026-09-14, on the step 1 report.** The report found that Part 3 draws a
rarity per node while Part 4 assigns each event a rarity, so `(locale, rarity)`
named exactly one event — rarity had become the event's *name* rather than the
payout knob. That is what made the two required tests contradict each other:
"no event ID twice in one run" is "no rarity twice in a locale", which distorts
the distribution the rarity test pins.

The report proposed dropping exhaustion. **That was the wrong half to drop**,
and the ruling is to decouple instead:

- **Rarity stays a per-node draw that scales the outcome distribution, and
  does nothing else.**
- **Event identity is a separate draw** from the locale's event list.
- **The rarity column comes out of the Part 4 chart entirely.** An event is a
  locale, a relic, a hook and a toll price. Any event can roll any rarity.
- **Exhaustion is enforced within a segment** at generation, and repeats across
  segments are accepted.

Both tests survive, and it costs one extra keyed draw per event node.

**The refill rule, and the number that will decide the content question.**
"No repeat within a segment" cannot hold unconditionally at three events per
locale. Measured on the tree this patch started from, a segment generates three
to eight event nodes across its two or three offered locale routes:

    event nodes generated per map: 42, 42, 55, 39, 51
    per segment (seed COUNT-0):     6, 4, 3, 7, 8, 4, 6, 4

So one locale usually carries two or three event nodes and fits inside its
three events, and occasionally carries four or more and does not. The draw is
without replacement from the locale's unused list, and the list refills when it
empties — no repeat within a segment *until the locale runs out*, then repeats
rather than a failed draw. Deterministic, and independent of player behaviour.

Three events per locale is thin regardless. Growing to five is queued content
work, to be done after the system is proven, and it is the real answer to
repetition. The simulator reports how often the refill fires so that decision
gets a number rather than a guess.

### Ruled: an event Pokemon never costs a fight, at any tier

**2026-09-14, on the step 1 report.** The prompt's Part 1 says a `T2` Pokemon
arrives "via a spawned encounter and capture" and its test 8 says "victory
offers the capture". 4.6c shipped a *fightless* offer, and the report flagged
the contradiction rather than picking silently.

Fightless is ratified across every tier, and the deciding argument is about
the **Toll**, not about events in general:

> A Toll charges a stated, exact price for a guaranteed `T2`. If that `T2` then
> rolls a Pokemon and spawns a battle, the player paid a known cost and was
> charged an unknown second cost *after payment*. That is the one shape a Toll
> must never have.

The two older reasons still hold and are now the lesser ones: an event is a node
with no battle in it, which is what makes an event unable to end a run
(`tuning.eventDamageFloor`), and a second completion path would break the rule
that every node completion routes through the single result screen.

The consequence is that an event Pokemon is cheaper than a wild capture. That is
a pool-contents question — the weight on the `t2-pokemon` entry in
`data/eventPools.ts` — and not a mechanic.

### `contentHash` moved at step 2, and only the stamp moved with it

`b022fc4e` to `388c2a37`, caused by `src/data/eventPools.ts` landing and
`src/data/scaling.ts` gaining `EVENT_RARITY_WEIGHTS`. A hash over `src/data/**`
moves the day a table lands, which is the whole reason it is a hash and not a
hand bump.

Nothing under `core/` read either table at step 2, so no seeded output moved,
and that was checked rather than asserted:

- `test/fixtures/sim-report.json` regenerated: the `runs` payload is byte
  identical across the change, and `version`, `randomizerVersion` and
  `aiVersion` are unmoved.
- `docs/visual/baseline/` regenerated: seven files differ, every one of them
  in the 64-hex stamp and in nothing else.
- `test/ai-priority.test.ts`'s literal pin is updated rather than relaxed, with
  a comment naming this patch. A literal costs one visible line in a diff
  every time the data tables change, and that line is the point.

### Ruled: the logged identity is the archetype tag, and it needs a uniqueness rule

**2026-09-14, on the step 1 report.** The prompt's Part 6 asks for a per-event
option ID. The report argued for the archetype tag instead — `safe`, `gamble`,
`toll`, `attune` — because it is a closed set that cannot drift the way a
per-event id outliving a `data/events.ts` edit can, and because a log naming
`attune` on a replay without the relic then fails loudly, which is the property
the index rule in `core/types.ts` exists to produce.

Taken, **with one condition the report did not state**: no event may carry two
options of the same archetype, or the tag stops being a unique identity within
its event. That is asserted over the whole table at step 6, when the event
entries land, rather than being left to authoring discipline.

### The merge order against the AI tiers branch

**2026-09-14.** The priority-and-speed AI tiers branch sits unmerged at
`AI_VERSION` 5. Whichever of the two lands second pays for a benchmark
rebaseline, so the order is decided here rather than discovered later: **the AI
branch lands first.** It is finished and this one is four steps from a
benchmark, and this patch's benchmark is worth more read against the AI the
game actually ships than against a `gymrun-ai-3-priority` about to be replaced.
The rebaseline costs this branch one simulator run it performs at step 7
anyway. The benchmark row is stamped with whichever `AI_VERSION` is on `main`
when it is recorded — read down a prefix, never across.

### Step 3 moved run content, and the guarded heights with it

**2026-09-14.** Step 3 is the first part of this patch that changes what a run
*does*, so the two presentation baselines moved and the four suites that pin
them failed. Both movements were checked before either baseline was re-recorded,
because re-recording on a red test is how a guard becomes decoration.

**The run log did not drift; the payouts did.** On SMOKE24, all 295 decisions
are identical before and after — 162 battles, 27 nodes, 5 locales, and the same
six event decisions at the same indexes. Map generation is untouched, which is
the keyed-stream discipline doing its job: an event draws on its own node's
`event` sub-stream, so changing what events pay cannot move a battle. What moved
is the state those events produced: currency 1015 to 1120 on that seed, same
party size, same relics, same gyms cleared.

**The guarded screen heights moved with it**, and only on the map:

| measurement | before | after |
|---|---|---|
| `map.screenHeight` | 840.41 | 824.19 |
| `map.scrollHeight` | 1033 | 1017 |
| `map.decisionTop` | 558 | 558 |
| `battle` (default mode) | unchanged | unchanged |

The decision point did not move — `decisionTop` and `decisionBottom` are the
same to the pixel — so the 16.22px is content *below* the decision point, which
is the map's own readout of a run that now carries different numbers. Pocket
mode shifts both screens by 24px for the same reason. `heights.json` is
re-recorded rather than excused, and this table is the record of what it was.

`contentHash` moved a third time, to `6eb7c3b0`, because step 3 edits
`data/events.ts` and `data/eventPools.ts`. The literal in
`test/ai-priority.test.ts` moves with it, as it will once more at step 6.

### The refill rate at the real table size, and what it means for five per locale

**2026-09-14, step 6.** The exhaustion rule draws an event without replacement
from its locale's list and refills when the list empties. Step 3 measured 3.3
refills per segment, which was an artefact of the placeholder table holding one
event per locale. At the shipped table — three per locale, eight locales —
measured over 120 seeds and 960 segments:

| | |
|---|---|
| event nodes generated per segment | 5.86 |
| refills per segment | **0.37** |
| refills per run | 2.95 |
| runs with at least one refill | 116 of 120 (97%) |
| per-run refills, median / max | 3 / 7 |

A ninefold improvement on the placeholder, and the shape is what the arithmetic
predicts: a segment offers two or three locales, so each locale carries about
two event nodes against its three events and mostly fits.

**This is a generation-time number, not a player-facing one.** A refill means
one locale's list wrapped while the map was being built, across branches the
player will never walk. The player walks roughly one event per segment, so a
repeat only reaches them if they walk the same locale twice *and* the wrapped
draw lands on the node they choose. The figure that matters for the
five-per-locale decision is therefore an upper bound on felt repetition rather
than a measurement of it, and the simulator's own event report is where the
lower bound will come from.

### Step 8: the Part 4 carve-out, and what the map paid for rarity

**2026-09-14.** The event screen shows, under every option, what it costs and
which tier pool its outcome is drawn from: `Reward: T1`, `Reward: T0 to T2`,
`Costs 20% HP, lead` / `Reward: T2`.

**The carve-out.** Tier labels are ordinal, and Part 4 bans ordering that
implies ranking. They are allowed here on the same precedent as the `BAND n`
badge: the label names *which pool the outcome draws from*, which is an
attribute of the button rather than a verdict about it. Nothing else moved —
no recommendation, no highlight on the better option, no expected value shown,
and no marker on Attune beyond the relic requirement the gate chip already
carries. `test/event-screen.test.ts` asserts all four negatives.

**The range is derived, not restated — and that caught a contradiction in the
prompt.** Part 8 says the Attune option reads `Reward: T2 to T3`. Part 3's own
`ATTUNE_TIERS` gives `T1` a weight of 10 at common and 5 at uncommon, so at
those rarities the honest range is `T1 to T3`. `rewardOf` reads the range off
the weights, so the label says `T1 to T3` where the table pays `T1` and
`T2 to T3` at rare, where it does not. The label gave way rather than the
table: hardcoding Part 8's string would promise a floor the distribution does
not have. Zeroing those two weights would resolve it the other way and is a
tuning change, not a screen change — it is not taken here, because retuning
between checkpoints is what the standing policy forbids.

**Rarity on the map cost 37.6px, and Pocket does not pay it.** Part 8 asks for
rarity on the map readout, flagging it as arguable. Added as a third chip
beside the requirement and the band — and at 390px the third chip wraps the
gate row:

| mode | before | after |
|---|---|---|
| default `map.screenHeight` | 824.19 | 861.78 |
| `modes.pocket.map.screenHeight` | 570.73 | **586.95**, its original pre-patch value |
| `map.decisionTop` / `decisionBottom` | unchanged | unchanged |

So the map is 37.6px longer at full density, all of it below a decision point
that did not move, on a screen that already scrolls. **Pocket hides the chip**,
which is that mode's whole rule — the third attribute is the one that goes —
and the information is not lost, because the event screen carries it at every
density.

**One thing V2 caught.** The rarity chip was first given its own border and
text colour, which made a *second* neutral chip style; `test/visual-v2.test.ts`
holds the rule that every neutral chip shares one style and only the type chip
carries a hue. The override was deleted rather than the rule relaxed, and the
`--rarity` modifier now exists only so the Pocket rule has something to select.

### The defect the log-shape change caused, and the suite that caught it

**2026-09-14, after step 8.** Changing the event decision from an index to an
archetype broke saved runs, and it broke them silently.

`ui/storage.ts`'s `isRunDecision` listed `event` among the kinds validated as
`typeof decision.index === 'number'`. After step 5 an event decision carries an
`archetype` and no `index`, so the check failed for **every saved run that had
passed a question mark**: `loadRunLog` returned null and the save was
unresumable, with no error anywhere — the run simply was not there.

`test/storage.test.ts` caught it, and the case it caught it with is the one
written for exactly this: "loads every log a real run saves, **whatever kinds
it holds**", which plays a real run rather than hand-building a log with three
decision kinds in it. The older version of that check knew three kinds and
would have passed.

The fix validates the four archetype names rather than `typeof === 'string'`,
because the point of the tag is that it is a closed set: a log naming anything
else is a log this build cannot replay, and it is refused at the boundary
rather than at the call site that reads it.

**Worth stating plainly, because it is the second time this shape of bug has
reached this repo:** a decision-schema change has to be walked through every
reader of the schema, and the type system does not find them all — `storage.ts`
validates a `RunDecision` structurally, from `unknown`, so it typechecks
perfectly while disagreeing with the union it is validating.

### The bug the risk predicted, found the same day it was logged

**2026-09-14.** The note above was written about `ui/storage.ts`. The same
shape was already sitting in `core/run.ts`, four stages old, and a question
about it — "rewards from events aren't going into inventory, does that make
sense?" — found it.

`resolveNode` folded the event outcome and then read two of the three fields it
returned:

```ts
const after = applyEventOutcome(priced, outcome, state.tuning);
party = after.party;
currency = after.currency;     // and backpack, dropped on the floor
```

**Live since Stage 4.5.1** (`0b450d2`, "a bag that catches things"), which is
the patch that moved an event's item from the lead into the backpack.
`applyEventOutcome` folded it correctly from that day and its unit tests passed
throughout; the call site was never updated, so for four stages every item an
event paid was folded into a value nobody read. The header comment in
`core/events.ts` describing the item going "into the backpack, like every other
item the run acquires" was accurate about the fold and wrong about the game.

Before the rejig it swallowed grants only. After it, it would have swallowed
costs too: a forced discard and a berry toll both change the bag and nothing
else, so both would have been announced to the player and never charged.

The fix destructures the whole result — `({ party, currency, backpack } = after)`
— so the next field `applyEventOutcome` learns to change cannot be dropped the
same way. `test/event-inventory.test.ts` asserts at the `resolveNode` seam
rather than at `applyEventOutcome`, which is where the coverage already was and
where it could not see the gap.

**The existing suites could not have caught it**, and it is worth being precise
about why rather than adding a test and moving on. `test/economy.test.ts` has
an event item assertion — it calls `applyEventOutcome` directly.
`test/band3.test.ts` resolves a node, but through the *acquisition* path, which folds party rather
than bag. Nothing played a run and then looked in the bag. That is the test
that existed nowhere and exists now.

### Ruled: the Attune floor comes up, and Part 8 wins the contradiction

**2026-09-14.** `ATTUNE_TIERS` gave `T1` a weight of 10 at common and 5 at
uncommon, while Part 8 of the prompt said the option reads `Reward: T2 to T3`.
Because the screen label is derived from the weights rather than restated
beside them, the screen honestly said `T1 to T3` and the contradiction
surfaced instead of hiding.

**The ruling went to Part 8**, and the argument is about what the gate is for:

> An Attune paying `T1` means the player held a scarce relic, spent the gated
> option on it, and got a minor payout. That is the one outcome the gate exists
> to prevent.

The two weights moved onto `T2` rather than being deleted — common 60 to 70,
uncommon 50 to 55 — so the distribution keeps its shape and only its floor
moves, and the `T3` weights are untouched. `contentHash` moves with it.

Worth noting how this was found, because it is the second time the same
technique has paid: the label is *derived* from the table it describes, so a
disagreement between the spec's prose and the spec's numbers became a visible
string on a screen rather than a discrepancy nobody was looking for. The same
property is why `tierRangeOf` exists at all.

### The dead-citation check, and the second one it found

**2026-09-14.** `test/boundaries.test.ts` walks the live documents for paths
that do not resolve. It found a band3 citation in this file missing its
extension — and could not see that `core/types.ts` twice cited an
event-archetype-log suite, a file named while the comment was being written and
never created, because the walker only read `docs/`.

(The dead names are spelled out here without backticks on purpose. The checker
reads a backticked path as a claim that the file exists, and prose *about* an
absence is exactly the case its `NAMED_AS_ABSENT` list exists for — a list the
suite asserts may shrink and never grow, so the right move is to not make the
claim rather than to widen the exception.)

It reads `src/` comments now too, scoped to `test/` paths inside backticks.
The narrowness is deliberate: a comment may reasonably describe a module that
moved or is being argued about, and failing on those would make the check
noise, but a citation of a *test* is a claim that a named file enforces
something and that claim is either true or it is not.

**It found a second dead citation on its first run** — `core/events.ts` cited
an event-archetypes suite, where the assertion actually lives in
`test/event-generation.test.ts`. Two dead pointers to rules that *were* being
enforced, both written in the same patch that added the rules. This repo leans
on comments naming the test that holds a rule, so a citation that goes nowhere
costs more here than a broken link in a document: it is the thing a reader
trusts when deciding whether a rule is enforced at all.

## 15. The playtest patch: three effects an event drew and never paid

**2026-09-14.** A playtest report on the deployed build
(`GYMRUN-1e6f02-Z8HE3NMU`, `0.3.0 · R14`) named two gamebreaking bugs and one
readability complaint. The prompt is filed verbatim at
[`spec/gymrun-patch-event-rewards-and-move-card-fields.md`](spec/gymrun-patch-event-rewards-and-move-card-fields.md).

> Still no rewards in ? Event rooms
> I picked minus hp for T2
> Didnt get hp hit and didnt get the reward move.

### The same defect, for the third time, in two more places

Section 14 above records two instances of one shape: an effect that folds
correctly at one end, is announced at the other, and is joined by nothing in
between. `ui/storage.ts` validated an event decision that no longer had the
field it checked; `resolveNode` read two of the three fields
`applyEventOutcome` returned. Both were found and fixed in the rejig.

**Two more were sitting in the same function the whole time**, and this is what
the report found:

| effect | what it did | since |
|---|---|---|
| `move` | `applyEffect` returned the run untouched; nothing asked who learns it | the rejig |
| `relic` | `applyEffect` returned the run untouched; `resolveEffect` resolved nothing, so no relic was ever named | the rejig |

Both carried a comment saying the work belonged elsewhere — "Step 5's job" for
the move, "decided at offer resolution" for the relic — and in both cases the
comment described a correct design that was never built. That is worth stating
as a rule rather than as two bugs: **a comment deferring work to another file
is not evidence that the other file does it**, and neither the type system nor
a unit test of the fold can tell the two apart.

The cost was not marginal. `move` is 8 of 23 weight in every `T2` band and 7 or
8 of 22 in every `T3`; `relic` is another 4 to 6 and 5 to 7. **Over half of
what a Toll bought went nowhere**, which is exactly what "still no rewards in ?
event rooms" describes.

Measured at the `resolveNode` seam over five seeds and every event node on each
map, before the fix:

| effect | drawn | delivered |
|---|---|---|
| `T2/move` | 157 | 0 |
| `T2/relic` | 90 | 0 |
| `T3/move` | 28 | 0 |
| `T3/relic` | 25 | 0 |
| `toll/hp` | 133 | 133 |

### The HP toll was charged all along, and said nothing

The third item in the report — "didnt get hp hit" — is the one that was **not**
a state bug. `resolveNode` has called `applyToll` since the rejig and the table
above shows it landing on every draw. What was missing was the sentence: the
price is on the button before the press, `resolveNode` charges it, and the
reveal went straight to what it bought. A player who spent a fifth of their HP
and read only the reward reasonably concluded the charge had not happened.

The reveal now names it — `Paid: 20% HP, lead`, from `TOLL_PAID_PREFIX` in
`data/eventCopy.ts` — on its own line above the outcome, in the order the run
applies them. Past tense against the button's present tense, which is what
separates the price from the charge.

**Recorded because the diagnosis nearly went the other way.** Two of the three
reported symptoms were missing state and the third was missing copy, and they
are indistinguishable from the player's side. The thing that told them apart
was measuring the fold rather than reading it.

### What the fix cost on the version axes

- **`RUN_LOG_VERSION` to `-15`.** An event that pays a move now asks the
  existing `target` and `replace` pair, in a place no earlier log has an answer
  for. Every entry in the pair is an old shape and the sequence is still
  changed, which is the guard's own rule.
- **`RANDOMIZER_VERSION` to `-15`.** A `relic` grant draws a full shuffled
  permutation of the relic table plus a fallback at generation, the same two
  things a relic *card* draws, so resolution consumes no RNG and picking up a
  relic mid-run still shifts no roll.
- **`contentHash` to `53145f`.** `data/eventPools.ts` gained a `fallback` on
  its six relic entries.

### Deviation: a relic grant names its fallback in the table

Part 1 of the rejig prompt has `T2` pay "a common relic" and says nothing about
a run that holds all ten. The reward pool answers that case by drawing a
fallback from the same pool's non-relic entries, which would have made
`resolveEffect` recursive through `drawOutcome`. The event pools name the
fallback instead, as a required field on the entry, restricted to an item.

Required rather than optional, and an item rather than any effect, for the same
reason: a fallback chain can end in nothing again, and "an unpayable entry"
is the defect this whole section is about. An item is the one grant that is
always payable and can never itself need a fallback.

### The baselines moved by exactly the version stamp, and nothing else

Re-recorded, with the evidence first as at step 3 of the rejig:

- **Every decision in all six baseline runs is byte identical** — 293 on
  SMOKE24, 72, 88, 206, 265 and 79 on the others — and so are the outcome, the
  gyms cleared, the currency and the relics held. The only key that moved in
  any of them is `log.versions`.
- **`docs/visual/baseline/battles/GYMRUN01.json` is byte identical.** The
  battle engine is untouched.
- `data-digest.txt` moved with `contentHash`.

`test/fixtures/sim-report.json` re-minted to the same three lines — `version`,
`randomizerVersion`, `contentHash` — with all three of its runs byte identical.

The reason the runs held still is worth writing down, because it is the keyed
streams paying for themselves twice in one patch: the baseline policy takes
`safe` at every event, `safe` is drawn first of the four archetypes, and the
relic shuffle's extra draws land after its outcomes. A patch that added draws
*before* the first option would have moved all six.

**And it is a finding about the instrument, not only a convenience.** Safe pays
a flat `T1`, which never contained a move or a relic on any tier band, so the
bot that produces every number in `balance.md` walks past this entire fix.
Section 18 there records that the standing benchmark is blind to the Toll and
the Gamble — which is where an event's variance lives — and why that is left as
an open item rather than fixed inside a bug fix.

### The move card's fields stopped moving, and the battle screen fell 41px

The third report item — "the line breaks for the band and the accuracy etc must
be consistent for the user to remember what they mean ... we can try a
4-column view" — was two separate faults on one card.

`.move__meta` carried five things and wrapped against its own content, so
`BAND n` sat on the first line of one button and the second line of the next
depending on how long that move's type name was. And `.move__facts` packed its
chips left to right, so a move with no contact flag put its secondary-effect
chance exactly where the button beside it put contact.

The band and the effectiveness marker moved onto the fact line, which is now a
grid: `auto` for the band, **four fixed fact columns**, `auto` for
effectiveness. Four is measured rather than chosen — across the 458 pool moves
the distribution is 46 with no face facts, 113 with one, 202 with two, 93 with
three and 4 with four, so four columns hold every move the game can draw
without dropping a field, and the ceiling is *reached*, which is what makes
four right rather than merely safe.

Which fields share a column is from the co-occurrence data, not from taste:
`accuracy` (405 moves) and `contact` (185) pair with nearly everything and take
a column each; `secondary` (160) and `multiHit` (22) never co-occur; and
`priority` (21), `recoil` (9), `drain` (10), `charge` and `recharge` pair with
none of each other. `test/move-fact-columns.test.ts` re-derives all of it over
the live pools, so a move added to `data/movePools.ts` that breaks a pairing
fails there rather than silently hiding a field on one card.

The measured effect, at 390x844 on SMOKE24:

| field | before | after |
|---|---|---|
| `battle.screenHeight` | 595 | 554 |
| `battle.decisionBottom` | 708 | 667 |
| `battle.decisionTop` | 472 | **472** |
| `modes.simple.battle.screenHeight` | 577.44 | 536.44 |
| `modes.simple.battle.decisionBottom` | 673.94 | 632.94 |
| `modes.simple.battle.decisionTop` | 445.44 | **445.44** |
| `modes.pocket.battle`, every field | unchanged | unchanged |

**41px off the tightest surface in the game, and `decisionTop` unmoved in all
three modes** — the gate 4.8.0.3 set. The height came from the wrapped line the
band was causing, so the patch that made the card consistent is the same patch
that made it shorter; the map is unmoved. Pocket did not move at all, which
says the wrapped line was already suppressed there.

**The DOM order of the strip changed with it**, and that is a deliberate
consequence rather than a side effect: a field's column is its identity now, so
the chips are drawn in column order rather than in `MOVE_FACT_IDS` order, and
`contact` is drawn second instead of last. The set is unchanged — nothing is
dropped and nothing is invented — and `test/battle-readout.test.ts` asserts
both halves separately so the distinction cannot blur.

### The gates, and one honest asterisk on the suite

Run on this branch at `a4ef1f8`:

| gate | result |
|---|---|
| type check (`tsc --noEmit`) | clean |
| lint (`eslint .`) | clean |
| build | clean |
| smoke (`npm run smoke`) | passed, every check |
| guarded heights vs `heights.json` | equal to the pixel after the re-record |
| determinism, stream isolation, version guards | in the suite below, all green |
| full suite | **1547 / 1547 in 117 / 117 files** |
| full suite under `GYMRUN_TRIM_STRICT=1` | **1547 / 1547 in 117 / 117 files** |

**The asterisk:** both suite runs exit non-zero on two identical
`[vitest-worker]: Timeout calling "onTaskUpdate"` errors — the reporter's
RPC timing out, with no test attributed and every test passing. They are
recorded rather than waved away, and the reason they are believed to be the
container rather than the patch is that the *earlier* run on this same branch,
the one carrying seven genuine failures, produced three of them. They track
load, not outcome. **Not verified against `main`**, which would cost another
full run; a reader who needs that certainty should take it before merging.

The first build of this patch failed three gates, and all three are worth
keeping because each caught something a reading of the diff would not have:

1. **`test/visual-v3.test.ts` and `test/visual-chips.test.ts`, from opposite
   directions.** `minmax(0, 1fr)` let a fact chip overflow its own cell and
   paint across the next one, so the accuracy chip took the contact chip's hit
   target and the contrast sampler read one chip through another. Neither suite
   was looking for a grid. The floor is `min-content` now.
2. **`test/relic-permanence.test.ts`.** The first build appended to
   `state.relics` from `core/events.ts`. That test greps `src/` for a second
   writer of the held set and its own comment names an event outcome as the
   case it exists for — so it caught, by name, the thing it was written for
   four stages earlier. `rewards.grantRelic` is the one writer now, and
   `applyReward`'s relic arm is a call to it.
3. **`test/visual-v5.test.ts`, amendment A6.** It pinned the two-line
   `.move__meta` as a guard against a careless tighten squeezing the band badge
   off the face. The wrap was the defect, so the assertion flipped rather than
   relaxed — and A6's actual hazard is still checked, one assertion down, by
   the overhang count that never depended on the wrap.

## 16. The relic that did nothing, and the event bug that was already fixed

**2026-09-15.** A playtest message — "the stupid event bug means the events
don't work at all. which also nullifies relics. fix that first. chase down the
cause. play every possible event and event caller" — produced two answers, and
only the second was a bug in this tree. The prompt is filed at
[`spec/gymrun-patch-relics-do-nothing.md`](spec/gymrun-patch-relics-do-nothing.md).

### The chase: 1344 resolutions, no promise broken

Every event definition, at every capability band, on every archetype it
presents, across every segment band the tier pools cover — **1344 resolutions**
— played through `resolveNode` and compared against what the event screen
promises the player, with **exact multiset accounting on the backpack** rather
than a length check.

The multiset part is the reason the audit is worth recording rather than just
running. The first pass used lengths and reported three failure classes; all
three were the instrument, not the game. A discard toll that removes an item
and a grant that adds one leave the bag exactly as long as it was, so "the
toll was never charged" and "the toll was charged and then paid back" are the
same number. Accounting for the expected bag item by item made all three
disappear.

Separately, **all 216 item ids the event pools can pay resolve in
`data/items.ts`**. `stow` silently drops an id the table does not know, so a
typo in a pool would be an invisible grant; there is none.

### The event bug was real, and was fixed on a branch nobody merged

`origin/main` still has `case 'relic': return state` and the `move` no-op, and
the build the report came from is stamped `GYMRUN-1e6f02-…` — which is
`main`'s `contentHash`, not this branch's `53145f`. So "events don't work at
all" was exactly true of the build being played and exactly false of the
branch sitting in front of it.

**Worth stating as a process note rather than a code note:** a fix that is
committed, gated and pushed is not a fix the player has. Section 15's work was
all four of those and the reporter still met the original bug, because nothing
had merged. The thing that made this diagnosable in minutes was the seed stamp
carrying `contentHash` — a build identifier on screen turned "it is still
broken" into "you are running a different build" without a single guess.

### Relics really were nullified, by a fifth instance of the same shape

`core/relics.ts` folds the held set into a `RelicEffects` — a per-node heal,
per-node currency, a backpack slot, a revive bonus, a shop discount — and
**`applyRelicPassives` had no caller anywhere in `src/`.** Two test files
imported it. Nothing else did.

`core/capabilities.ts` imports `grantsCapability` from the same module, so the
file has importers and reads as live to anything that checks for them. That is
what let it sit: the module was used, the function was not, and no gate
distinguishes the two.

So a relic did exactly one thing — satisfy the capability gate on an event —
while `data/relics.ts` described five things it did, two of them in copy the
player reads for the rest of a run:

> Tidecaller Shell: "The sound inside it mends a little at every stop."
> Everburning Lantern: "The party rests easier near it."

**This is the fifth instance of one defect shape**, after the two the event
rejig found (section 14) and the two the playtest patch found (section 15): a
fold that is correct at one end, a promise made at the other, and nothing
joining them. Every one of the five type-checked perfectly, and every one had
passing unit tests on the fold itself.

The five sites the fold is now read at:

| passive | site | measured |
|---|---|---|
| `nodeHealPercent` | `betweenNodes` | lead at half HP, one node: 73 → 79 and 80 |
| `nodeCurrency` | `nodePayout` | a trainer node: 14 → 17, 18, 19 |
| `backpackSlots` | `backpackCapacity` | 5 → 6 |
| `reviveBonus` | `betweenNodes`' revive | a fainted member back at 172 → 193 |
| `shopDiscount` | `resolveStock` | a 186 shelf price → 164 |

`test/relic-passives.test.ts` drives every case off `data/relics.ts` rather
than off named ids, and asserts first that the table's set of passive kinds is
the set the file covers — so a sixth kind added to the table fails there rather
than being added and quietly ignored, which is exactly how the five above got
in.

### The node heal restores HP and not PP, and lands after the revive

Two decisions inside one line, both recorded because neither is forced.

`recoverParty` restores HP *and* PP and clears status unless told otherwise. A
relic that silently refilled PP at every node would be a far larger effect than
the one printed on the card, so the heal passes `0` for PP and `false` for
status: it is a heal, and the card says so.

It runs *after* the revive rather than before, so a member revived at this
boundary is standing by the time the heal arrives and is mended too. That is
what "mends a little at every stop" says, read plainly.

### `resolveStock` gained a discount stamp, because it was idempotent by contract

The function's own comment says `playRun` resolves a shop twice and that
resolving at two sites is how the two come to disagree. Collapsing a relic card
is naturally idempotent; **a discount is the first thing it ever did that would
compound**, and the suite caught it immediately — a second call took 198 to
174.

`ShopStock` now carries the discount already applied, so a second resolution is
a no-op on price. It is not logged and does not need to be: a run log stores
shelf indexes, so a replay re-derives the shelf and re-resolves it against the
relics the replayed run holds at that node.

### What this moves

No version axis. Nothing new is drawn, no draw moves, and no decision is added,
removed, reordered or reshaped — `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and
`contentHash` all hold still.

**Seeded output moves, and heavily**, for any run that holds a relic: the
per-node heal alone changes the HP a party carries into every fight after the
first relic. Balance is not a gate; the figure is in
[`balance.md`](balance.md) section 19.

## 17. Carry on did nothing: the stale item plan, and the catch that hid it

**2026-09-15.** A playtest report — "game breaking bug: soft locked at this
screen / help me chase down why" — with three screenshots of an event reveal
whose Carry on button did nothing. The prompt and a transcription of the
screenshots are filed at
[`spec/gymrun-patch-carry-on-softlock.md`](spec/gymrun-patch-carry-on-softlock.md).

The build in the screenshot is stamped `GYMRUN-53145f-…`, which is this tree's
`contentHash` — so unlike section 16's report, this one was met on the build it
describes.

### The node, named exactly

The reveal reads `Discard one bag item` against `+42 coins`, on the Gamble of
`cave-collapsed-shaft`, at `4 / 8`. That is `t0-bag-rifled` in
`data/eventPools.ts` — `cost: [{ kind: 'discard', count: 1 }]`,
`grant: [{ kind: 'currency', amount: 42 }]` — which sits in the middle segment
band, where segment 4 draws. The drawer screenshots show the party holding
items, a Sharp Beak on the lead.

### The chain

`ui/app.ts` collects an `ItemPlan` from the party screen into `pendingPlan` and
spends it at the **next** node boundary. `playRun` asks for that plan *after*
`resolveNode` — deliberately, because everything that hands the run an item
lands inside `resolveNode` and a plan composed before the node would be asking
the player to arrange items they have not been given. The cost is that the plan
is composed against one inventory and applied against another, and nothing
reconciled the two.

So: the event's forced discard destroyed a bag item; the held plan still named
it; `applyItemPlan` refused the plan with a `RangeError`, correctly and by its
own documented rule; and `playRun` rejected.

**Where it became a soft lock rather than an error.** `app.ts` wrapped the
whole run in `catch {}`, on a comment saying the only non-finishing exit was an
abandoned pending decision. That was true once. Every `RangeError` `core/`
raises to refuse an illegal answer lands there too, and a bare catch cannot
tell them apart. The player was left on a screen whose question was already
answered, with no control that advances anything and nothing in the console.

**And it survived a reload**, which is what made it game-breaking rather than
annoying. `onDecision` is `saveRunLog`, and `record` runs before the answer is
applied — so the plan `core/` then refused was already in `localStorage`. A
reload resumed that log, replayed the same decisions, and died at the same
step.

### What was built

- `core/items.ts` gains `reconcileItemPlan`, pure and headless: a plan
  composed against an older inventory, brought forward onto the one that
  exists. An assignment naming a slot the party no longer has is dropped; a
  slot named twice keeps its first entry; an assignment naming a destroyed item
  becomes an unequip rather than being dropped; a discard of something already
  gone is dropped; whatever is over capacity afterwards is discarded from the
  front, the same rule `defaultItemPlan` uses.

  **The unequip is the part worth recording.** Dropping the assignment instead
  would leave that slot holding its current item — and that item would then be
  missing from the pool the rest of the plan draws on, so one destroyed item
  would invalidate a second, unrelated assignment. Emptying the hand keeps the
  plan a complete destination, which is the shape `applyItemPlan` reads.

  It walks the pool exactly the way `applyItemPlan` does, so what it returns is
  legal by construction. `test/item-plan-staleness.test.ts` asserts that as a
  property over adversarial plans rather than only on the reported case.

- **`applyItemPlan` is unchanged.** It still refuses an illegal plan loudly. A
  hand-edited log naming an item the run never held must fail, because silently
  repairing one replays as a different run — the rule that function's own
  comment states. Reconciliation belongs to whoever *composes* an answer, and
  the composed answer is what the log records, so a replay applies the same
  plan the live run did.

- `ui/pending.ts` gains `RunAbandoned` and `isRunAbandoned`, so the catch can
  tell a run the player walked away from — expected, silent — from a run that
  broke. Everything that is not abandonment now reaches the console, says so on
  the seed bar in `SEED_COPY.runFailed`, hands the seed controls back, and
  **clears the saved log**. A log that deterministically cannot be applied is
  not a run to go back to; re-offering it is a Resume button whose only effect
  is to reproduce the failure. That is a real cost and it is the smaller one.

### What this moves

No version axis. `reconcileItemPlan` adds no draw, changes no draw order, and
adds, removes, reorders and reshapes no logged decision — `RUN_LOG_VERSION`,
`RANDOMIZER_VERSION` and `contentHash` all hold still. `data/seedCopy.ts` is
already on the `contentHash` exclusion list, so the new string does not move
the hash.

Seeded output does not move for any run the scripted policies produce:
`defaultItemPlan` is computed from current state and was always legal, so
reconciliation is the identity on it. What changes is only what the *app*
answers with, which no benchmark drives.

### The shape, stated once

This is the same defect shape as sections 15 and 16 seen from the other side.
Those were a value computed and never read. This is a value read long after it
was computed, against a world that had moved. Both are a seam where two ends
were individually correct, and neither the type system nor a unit test of
either end could see the gap.
