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
is a false rejection when a display number moves. ~~**Open, small.**~~
**Closed 2026-09-16** by the battle animation run's Branch 1, with one field
named and declined: `battleFeedbackMs`, `minChipFontSizePx` and
`minChipContrastRatio` moved to `src/data/displayTuning.ts` and onto the
exclusion list; `maxMoveTagsOnFace` could not, because `core/battle/view.ts`
reads it and an excluded file may not be a `core/` dependency. Section 21
deviation 2. The "decision with its own release" this paragraph defers is
exactly what closed it: the release was a playtest reporting that the beats
were too fast to see, and a number parked for a playtest has to be movable when
the playtest arrives.

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

## 17. The bar primitive, and the beats move onto the sprites

Prompt:
[`spec/gymrun-patch-bar-primitive-and-battle-beats.md`](spec/gymrun-patch-bar-primitive-and-battle-beats.md).
Branch `claude/kind-mccarthy-w3kml6`, cut from `main` at `321d4f9` (PR #34).
Built 2026-09-15. Presentation only: no `core/` change, no `data/` change, no
version axis moves, and both instruments held still — the guarded heights
equal `docs/visual/baseline/heights.json` to the pixel, so nothing was
re-recorded, and `npm run smoke` rematches `GYMRUN-53145f-SMOKE24`.

### What the prompt asked, and where it had already landed

The prompt's first question was where "jiggle the sprite on attack" and
"slight animation to HP" had landed. **Both shipped in Release C** (PR #16,
`846975c`), and the answer that shaped the patch is that neither shipped in
the form the question assumed: the jiggle was on the *panel*, because sprites
did not reach the battle screen until V5.3, and the HP bar had been
*de*-animated on purpose — the fill snaps and leaves a fading chunk, which is
the "chunk disappearing" the prompt then proposed. The proposal was therefore
not a new animation but a home for the one that existed.

### The bar: one component, six sites

`ui/bar.ts` is Release C item 1's chunk and shadow moved out of the battle
panel, with `hpBand` and `MIN_CHUNK` beside it, behind `createBar({ variant,
shadow })` and a `set(fraction, { chunk })` that returns whether a chunk was
drawn. The battle panel, the bench, the party member card, the item target,
the acquisition list and the run map each became a `createBar` and a `set`;
four of them lost a copy of the same band ternary. **DOM shape and class
names are unchanged at every site**: `.hp`, `.hp__fill`, `.hp__shadow` and
`.hp--slim` are the names the stylesheet, the density overrides and every test
selector already use, and renaming them to `bar` would have touched all of
that for no change on screen. The shadow is opt-in, so a bar that never had
one still renders its single child. `test/bar.test.ts` holds the component's
own rules and that no file under `src/ui/` builds a track by hand; the whole
Release C describe in `test/battle-feedback.test.ts` is untouched and passed
through the migration unedited, which is the regression guard.

A `neutral` variant carries no band and no threshold. It has no consumer yet;
it is there so the next progress readout is a `createBar` and not a seventh
hand-built track.

**Left where it was:** `.stat__bar-fill` in `member-card.ts` is a magnitude
bar over a 200 ceiling rather than a fraction, carries a pre-Release-C `120ms`
width transition that `test/visual-tokens.test.ts` counts among its 17 and
`test/visual-stat-bars.test.ts` waits on. Moving it onto the neutral variant
and retiring that duration is its own small patch; open item 16.

### The beats: four slots inside the one number

Release C item 2's nudge left the panel and became a lunge on the body that
acted, in the same resolution order off the same `turns` reading the log and
the flag strip share. A sprite whose bar drew a chunk is knocked back in the
slot after the lunge that took it. A KO'd sprite sinks through the swap
beat's own `sprite-sink` keyframes and a static `data-fainted` rule holds it
down until the replacement rises. Every length is a `calc` over one new token,
`--motion-beat`, which is `--motion-duration` over four, so the four slots end
exactly where the HP shadow's fade does and the hardcoded-duration pin stayed
at **17**.

| slot | beat | element | attribute | delay | length |
|---|---|---|---|---|---|
| 1 | lunge, first actor | `.stage__actor` | `data-acted="1"` | 0 | D/4 |
| 2 | hit, its target | `.sprite` | `data-hit="1"` | D/4 | D/4 |
| 3 | lunge, second actor | `.stage__actor` | `data-acted="2"` | D/2 | D/4 |
| 4 | hit, its target | `.sprite` | `data-hit="2"` | 3D/4 | D/4 |
| — | faint | `.sprite` | `data-fainting` | its hit's slot | the rest of D |

`scene.ts`'s `beats` reads `action.side` off the turn and the chunk boolean
off the bar, and nothing else. `test/boundaries.test.ts` now holds that the
scene never reads `.flags` or `.residual`, and `test/battle-feedback.test.ts`
holds that a super effective hit and a resisted one produce byte-identical
actor attributes: **the hit is the same size for every hit**, because the
chunk already says how big it was and a recoil that grew with the multiplier
would be a verdict drawn on the board.

### Superseded: the panel nudge. Dated 2026-09-15

Release C item 2's rule was "the acting side jiggles first, then the other".
What it built moved `.panel`, because the panel was the only thing on the
board that stood for a side. Since V5.3 the panel is a scrim over a body, and
V5.5 moved the swap beat onto the body on the argument that two animations for
one event is noise. This patch applies the same argument to the nudge. **The
rule is deleted, not flagged**: `.panel[data-jiggle]`, `panel-nudge`,
`--motion-jiggle`, `--jiggle-distance` and their reduced-motion override are
gone from the tree, `test/battle-stage.test.ts` holds that no panel carries
the marker, and the register row names the sprite lunge as what superseded
it. The prompt file records what was asked; this note records what replaced
it and why.

### Three things worth knowing about the shipped shape

- **A KO'd body now stays down.** Until this patch a fainted sprite stood at
  full opacity until its replacement rose. It now sinks on the update the
  faint arrives and is held at the sink's end state by `data-fainted`, which
  `scene.ts` mirrors from the projection every update. This is a visible
  change on the end-of-battle frame. Under reduced motion the body is down
  without having moved; a tap that cuts the sink short lands it in the same
  place. When the replacement arrives the ghost is left empty rather than
  given the fainted body, so a KO is never sunk twice.
- **A faint with no hit starts at delay 0.** A residual KO on a body already
  under `MIN_CHUNK` — poison on the last hit point — draws no chunk, so no
  hit, so no slot; the sink runs from the start of the budget. Accepted, and
  rare enough not to warrant a fifth attribute.
- **The V5 "no animation at all" assertion was retired, not loosened.**
  `test/visual-v5.test.ts`'s swapless-turn case asserted every sprite's
  `animationName` was `none`, which was the same claim as "no swap animation"
  until the hit beat existed. It now asserts what V5 promised — neither
  `sprite-rise` nor `sprite-sink` runs and the swap marker is unset — with a
  comment saying why the wording changed.

### Gates

Lint, `tsc --noEmit`, the full suite (119 files, 1579 tests, every one
passing; the one "unhandled error" is the vitest reporter's `onTaskUpdate`
timeout that section 15 already records against both suite runs), `npm run
build`, `npm run smoke` at 390x844 on `SMOKE24`, and
`scripts/visual/measure.mjs --compare` equal to the pixel in all three
density modes and both move bar layouts. Strict trim: **green**, 119 files
and 1579 tests under `GYMRUN_TRIM_STRICT=1`, which open item 8 records as red
with 22 failures on `9296ba7` — its count is stale on this tree, and the
report says so without closing the item.

## 18. The map overlay, and why the overlay allowlist got shorter

Filed prompt: [`spec/gymrun-patch-map-drawer-window-overlays.md`](spec/gymrun-patch-map-drawer-window-overlays.md),
committed 2026-09-15 before any work, on `claude/hopeful-curie-5ah94f`.

Presentation only. No `core/` change and **no version axis moves** —
`contentHash`, `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all
stand, no draw moves, no decision is added or reshaped, and seeded output is
byte-identical. `scripts/visual/measure.mjs --compare` reports the guarded
screen heights equal to `visual/baseline/heights.json` **to the pixel**, which
is the measurement that says the overlays stayed out of the flow.

### The rule this finished

§12 records the standing rule the party drawer implements: any screen that asks
the player for a decision must expose run state without leaving the decision.
Only half of it was ever built. The route was visible on exactly one screen,
so a player in a shop could not see whether a rest was two steps ahead, and a
player in a battle could not see whether the next step was another fight.

The overlay closes that. It renders nothing of its own: `renderRail`,
`renderHeading` and `renderChain` are exported from `ui/screens/run-map.ts` and
called, so the overlay **cannot** reveal a fact the map screen does not already
reveal. The reveal rules in `CLAUDE.md` hold by construction rather than by
care, and there is no second implementation for them to drift between.

`renderChain` is called with no `onChoose`. That was already supported before
this patch — `renderNode` computed `interactive = Boolean(onChoose)` and
attached a handler only when one was passed — so a read-only chain cost one
optional parameter, and every node in the overlay is structurally unpressable.
The map screen stays the single path by which a node is chosen.

### Deviation from the prompt: the scope of "both"

The brief says the window geometry is "the better design for **both**", naming
the party drawer and the map overlay. Three bottom sheets were in play once the
map one landed, and the third — V5.2's battle history — is converted too.

Recorded here rather than by editing the prompt, per protocol 4. The reasoning
is in the prompt file under its verbatim text, as one of three questions asked
and answered before any code.

### The allowlist got shorter while the app gained an overlay

`test/band.test.ts` holds a rule worth keeping: **no screen builds its own
overlay**, enforced as a grep-backed allowlist that "grows one deliberate line
at a time". Before this patch it named five files, two of them `drawer.ts` and
`log-sheet.ts`, each of which hand-built a dialog from the same recipe.

They had drifted, in three places nobody had noticed because nothing compared
them: the history sheet had no Escape handler and no click-stop on its sheet,
and the drawer mirrored its open state in a `let open` flag that could disagree
with the DOM. A third hand-copy would have picked one of each pair at random.

`ui/overlay.ts` is the extracted shell. The two overlays call it, `ui/map-drawer.ts`
is a third caller, and **the allowlist went from five entries to four while the
app went from two overlays to three**. That is the shape the rule wants: a new
readout overlay should cost no line there, and a new line means somebody
hand-rolled a dialog again.

The drift is settled in the shell in favour of the better half of each pair,
and both overlays gained something neither had: focus returns to the control
that opened them. Both claimed `aria-modal` and neither restored focus, so a
keyboard user who closed the drawer landed at the top of the document rather
than on the button they were standing on.

### Superseded: the phone rule that capped the sheet at 90vh

`styles.css` carried `@media (max-width: 420px) { .drawer__sheet { max-height:
90vh } }`, so that the sheet took more of a phone viewport "but never all of
it: the strip of the screen underneath is what says this is an overlay".

**The rule is retired and its reasoning is kept.** The window states it
structurally instead — `.overlay` pads every edge, `.overlay__sheet` is capped
at 100% of what is left — so the strip is on four sides rather than one and no
viewport rule can override it away. Measured at 390x844 the window is 366x820
inside a 12px gutter, against the sheet's 760px: more room, not less.

### Where the trigger is, and where it is not

Left of Party in the same bar. The bar is right-aligned, so appending Map
*after* Party would have pushed Party off the edge it has held since 4.7;
moving a control the player already knows costs more than the new one landing
beside it.

`MAP_SURFACES` is `DRAWER_SURFACES` less two. **`map`**, because the trigger
would open a window onto the screen underneath it. **`locale`**, because no
route is committed until a locale is picked — `stepsOf(state)` is empty there
and the chain would be a single gym row, which reads as a broken promise on the
one screen where the player is choosing between routes.

### What it deliberately does not carry

The party block and the wallet, which the map *screen* has and this does not:
the party drawer is one tap away in the same bar and already shows them, and
two readouts of one fact is two places for it to drift. The settings pickers,
which belong on the surface reachable from everywhere. And no tutorial marks —
the map screen's own marks already teach the chain, the kinds, the tier and the
gate, and a second set over the same content is a second thing to keep in
agreement.

## 19. Carry on did nothing: the stale item plan, and the catch that hid it

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
## 20. Sprites on every selection surface, an idle bob, and one motion per locale

Filed prompt: [`spec/gymrun-patch-idle-sprites-and-locale-motion.md`](spec/gymrun-patch-idle-sprites-and-locale-motion.md),
committed 2026-09-15 before any work, on `claude/vibrant-euler-2taoqk`, with
the plan the brief asked for and the three decisions taken before it was
finalised.

Presentation only, with one addition to `core/`: a pure helper,
`capabilityHolders`, in `src/core/capabilities.ts`. **No version axis
moves** — `contentHash`, `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and
`AI_VERSION` all stand, no draw moves, no decision is added or reshaped, and
seeded output is byte-identical. `scripts/visual/measure.mjs --compare` reports
the guarded screen heights equal to `visual/baseline/heights.json` **to the
pixel**, and the Pocket gate holds on every decision surface.

### What was built

**The figure.** `spriteFigure` in `src/ui/sprites.ts` wraps the one sprite
image in a `span.figure` that bobs on two held frames, `steps(1, end)` over
`--motion-idle`, with a negative delay from the slot so six bodies on one
screen start at six points of the loop. The figure is absolutely positioned in
its host's corner, so it costs the card nothing in the flow and the Pocket
gate holds by construction. It is mounted on the starter cards, the learn-move
owner line, the member card (party, drawer, pre-gym), the recipient buttons,
the capture block's offered and existing cards, the battle bench, and the run
summary. The battle stage's two actors carry none, by the second decision in
the prompt file: the beats own `transform` and `animation` on those sprites
and `test/sprites.test.ts` holds that no figure ever appears under an actor.

**Who answers a gate.** `resolveCapability` returned the band and nothing
else. `capabilityHolders` returns the members whose type answers, in slot
order, and `resolveCapability` now reads its length, so the band and the
list cannot disagree. The event screen shows the holders as figures beside
the band chip at `latent` only: a fact about the party as it stands, in the
party's order and never sorted, which is the attribute-not-verdict line
`CLAUDE.md` draws. At `known` the relic is the answer and at `none` there is
nobody, so no figures.

**One motion per locale.** `SceneArt` in `src/ui/theme/scenes/index.ts`
gains `motion: { kind, at? }` over eight kinds, one `@keyframes world-<kind>`
each in `styles.css`, chosen by `data-motion` on the one `.world__drift`
element. The cave keeps V3's crossing unchanged, by the first decision. The
shore laps, the forest's fireflies float by blinking, the city's windows
flicker, the badlands smoke, the summit's bird soars right to left on two
wing frames, the ruins' light hovers, the marsh ripples. All inline SVG in
the locale's two legal fills, transform and opacity only, and still not
mounted at all under reduced motion.

### Deviation: the plan's "20 seconds or longer" is restated by kind

**Recorded 2026-09-15. Protocol 4 — [`spec/README.md`](spec/README.md) — a
prompt is not edited to match what was built, so the deviation is written
here instead.** The document is the visual identity plan,
[`spec/gymrun-visual-identity-plan.md`](spec/gymrun-visual-identity-plan.md),
V3's sentence: "One drifting element per locale as a CSS keyframe loop ...
Loop is 20 seconds or longer and never draws the eye toward any UI element."
`test/visual-v3.test.ts` held the number.

**What the plan asked.** One number for every place, because every place
had the same motion: a crossing, where loop length is crossing speed and a
faster crossing is what draws the eye.

**What was built.** Two floors, keyed on the kind. The three kinds that
travel — the cave's spark, the summit's bird, the forest's fireflies — keep
the plan's floor: twenty seconds or longer a crossing (32, 40 and 26). The
five that stay put move nothing across the frame, so length is not what
protects the sentence's second clause; amplitude is. Their element's loop,
where it has one, is four seconds or longer; every mote's loop is two seconds
or longer; opacity never passes 0.6 on a blinking mote; and the element sits
on the ground or the sky, never on the content column. The test reads every
`animationDuration` under the element on all eight locales, by re-tagging
`html[data-locale]` the way `scripts/visual/perf.mjs` walks them.

**Why.** The sentence's reason survives; its number was specific to the one
motion V3 had. A foam line that took twenty seconds to lap would not read as
water, and a window that took twenty seconds to flicker would not read as a
window. The proxy trace (`visual/reports/v3-perf.json`, re-run over all
eight) reads under 6.3 ms of frame work at p95 on the busiest locale, which
is now the city rather than the forest, and `busiest` was re-read from the
eight traces rather than left where V3 found it.

### Not a deviation: the bench

The plan made the bench conditional on the battle height holding. It held to
the pixel, in all three densities, so the bench keeps its figure.

### The one thing the measurement caught

The map's HUD cards wear `.party__member` too, and the header gutter that
keeps a wrapped type chip from sitting under the figure re-wrapped their
heads and moved the pinned map height by 26 px in Detailed and Simple. The
gutter is now on `.party__member:has(> .figure)` and the map is back to the
pixel. `measure.mjs --compare` is the instrument that saw it; the Pocket gate
did not, because Pocket has no gutter.

### Animated GIF sprites: investigated, not built

The third decision in the prompt file. What `@pkmn/img` needs to return a
`gen5ani` URL through the adaptable entry, what the GIFs weigh, where
coverage fails, and why reduced motion has to be decided at URL time are in
[`engine-notes.md`](engine-notes.md), under "Animated sprites through
`@pkmn/img`: what it would take".

## 21. Stage 4.9: levels, evolution, gated power, the wider roster, harder gyms

Prompt: [`spec/gymrun-stage4.9-levels-and-evolution.md`](spec/gymrun-stage4.9-levels-and-evolution.md),
a planning conversation filed verbatim. Branch `claude/charming-ride-q4ogfb`.
This section is the account of what was built; where it deviates from the
prompt the deviation is dated here and the prompt is untouched.

### What is drawn, and what is not

**Evolution draws nothing.** A gym clear moves the party's level
(`levelParty`, unchanged) and then, from this stage, its species
(`core/evolution.ts` `evolveParty`): every member whose species has a target
at or below the new level becomes it, the whole chain if two thresholds were
crossed, and where the dex forks the player chooses. A level-up is a function
of segment index, an evolution is a function of species and level, and a
branch is a decision. Player decisions consume no RNG, so no key was added to
`core/streamKeys.ts` and a party that evolved and one that did not have
identical draw counts on every stream. `test/evolution-run.test.ts` holds it
as a measurement: two runs answering the same fork differently generate the
same map, node for node.

**One new draw per opponent, in front of the species draw.** Species bands are
a distribution per segment now (`speciesBandWeights`), the shape
`moveBandWeights` has had since 4.6b and for the same reason: a window is a
staircase and a distribution is a slope. `rollSpec` draws the band, then a
species inside it, then level, ability, moves, gender, berry. The band draw
is spent whether or not the pick then has to widen, so the count is a function
of the table and never of what a team already holds.

**Three filters inside the band, none of which draws.** The stage gate
(`data/evolution.ts` `stageAllowedAt`, against the *lowest* level the
encounter can roll, so every level in the range is legal and the draw order
holds); the kind's own filter (a wild node's locale types, a gym's type and
lists); and the blacklist, at draw time as before. A band emptied by all three
folds its weight into the next band down. Band 0 has a base form of every
type (`test/evolution-data.test.ts`), so a type-narrowed draw always lands.

**Teams draw without repeats.** `rollSpec` takes the team so far and skips a
species already on it, widening to the neighbouring bands before it would ever
repeat — the `generateStarters` rule applied to every team. The roster report
in the prompt's second ruling measured the reason: a six-member Dragon gym
drawn with replacement from fifteen species repeated a species 68% of the time.

### The data

**The pool admits `Past` species: 635 to 900.** `scripts/gen-pools.ts` had
excluded every species the gen 9 dex marks `Past`, on the argument that
their data was another generation's. The argument was wrong for this game: a
`Past` species is one Scarlet/Violet does not ship, not one whose gen 9 base
stats and types are missing, and GYMRUN runs Custom Game and validates
nothing. The exclusion had cost the low-tier base forms a level-7 start is
made of — Pidgey, Caterpie, Rattata, Spearow — and left the segment-0 Rock
gym drawing from six species. `Future`, `CAP`, `Custom`, `LGPE`, every forme
and every tagged legendary stay out. One admitted species could not be built
by the damage calc's gen 9 table — Aegislash, present only as its formes —
and is blacklisted with that reason; `test/evolution-data.test.ts` now builds
every drawable species in the calc so the next one is caught at the table.

**The evolution graph is child-side on the generated table.** Each entry
carries `prevo` (the pool id it evolves from, or null) and `evoLevel` (the
level it becomes a legal stage at, or null for a base form). Targets are
derived once by inverting `prevo` in dex order (`data/evolution.ts`), which
gives a branch the stable index the run log records. A child whose parent is
a forme outside the pool (Obstagoon, Perrserker, Clodsire and seven more)
keeps its `evoLevel` and is nobody's target: it can still be drawn at its
level, and it is never a starter.

**Synthetic thresholds, Kaizo style** (`data/evolutionThresholds.ts`). No
typed evolution in the gen 9 dex carries a level, so every trade, stone,
friendship, held-item, known-move and "other" evolution gets one from a
table: trade 36, stone 30, friendship 16, known move 32, held item 35, the
rest 30; Emerald Kaizo's Golem 42, Machamp 50, Gengar 50 and Alakazam 55 as
named overrides. Three rules hold it, each a test: a **floor by band** (20,
36, 50 for bands 2, 3, 4), so a synthetic-method final form is gated like a
dex one of the same weight — Kingambit and Archaludon at 50, the eight
Eeveelutions at 36; **monotone chains**, a child never below its parent,
which is why friendship is 16 (Azumarill's real 18 sits under Marill);
**siblings agree**, every branch of a family at one level, or the branch that
qualifies first fires alone and the choice is never asked (Politoed and
Poliwrath 37, Slowking 37 beside Slowbro's real 37, Gallade 30 beside
Gardevoir, Froslass 42 beside Glalie). A real dex level is never raised.
Three lines end one stage short because their real level is above the run's
last: Hydreigon 64, Volcarona 59, Dragapult 60. The user accepted that.

### The decision

`evolve`, an index into a fork's options in dex order, asked after the
level-up and before the gym's own questions, once per branching step in party
order then chain order. `pendingEvolutionQuestion` is the one definition of
"does the player get asked", shared by `playRun` and `resolveNode`, the
`isTargeted` discipline. Single-target steps ask nothing, so a party that
never reaches a fork writes the log it did. `RUN_LOG_VERSION` moves to `-16`.
`ui/storage.ts` learned the kind in the same commit (open item 15's trap).
The result screen carries the block between the party and the cards: the
records a clear applies, and the fork's option cards — sprite, species,
types, the six stats at the member's level, dex order, no marker.

### The curve, the rosters, the AI

`playerLevel` was 7, 14, 20, 27, 33, 40, 47, 55, each clear sized to cross a
threshold cluster (**the band recut moved it to 15, 20, 26, 32, 38, 44, 50, 58 —
section 33**); wild a fifth to a third below, trainer a sixth to a
quarter below, gym at or above (0..+1 to +2..+4). `TIER_MODIFIERS.level`
became `levelShare`, a fraction of the player's level, because `-3` at level
7 was 43% of it. A gym fields the player's slot count (2, 3, 3, 4, 4, 5, 5,
6); the schedule itself moved from `[3,3,4,4,5,5,6,6,6]` to
`[2,3,3,4,4,5,5,6,6]`. Wild plays the easy AI, an ordinary trainer the
medium, `hard` and `elite` trainers and every gym the hard; the profiles are
untouched, so `AI_VERSION` holds. Starters are band-0 base forms with an
evolution and at least 280 base stat total.

### Superseded, 2026-09-15

- **"There is no evolution: a species is fixed from the moment it is
  generated"** (`data/items.ts`). Deleted. Eviolite's text is true now.
- **"Fully evolved, roughly 490+"** as the starter window (`data/starters.ts`).
  Inverted: the measliest base form that goes somewhere.
- **"Every step up in team size is paid for with a step down in level"** for
  gyms (`data/scaling.ts` header, `TIER_MODIFIERS.elite`). Deleted for gyms;
  elite's level discount deleted too, because under the stage gate a level
  discount is a species discount (an elite at 33 cannot field a form that
  evolves at 36 while the hard node beside it can) and `test/tiers.test.ts`
  measured elite at 99% of hard's power.
- **`isNonstandard === null`** as the pool cut (`scripts/gen-pools.ts`).
- **The gym `teamSize` override** (`data/gyms.ts`). Never set; deleted.
- **The "+13 levels at gym 8" finding** (section 4 of `README.md`). Closed by
  construction: the gym column is positive.

### Deviations from the plan, dated 2026-09-15

- **The gym species-band bonus was built and deleted inside the stage.** The
  plan gave the gym one species band up, the twin of `GYM_MOVE_BAND_BONUS`.
  The first sweep killed it: 92.5% of deaths at gym 1, an 11% clear rate, a
  Relicanth at level 8 against a band-0 starter. Deleted, not zeroed.
- **The gym move-band spike starts at segment 2** (`GYM_MOVE_BAND_BONUS_FROM_SEGMENT`).
  With it from segment 0, 82% of deaths were at gym 1 to Rock Slide, Ancient
  Power and Rock Tomb — band-2 moves against twenty-HP base forms. The gym
  clear's *reward* still pays one band up from gym 1.
- **A starter floor of 280 base stats.** Band 0 runs from 180; a Caterpie is a
  run that ends at the first trainer. (Derived at level 7; the band recut moved
  the opening to 15 without re-deriving it — section 33.6.)
- **Content-dependent pins moved.** Two `visual-v5` move-grid tests read
  SMOKE24's first board and needed a marker and an unwrapped meta row; the new
  SMOKE24 opens with Fighting moves whose type chip wraps the meta row at
  390px. They read `GRID49-6` now. That wrap is a pre-existing limit of the
  move button, not this stage's. The map fold guard is likewise re-pinned to a
  seed that passes, and the pre-change build overflowed it on other seeds
  (988px on one), so the overflow — a two-row party plus a two-card step —
  is older than this stage and is carried as an open item.
- **Every seed the suite pins was rescanned, and the smoke bot's with them.**
  Under this curve the old seeds mostly died before the thing they pinned — a
  gym, an event that pays, a relic, a taught move, a capture offer on the
  result screen — so each test names a seed found by scanning with that
  test's own policy, and the gallery's result fixtures read `S49B-1`. The
  smoke bot (hardest move, never switches) loses gym 1 on most seeds; its
  seed was found by emulating it headlessly over the seed space and
  confirming the hit in the browser (`SMK49-2`). The greedy bot wins no run
  at all on 400 seeds, so the one test that needs a victory renders a played
  run with its outcome set, and says so.
- **Two presentation defects surfaced by the new seeds, fixed in place.** The
  reduced-motion block never cancelled the arriving sprite's rise: the rule
  it overrides is written with `:not(.sprite--ghost)`, which carries its
  argument's specificity, so the plain override lost and the body rose for
  anybody who had asked it not to; latent until a seed put a send-in on the
  measured turn. And the chip legibility sweep found no status chip on any
  seed this bot walks at level 7 — a status is a ten-percent rider on a
  band-1 move in a two-turn fight — so the sweep now also samples the
  gallery's loaded party, which carries two statused members by
  construction, rather than hunting a seed for the rider.
- **The gym move-band spike moved twice.** First built as planned (from
  segment 0, as `GYM_MOVE_BAND_BONUS` always was), then held until segment
  2; see above.

### What this moves

`RUN_LOG_VERSION` `-16`, `RANDOMIZER_VERSION` `-16`, `contentHash` by every
table above; `AI_VERSION` holds. The hash moved once more at the merge with
`main` after PR #38, from `5fb6be` to `08e9e6`, because the pointer in
`data/items.ts`'s comment was renumbered from section 20 to 21 and the hash
is over bytes; nothing generated changed, and the benchmark rows keep the
stamp they were measured under. Every seeded fixture re-minted: the visual
baseline runs and digest, `heights.json` (content moved, `decisionTop` did
not, in every mode), `test/fixtures/sim-report.json`, and the smoke bot's
loop bound raised to 900 for the longer runs.

### Gates

Type check, lint, build, the full suite (125 files, 1668 tests), the full
suite under `GYMRUN_TRIM_STRICT=1` (the same 1668, so nothing new consulted a
learnset — evolution reads the pokedex table, which the trim leaves alone),
and the smoke run on `SMK49-2`: all green at the stage's last commit, each
run alone rather than beside another suite, because two heavy runs at once
produce vitest worker timeouts that read as errors and are not.

### The benchmark

`docs/balance.md` section 0 carries the rows: the `randomizer-15` baseline
(4.92 mean gyms, 39.3% completion, gym 1 at 99.5%) and the stage's first pass.
**The first pass is far below the baseline by construction and by design**,
and the numbers are recorded rather than chased: the stage was asked for a
measly start, fierce gyms with a full roster from the first badge, and
opponents that evolve on the same clock the player does. Where the greedy
bot dies, and to what, is in the report; the levers that were *not* pulled
are the gym's level offset and the roster rule, both the user's call.
## 22. The battle animation run, Branch 1: the display split moved the hash once

Prompt: [`spec/gymrun-overnight-battle-animation.md`](spec/gymrun-overnight-battle-animation.md),
Branch 1. Branch `claude/busy-noether-jfszvi`, 2026-09-16.

### Deviation 1: `contentHash` moved, and the prompt said no axis would

**The prompt's standing rules say "No version axis moves in any of the three
branches", and its Branch 1 step 1 says to verify `npm run content-hash` prints
the same value before and after, with "if it moves, the split is wrong."**

It moved, from `53145f` to `b381d0`, and the split is not wrong. The check was
naive and this note is the correction.

`contentHash` is a glob over `src/data/**` minus the exclusion list, and
`tuning.ts` is in the hashed set. Taking three fields *out* of `tuning.ts`
changes that file's bytes, so it changes the hash — necessarily, and no
arrangement of the destination file avoids it. The check as written could never
have passed for any version of this work.

What the check should have asked, and what was verified instead:

1. **Generation did not move.** `test/fixtures/sim-report.json` regenerated
   byte-for-byte identical except its own `contentHash` line — every run
   record, every decision, every casualty across every fixture seed unchanged.
   That is the claim that matters and it is proved rather than argued.
2. **The number is free from here.** `battleFeedbackMs` at `900` and at `1234`
   both produce `b381d0`. The exclusion is doing its job.

**And the move was unavoidable regardless of the split**, which is the part
worth keeping: this branch exists to change `battleFeedbackMs` from 500, and
changing it *in place* would have moved the hash too — and moved it again on
every future retune. The split pays the cost once and makes this the last time a
display edit refuses a shared seed. A seed string minted before 2026-09-16 is
refused at paste time with the copy `data/seedCopy.ts` already carries.

Recorded here rather than by editing the prompt, per the Process rule.

### Deviation 2: `maxMoveTagsOnFace` could not come, and the filed item named it

Release C's recommendation, carried as morning decision 3 of
[`handoff/overnight-1-contenthash.md`](handoff/overnight-1-contenthash.md) and
marked **open, small** in section 9 above, names two fields: `battleFeedbackMs`
and `maxMoveTagsOnFace`. Only the first moved.

A file may be excluded from the hash only if nothing under `core/` imports it at
any depth — the rule in `build-config/content-hash.ts`, held by
`test/content-hash.test.ts`, which walks the import graph. `core/battle/view.ts`
reads `DEFAULT_TUNING.maxMoveTagsOnFace` for its `DEFAULT_MAX_MOVE_TAGS`. Moving
that field into `data/displayTuning.ts` would have made the new file a `core/`
dependency and disqualified the exclusion **for all four fields**, which is the
opposite of the point.

So the split is three fields, not two-plus-one: `battleFeedbackMs`,
`minChipFontSizePx` and `minChipContrastRatio` — the three no `core/` file
reads. `maxMoveTagsOnFace` stays on `Tuning`, stays hashed, and keeps the
sweepability its own comment argues for. The filed item is therefore **closed as
substantially done with one field named and declined**, not closed clean.

### Deviation 3: a stale claim in `tuning.ts`, corrected rather than moved

`maxMoveTagsOnFace`'s doc comment read "A display number, so it changes no seed
and enters no hash." The first half is true; **the second half was false when it
was written** — `tuning.ts` has been hashed whole since the `contentHash`
release — and it sat directly above the three fields this branch moved *because*
they enter the hash. Left alone it would have read as the reason the field
stayed behind.

Corrected in place to say the field is hashed, that editing it still refuses a
seed shared across the edit, and why it could not move. This is the same class
of failure open item 8 records: a stale statement in a file every session reads
is believed.

### Deviation 4: the shipped number is 750, reached by two rulings

The prompt's step 2 left the figure to the branch, "judged by watching", with a
suggested 900-1000. 900 was built and measured. Two rulings moved it:

1. **Do not ship an unwatched number.** Reverted to 500, keeping the split — the
   point of which is that the number is now free, so deferring it costs nothing.
2. **Shrink the lunge and take 750.** This is the one that found something the
   branch had missed: `actor-lunge` peaks at 40% of a beat and a beat is a
   quarter of the budget, so the whole lunge distance is spent in **10% of the
   budget** — 50ms at 500, three frames at 60Hz, near 3px a frame. That is a
   jump cut, not a fast lunge, and it is why the motion read as broken rather
   than as quick. **Raising the budget alone would not have fixed it**: 8px at
   750 is still ~2px a frame. Distance and duration had to move together.

So `--lunge-distance` is 6px (1.49px a frame, under the two-pixel jitter line
`--idle-rise` already draws), and `--hit-recoil` is now
`calc(var(--lunge-distance) / 2)` rather than a second literal — its comment has
always claimed "half the lunge" and that was a coincidence until this edit.

750 also divides better than 900: beat `0.1875s`, delays `0.375s` and
`0.5625s`, all exact binary fractions, so the browser's serialization and the
tests' `ms / 4000` arithmetic cannot disagree. The spot-check this section's
gates asked for at 900 cannot fail at 750.

The three trips — 500 to 900 to 500 to 750 — all left `contentHash` at
`b381d0`, which is the split working as designed rather than a claim about it.

### What Branch 1 did not change

No balance number. No `core/` file. `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and
`AI_VERSION` all stand still; `contentHash` is the only axis that moved and
deviation 1 is its account.

## 23. The battle animation run, Branch 3A: the one thing that waits

Prompt: [`spec/gymrun-overnight-battle-animation.md`](spec/gymrun-overnight-battle-animation.md),
Branch 3, half A. Branch `claude/busy-noether-jfszvi`, 2026-09-16.

### Superseded: "nothing waits for this"

`ui/theme/motion.ts` has said since Release C:

> **Why it is not a delay.** Nothing waits for this. The bar, the HP text, the
> flag words and the move buttons are all correct and interactive on the frame
> the update arrives, and a tap resolves every animation early. The number says
> how long the feedback *stays*, not how long the player is held.

**That rule is retired in one place and kept everywhere else.** The header now
reads "Why it is not a delay, with one exception" and names the seam. Recorded
here and rewritten there in the same commit, per the rule that a superseded rule
is deleted from the lineage rather than left behind a flag — and because a file
every session reads that asserts something the tree no longer does is the
failure open item 8 documents.

**What was wrong with it.** The rule is correct for a turn mid-fight, where the
next decision is the thing worth reaching and holding the player from it is a
cost with no benefit. It fails at the end of a fight, where there is no next
decision and the screen leaves before the feedback does. The observed symptom
was "a one-hit KO shows no animation", and that was a narrower description than
the defect: **the last turn of every fight was swallowed.** A 1HKO is the case
where the last turn is the only turn, so it was the one where nothing moved at
all and therefore the one that got reported.

The chain, unchanged except for the last line: `driver.ts` drains the final
protocol batch and calls `notify` synchronously -> `ui/screens/battle.ts` renders
-> `scene.ts` sets `data-fainting` and `data-hit`, `bar.ts` paints the chunk,
three CSS animations start -> the `while (!session.ended)` loop exits ->
`run.ts` awaits `policy.reviewBattle` -> `app.ts` **awaits the outro** before
`showScreen('result')`.

**Why exactly one seam.** `core/run.ts` calls `reviewBattle` for every battle
completion, won or lost, with cards or without, and its own doc says "It is one
path, not a second one." So one `await` covers gym, trainer, wild, victory and
defeat with no branch in `core/`, no new projection field, and no version axis
moved. Every other transition is untouched and still non-blocking.

**What the rule keeps.** The hold is skippable by tapping — the `pointerdown`
handler that already settles both actors now resolves the parked promise in the
same breath, because a gate that cannot be skipped is a stall. And it is zero
under reduced motion, through the stylesheet rather than through a `matchMedia`
branch: `scene.ts` reads `--motion-outro` to decide how long to park, the
reduced-motion block sets that token to `0ms`, and so the query re-answers
itself when the OS setting changes mid-session exactly as `motion.ts` argued it
must.

### Deviation: a browser helper's witness stopped being sufficient

`playATurn`, in `test/visual-release-c.test.ts` and lifted into
`test/visual-v5.test.ts`, plays turns until it finds one **the fight survived**,
so the assertions after it read a live battle rather than a stale one. Its
witness was "still on the battle screen, and the log grew", and its own header
already recorded two earlier debugging passes that made it that strict.

The gate invalidated it. A finished fight now stays on the battle screen, log
and all, for the whole of `--motion-outro` — which is the entire point — so the
two conditions together no longer separate a surviving turn from the turn that
ended the fight. Both files began asserting against a fight that was over: no
second lunge, and move buttons correctly dead.

The third condition is that the run has **asked for another choice**: an enabled
move button. A fight that is over has none, whether or not the result screen has
arrived, so that property outlives the gate in a way the other two did not. Both
helpers also now wait the hold out before looping, rather than racing it.

Recorded rather than quietly fixed because it is the shape of thing the next
animation patch will hit again: **a test that waits a fixed fraction of the
feedback budget and then reads the screen is making an assumption about what the
budget is for.**

### Deviation: the ball is not in `ui/theme/itemIcons.ts`, and its number was checked

The prompt said to put the spritenum in a UI-side constant rather than in the
generated icon table, and that stands: `scripts/gen-item-icons.ts` writes that
table from `data/items.ts` and `test/item-icons.test.ts` regenerates and diffs
it, so an entry with no item behind it would be deleted by the next run. A ball
is never held, offered, bought or stowed, and inventing one under `data/` to
draw a picture would put a thing the run does not have into the table the run
reads.

It lives in `ui/slots.ts` beside the one `Icons` instance, as a reserved
resolver key. **The number is 345, not the 4 a guess would have produced** — read
off `@pkmn/sim`'s `Dex.items.get('pokeball').spritenum`, as the prompt insisted,
because a wrong spritenum draws a different item and nothing fails.

The asset rule in `ui/theme/scenes/index.ts` — "No Pokemon, no Pokeball, no
landmark from anywhere" — **is not bent and not amended.** It governs scenery
authored into this repo. The ball is a cell of the Showdown item sheet the party
screen already draws every held item from, so nothing raster is added and the IP
posture is the one the sprite CDN rule set.

### What Branch 3A did not change

No `core/` file. No `data/` file. No balance number, no version axis —
`contentHash` is still `b381d0`. The abnormality vocabulary and its beats are
Branch 2 and Branch 3B, and neither is started.

## 24. The battle animation run, Branch 2: the abnormality vocabulary

Prompt: [`spec/gymrun-overnight-battle-animation.md`](spec/gymrun-overnight-battle-animation.md),
Branch 2. Branch `claude/busy-noether-jfszvi`, 2026-09-16. Evidence:
[`reports/battle-anim-2-protocol-census.md`](reports/battle-anim-2-protocol-census.md).

`FlagKind` goes from ten to seventeen: `prevented`, `failed`, `boost`,
`unboost`, `ability`, `volatile`, `field`.

### Deviation 1: the words are in `data/flagWords.ts`, and the plan said not to

**The plan said new copy goes in `src/ui/copy/`, never under `src/data/`.** That
rule is right about its own reason — `contentHash` globs `src/data/**` minus an
exclusion list, so a *new* table there is hashed by default and moves every seed
until somebody remembers to exclude it. It is wrong about this case, for two
reasons that only became visible with the code in front of it.

**`flagWords.ts` is already on the exclusion list.** Adding a word to a file
that is already excluded moves nothing; the hazard is creating a new file, not
extending an old one. Verified: `npm run content-hash` reads `b381d0` before and
after.

**And `FLAG_WORDS` and `FLAG_BLURBS` are `Record<FlagKind, string>` — total
records.** Widening the union produced exactly two compile errors, one per
table, and neither could be satisfied anywhere else. Splitting half the flag
vocabulary into `ui/copy/` would have meant either making those records partial,
which destroys the one mechanism guaranteeing every kind has a word and a
tooltip, or keeping two files that must be read together to answer "what is this
flag called". Both are worse than the wart.

So the wart is not widened and it is not fixed either; it is left exactly as
large as it was. Moving `flagWords.ts` wholesale to `ui/copy/` is still the right
eventual answer and is still not this patch's.

### Deviation 2: two classes were cut and one narrowed, on evidence

The census (699 battles) is the authority here, not the plan's guesses:

- **Damage shape: cut.** `-recoil`, `-drain` and `-hitcount` appear **not once**.
  The plan had drafted words for all three.
- **Identity: deferred** at 2.9% of battles.
- **`-item`: deferred** at 2.1%, though its class (trait fired) is built. Below
  the identity class that was deferred, so including it would have been
  inconsistent — `-ability` at 39.9% carries that class on its own.
- **Volatiles: narrowed to `DISPLAYED_VOLATILES`.** The raw `-start` tail is
  `Charge` (4.7%), `Doom Desire` (2.9%), `Salt Cure` (2.1%), `Quark Drive` —
  engine bookkeeping and single moves with no word a player can act on. Filtering
  on the allowlist the panel already uses drops all of them, and takes the
  volatile flag from a noisy 45% to a meaningful 4.8%.

### Deviation 3: `settle()` now retracts on `failed` too

Not asked for. A move that failed did nothing, so it made no contact and got no
same-type bonus — the identical argument the function's own comment already
makes for a miss and an immunity. `CONTACT` under `Failed` is the same lie as
`CONTACT` under `MISSED`, and it would have shipped the day `failed` did.

### Two line shapes the census caught, which would have shipped wrong words

Both produce *plausible* output rather than an error, which is the kind that
survives review.

1. **Weather and terrain name themselves in the protocol's first field, not its
   third.** `|-weather|RainDance|[from] ability: Drizzle` — the third field is
   the `[from]` tag. Keying on it, as every other flag in this file does, yields
   "Rain [upkeep]".
2. **A weather line repeats every turn it is up.** `-weather|[upkeep]` is 6.1%
   of battles on its own; flagging it would put "Sandstorm" on the strip for
   every turn of a sandstorm, which reports the weather rather than the turn.
   Only a start is an event.

A field effect also has no Pokemon to be about, which every other flag assumes.
It is attributed to the engine's own `[of]` when the line carries one, and
otherwise to whoever just acted; a field effect with neither is dropped rather
than guessed at.

### What it does not change

`view.ts` is imported from and not modified: this branch adds **events**, not
projections. Stat stages, status and volatiles were already projected and drawn
as panel chips — present tense, what is true now — and what was missing is the
moment of change. No `RUN_LOG_VERSION` bump, because flags are derived every
render and never serialized. `ui/flag-strip.ts`, `ui/chip.ts` and
`ui/tooltips.ts` needed **no change at all**: the strip maps kinds generically
and the tooltip resolves `flag:<kind>` against the blurb table.

No version axis moved. `contentHash` is still `b381d0`.

## 25. The battle animation run, Branch 3B: the abnormality beats

Prompt: [`spec/gymrun-overnight-battle-animation.md`](spec/gymrun-overnight-battle-animation.md),
Branch 3, half B. Branch `claude/busy-noether-jfszvi`, 2026-09-16.

Five beats — `prevented`, `stage`, `trait`, `volatile`, `field` — one per class
rather than one per kind, riding the slot of the action that produced the flag.

### The defect the class was built for went one level deeper than expected

`prevented` was built first on the argument that a flinched turn is invisible by
construction: no damage, so no chunk, so no beat. **That turned out to be true
of the beat scheduler itself**, and the first build of Branch 3B reproduced the
bug it was fixing.

`beats()` picks the turn to animate with
`turns.reverse().find((turn) => turn.actions.length > 0)`. That is right for a
lunge and a hit, which are things an action did. But `|cant|` **replaces** the
`|move|` line rather than accompanying it, so `readTurns` produces no action for
a prevented turn at all and its flag lands in `residual`. Reading the beats off
that group marked nothing on exactly the turn that already leaves no other
trace. Caught by `test/battle-outro.test.ts`'s first two abnormality cases,
which is what they were written for.

**The fix was already in the tree.** `ui/flag-strip.ts`'s own `latest()` had
solved it — prefer the last group carrying flags, fall back to the last with
actions — so `beats()` mirrors that rule rather than inventing a second one. The
strip and the stage now answer "which turn is being shown" identically, which is
the property that keeps them from disagreeing about a turn. Generalised: **a
consumer that finds "the current turn" by looking for actions cannot see the
turns where nothing acted**, and those are the interesting ones.

### The beats are concurrent, and that is the design

A mark's `animation-delay` is the delay of the lunge or hit it accompanies, not
a slot after them. So an abnormality costs the turn **nothing**: a turn carrying
six takes exactly as long as a turn carrying none, and Release C's "total added
time per turn is one number" holds without amendment.

The alternative — a slot per abnormality — was declined in planning and the
census says why it would have hurt: 59.5% of battles carry a stat change and
45% a volatile, so serialising them would have lengthened most turns in the
game.

### One mark per actor per slot

A side whose slot carries several abnormalities takes the **first in protocol
order** and the strip carries the rest, which it already did. That is not a
ranking: `flags.ts` calls protocol order "the one ordering that is a fact rather
than an opinion", which is exactly what makes taking the first safe. Residual
flags ride the last slot rather than earning a fifth, because a fifth slot is
the added time the whole arrangement exists to avoid.

### Deviation: the scene may not read a flag, and the first build did

**The most useful thing that happened in this branch.** Branch 3B's first build
put the flag-to-class reduction inside `beats()`, in `ui/scene.ts`, with careful
comments promising not to rank anything. `test/boundaries.test.ts` refused it:

> **never reads a flag in the scene** — the stage's beats read `action.side` and
> the bar's chunk boolean, and nothing else. A beat that read `flags` would be
> one step from a recoil that grew with the multiplier, which is a verdict drawn
> on the board.

The rule is exactly right and the build was exactly wrong. Every comment that
first version wrote — "none has more weight than another", "not a ranking" — is
the kind of promise this rule exists to replace with a guarantee. A scene that
*can* see severity is one edit from showing it, and the edit would look
reasonable.

So the reduction moved to a new `src/ui/abnormality.ts`, a pure function from
`FlaggedTurn[]` to at most one `{ side, klass, slot }` per side, and the scene is
**handed** the result. It cannot weight a beat by severity because it never sees
severity — true by construction rather than by care, which is the standard the
rest of the battle UI is already held to.

This also satisfies the sibling rule the same file states, that the scene "may
name the shape; the moment it calls the reader it has become the second source
of truth". `ui/screens/battle.ts` still reads the protocol exactly once and now
hands the result to **three** consumers — the log, the strip, and the marks —
rather than two.

The restructure is strictly better than what it replaced: the reducer is pure
and unit-tested without a DOM (`test/abnormality.test.ts`, 9 cases), the scene
is write-only for marks, and the seam is covered from both sides.

### The marks are on their own element, and that was forced

`.sprite:not(.sprite--ghost)` already carries four animation rules — the hit,
the faint, the swap and the recall — and a fifth would cancel one of them; the
faint's comment documents managing that collision by rule order already. So the
beats live on `.stage__mark`, following `.stage__ball` from 3A. That also buys
the concurrency: a mark and a hit can run at once because they are two elements.

### Identity without weight, which is the rule the patch turns on

The five classes share duration, size, travel and opacity curve, and differ only
in shape: `prevented` closes and stops, `stage` shifts on an axis, `trait`
pulses, `volatile` settles and holds, `field` sweeps. None is larger, longer or
brighter than another, and the mark is drawn in the stage's own ink rather than
a hue — a colour would rank one class against another the moment a second
colour appeared beside it.

**`boost` and `unboost` share one beat.** Which way a stat went is a word on the
strip and a chip on the panel; a beat that rose for one and fell for the other
would be the board taking a view on which is better. Same argument
`--hit-recoil`'s comment makes for not scaling a recoil with the multiplier.

### What smoke cannot catch, again

A transform contributes to scrollable overflow and `.stage` cannot clip, so a
mark reaching past the actor's box would widen the document on a 390px phone.
`scripts/smoke.mjs` never produces an abnormality beat, so it cannot see this —
the same blind spot Branch 3A found with the recall.
`test/visual-battle-outro.test.ts` now plays until a real turn carries one and
asserts `scrollWidth` at that frame, and that the mark is actually animating
rather than merely marked.

### What it does not change

No `core/` file, no `data/` file, no version axis. `contentHash` is still
`b381d0`. The flag strip is untouched: it already listed every flag.
## 26. Stage 4.9 merged into the battle animation run

Branch `claude/busy-noether-jfszvi`, 2026-09-16. Stage 4.9 (section 21) reached
`main` while the animation run (sections 22 to 25) was in flight, so it was
merged in rather than the other way round.

### The two features compose with no code change

`core/run.ts` calls `chooseEvolution` **after** `reviewBattle`, so a gym clear
now runs: the fight ends → the outro plays → the result screen → the evolution
fork. That is the order it should be in, and it falls out of where each hook
already sat. The only edit `app.ts` needed was the one the merge itself forced —
`reviewBattle` was a plain arrow on main and an `async` one here, so the merged
body awaits the outro first and then runs Stage 4.9's evolution preview.

### `contentHash` is a fourth value, and generation still did not move

| | value |
|---|---|
| fork point | `53145f` |
| this branch alone | `b381d0` |
| `main` alone | `08e9e6b` |
| **merged** | **`c3964b`** |

Main changed the data tables; this branch removed three fields from `tuning.ts`.
Neither pin could survive, so it was recomputed rather than guessed.

**The proof that this branch is still presentation-only survived the merge, and
is now much stronger.** `test/fixtures/sim-report.json` and the six baseline run
records were regenerated on the merged tree and diffed against main's:

```
$ diff main-fixture.json test/fixtures/sim-report.json | grep -E '^[<>]' | grep -vc contentHash
0
$ diff -r mainbase freshbase | grep -E '^[<>]' | grep -v contentHash
< 08e9e6b2…   > c3964b9b…          # data-digest.txt, which is the bare hash
```

Zero non-hash lines in the fixture, and the only two in the baseline are the
digest file's own value. Every party, node, decision, casualty and protocol
across six seeds is byte identical to main's — **under Stage 4.9's new curve and
roster**, which is a far larger surface than the pre-merge proof covered.

### Deviation: main found a specificity bug, and this branch had the same shape

Stage 4.9 fixed a reduced-motion rule that had never worked:
`.stage__actor[data-swapped='true'] .sprite` never outranked
`… .sprite:not(.sprite--ghost)`, because `:not()` carries its argument's
specificity — so the arriving body still rose for anyone who had asked it not
to. Latent until a Stage 4.9 seed put a send-in on the measured turn.

Prompted by that, this branch's own cancellations were re-checked. The outro
rules were sound: each names the live selector exactly. **The abnormality rule
was not, quite.** `[data-abnormal]` and `[data-abnormal="stage"]` have identical
specificity, so the bare form did cancel the five class rules — but only because
the media block sits later in the file. That is a guarantee that stops holding
the moment someone moves a block, which is precisely how main's bug survived.

The cancellation now names every live rule, including the slot delay. True by
construction rather than by ordering.

### A load-sensitive browser test, and this branch makes the load slightly worse

`test/visual-phone-seed-bar.test.ts` failed twice during the merge gates,
asserting `documentElement.scrollWidth === 390` on the starter screen and
getting **393 once and 401 the next time**. It passes in isolation, passes
alongside two other visual files, and the full suite then passed clean on the
same tree. A value that moves between runs is a timing race, not a layout
defect.

The mechanism is in `test/visual/harness.ts`: **`openHarness` runs its own Vite
build and launches its own Chromium, once per test file**, and nothing caps
vitest's file concurrency. A full visual run is therefore ~22 simultaneous
builds and browsers, and under that pressure a screen can be measured before its
pixel face has settled — the same contention class recorded in
`handoff/battle-anim-1-timing.md`, where unrelated files timed out at ~670s and
looked like assertion failures.

**This branch adds the 22nd such file** (`test/visual-battle-outro.test.ts`),
main having 21, so it raises peak load by roughly a twentieth. The fragility is
the harness's and predates this work; the extra file is this branch's. Left as
it is rather than folded into a neighbouring file, because one browser test per
concern is the right shape and the real fix is a concurrency cap on the visual
suite — which is a change to shared config and not this branch's to make.
Recorded so the next red suite is read with the durations and the file count in
view before anybody hunts a layout bug that is not there.

### Docs

Main took section 21, so the animation run's four sections moved from 21–24 to
**22–25**, and a dozen cross-references in six files moved with them.
`test/boundaries.test.ts` verifies that documented *paths* resolve; it cannot
see a wrong section *number*, so those were checked by grep.

## 27. The iOS animations patch: a second engine, and what Bug B was not

Prompt: [`spec/gymrun-patch-ios-animations-webkit-harness.md`](spec/gymrun-patch-ios-animations-webkit-harness.md).
Branch `claude/awesome-noether-h6p8fj`, 2026-09-16, on top of PR #40 (`284c66f`).
Report: [`visual/reports/patch-ios-animations.md`](visual/reports/patch-ios-animations.md).

Presentation and test infrastructure only. No `core/` change, no version axis
moved, `contentHash` unmoved at `c3964b`.

### Deviation 1: Bug B was not any of its five candidates, and is not reproducible on Linux WebKit

**The prompt states Bug B as fact** — "the CSS motion system has never run on
iOS", "the switch-out animation shipped broken at V5.5 and has never worked on
mobile" — and asks which of five causes it is. It instructs: "do not change CSS
until a reproduction tells you which one it is."

There is no reproduction. Against Playwright WebKit 26.6 on an iPhone 14 Pro Max
descriptor, **every animated class on the battle stage starts and moves**, the
V5.5 switch-out included. `test/visual-motion.test.ts` asserts this for all
twelve, by observed motion rather than by wiring, and it passes on both engines.

So the instruction was followed to its actual conclusion: no CSS was changed for
Bug B, because nothing told it which cause to change it for. The five candidates
were each ruled out by direct experiment rather than by the absence of a
failure — the evidence is in the report's section 4, and in summary:

1. **A custom property inside a keyframe.** Ruled out twice. A seven-case
   isolation page — two-factor, three-factor, fractional, two-argument
   `translate`, a `var()` whose own value is a `calc()`, a parenthesised group,
   and a literal control — interpolates identically on both engines. And the
   shipped `actor-lunge`, which is the most `var()`-dependent keyframe in the
   file, reaches 5.95px of its 6px peak on WebKit in the built app.
2. **A non-animatable `display` or layout type.** Ruled out: `display: inline`
   and `display: table-cell` both animate on WebKit. The actor is
   `display: block; position: absolute` in any case.
3. **A class added and removed inside one frame.** Ruled out in the app, and
   **the code was already right**: `beats()` deletes both attributes, forces a
   reflow with `void actors.me.root.offsetWidth`, and re-sets them, with a
   comment saying why. A real engine difference was found next door — WebKit
   begins an attribute-triggered animation roughly a frame later than Chromium —
   but it is a latency, not a failure, and the only thing it broke was this
   patch's own first instrument.
4. **Compositing and layer promotion.** Ruled out: a box inside a
   `backdrop-filter` parent, which is the exact shape of the stage, animates on
   WebKit.
5. **Shorthand or prefix parsing.** Ruled out for every motion rule — all twelve
   keyframes start — and **confirmed for the one property item 4 is about**.
   `backdrop-filter` is the only unprefixed modern property on the battle stage,
   and Safari carried it behind `-webkit-` until Safari 18.

**What does reproduce the reported symptom, exactly, is Reduce Motion**, and it
is the finding this patch turns on. With `prefers-reduced-motion: reduce`
emulated, on **both** engines: zero animations start, and `--motion-outro`
resolves to `0ms`, so the result screen arrives on the frame the KO lands and
the last turn of every fight is swallowed. That is "the animations do not render
at all" and "the last turn is missing", together, from one OS setting.

It also explains the shape of the report in a way an engine bug does not. The
reporter saw it work in desktop Chrome and fail on an iPhone in *both* Safari
and Chrome — and read that as "same engine, one platform". The same evidence
fits "same *operating system*, one accessibility setting" at least as well:
Reduce Motion is a system toggle both iOS browsers honour and neither desktop
Chrome nor this repo's test suite ever had on.

**This is not proof that the reporter had Reduce Motion on**, and the report says
so. It is the only configuration that reproduces the reported symptom on the
engine in question, and the fix for it was already item 5 of the same prompt.

**What is honestly outside reach here** is recorded rather than papered over:
Playwright's WebKit on Linux is not iOS Safari. It shares the engine and not the
graphics stack, and three things a real device has are not modelled at all — the
iOS compositor, Low Power Mode (which throttles and suspends CSS animation), and
any Safari older than the bundled 26.6. The `backdrop-filter` prefix is fixed on
the documented support history rather than on a measurement for exactly that
reason, and it is labelled as such.

### Deviation 2: the reduced-motion number is in `displayTuning.ts`, not `tuning.ts`

The prompt says the hold and its reduced value are tuning numbers in
`data/tuning.ts`. They are in `data/displayTuning.ts` instead, and the prompt's
own standing rule is why: `tuning.ts` is inside the `contentHash` glob, so a
field added there moves the hash — which the same prompt forbids twice
("`contentHash` does not move", "Anything that moves `contentHash` or a version
axis" is out of scope). `displayTuning.ts` exists precisely because Branch 1 of
the animation run split the display numbers out for this reason. Verified: the
hash reads `c3964b` before and after.

The hold itself did not become a new number at all. It still derives from
`battleFeedbackMs`, so "a playtester saying battles feel slow stays a one-number
change" holds as the prompt asks. Only `reducedMotionOutroMs` is new, and its
comment argues why that one is *not* derived: it is a frame count, not a feel.

### Deviation 3: the engine axis is an environment variable, not a describe loop

The prompt says "parameterised, not forked. One test body, two engines." It is
parameterised — `GYMRUN_ENGINE` selects the engine inside `openHarness` and
`contextFor`, every test body is written once, and no file has an engine branch
in it except where an API genuinely differs. What it is not is a loop *inside*
one process: the two legs are two `vitest` runs, `npm run check` runs both, and
a WebKit failure fails the suite.

Two reasons, and the second is the real one. A `describe`-per-engine wrap would
have rebuilt the app twice per file and doubled the peak browser count on a
harness whose contention is already a recorded fragility (section 26). And the
22 files needed no structural edit, so the diff shows the four places behaviour
actually differs by engine instead of 22 indentation changes.

### Deviation 4: the device descriptor keeps the repo's width

The prompt asks for "a real device descriptor for the failing device rather than
a viewport width", and names the 390px window as not part of the reproduction.
`IPHONE` is Playwright's `iPhone 14 Pro Max` descriptor with **`viewport`
overridden back to 390x844**, and the three properties the prompt actually names
— touch, the Mobile Safari user agent, 3x device pixel ratio — are all carried.

The width is the one thing held back, because it is load-bearing elsewhere:
`docs/visual/baseline/heights.json`, every entry under `docs/visual/baseline/`,
`scripts/smoke.mjs` and all 22 test files are pinned to it. 390 is the narrower
of the two, so a layout that fits it fits a Pro Max, and neither defect is
width-dependent. Re-pinning the corpus to 430 would have moved every recorded
number in the repo for a reason unrelated to either bug.

**The 3x density immediately earned itself**, which is the argument for the
descriptor made better than by assertion: `test/visual-chips.test.ts` indexed a
full-page screenshot with CSS-pixel coordinates. On a 1x Chromium the conversion
was the identity and therefore invisible for the life of the suite; at 3x every
sample read a region a third of the way into the image and reported contrast
ratios as low as 1.32:1 against chips whose computed colours are byte-identical
on both engines. Fixed by scaling the boxes by `devicePixelRatio`.

### Deviation 5: three tests are narrowed by engine, one is declined

The prompt forbids quarantining failures to get a green board, and allows a test
that "genuinely cannot run on both" to be marked with a reason naming the engine
and the cause. Eleven WebKit failures came out of the first honest run. Seven
were defects in this repo's instruments and were **fixed** — four chip-contrast
failures (the density bug above) and three in this patch's own new motion test.
The remaining four are the population the escape hatch is for:

| what | engine | why it is not a bug |
|---|---|---|
| `heights.json` compared to the pixel (4 files) | WebKit | the baseline is a Chromium *recording*; WebKit's text metrics put the map at 944.36 against a recorded 944.5. Compared within 1px on WebKit rather than skipped, so a layout that moved visibly still fails |
| the seed stamp's clipboard readback | WebKit | `navigator.clipboard.readText()` from `evaluate()` has no user gesture and WebKit has no permission to grant. The copy and `data-copied` are still asserted on both |
| the throttled map scroll's frame timing | WebKit | measured through `context.newCDPSession`; the Chrome DevTools Protocol has no WebKit equivalent in Playwright. **The only case declined outright**, via `skipOn`, which puts the reason in the test title |

### The harness contention of section 26, raised again and named again

This patch adds a 23rd browser test file **and a second engine**, so it roughly
doubles the peak browser count `npm run check` reaches. Section 26's note about
concurrent vite builds and browsers therefore applies harder, and the symptom
appeared once: `test/visual-v0.test.ts`'s "one accent" case reported `battle has
no primary action` on one full `test:trim-strict` run and passed on the same
commit in isolation and on re-run.

Three of the eleven WebKit failures were the same class and **were** this
patch's, because those tests were making timing assumptions of their own; they
are fixed. This one is not — the real answer is a concurrency cap on the visual
suite, which is a change to shared config and not this patch's to make. Recorded
so the next red board is read with the durations and the file count in view.

### The general rule this patch paid for three times

**A test that waits a fixed fraction of a motion budget and then reads the
screen is making an assumption about what the budget is for.** Section 23
recorded this once, when the outro gate invalidated `playATurn`'s witness. This
patch's own observed-motion helper got it wrong three more times in one
afternoon: a fixed 220ms window that expired before a beat carrying a 562ms
`animation-delay` was due; a window read off the element but sampled at two
instants, which landed before WebKit had started and called a working lunge
dead; and a dense poll that still starved under a full 26-file suite.

The form that works does not race. It asks the element for its `Animation`
objects, **pauses and seeks** them across the active window, and reads the
computed style at each point — the same interpolated values the engine would
paint, with no dependence on scheduling. Paired with one `animationstart` and
`animationend` assertion, which is the half that says the engine really runs
what it created.

Two related traps, both of which produced a *passing* test for a broken one:
`transform: none` and `matrix(1, 0, 0, 1, 0, 0)` are the same rendering and
different strings, so comparing the strings counts the switch from rest to the
0% keyframe as motion; and `getAnimations()` returning a name proves the cascade
applied, not that anything moved.

## 28. The on-device diagnostic, and the artefact a handoff said had shipped

Prompt: [`spec/gymrun-patch-ios-diagnose-instrument.md`](spec/gymrun-patch-ios-diagnose-instrument.md).
Branch `claude/hopeful-lovelace-w118jz`, 2026-09-16, on top of merged PR #41
(`5a13d6b`).

Diagnostic tooling only. No `core/` change, no `ui/` change, no version axis
moved, `contentHash` unmoved. The shipped bundle is byte identical: the page
lives in `public/`, which Vite copies into `dist/` without processing it.

### The finding this patch exists for: a handoff described a file that was never committed

The PR #41 session closed by telling the reader to open `public/diagnose.html`
on their iPhone, and described the instrument in six numbered sections, its
validation against both engines, and a bug it had found and fixed in its own
`calc()` discriminator along the way.

**No file by that name exists at any commit on any branch in this repository,
and the `5a13d6b` merge adds none.** Everything else that handoff claims did
land — the WebKit harness, the twelve observed-motion beats, the Bug A round
trip deletion, the reduced-motion hold — all of it is in the merge, all of it
is gated. The gap is exactly one artefact, and it is the one every remaining
question about the iPhone depends on being runnable.

The general rule is worth more than the incident:

> **An artefact that no test runs can be reported as shipped and not be.** Every
> other claim in that handoff was true because something in the suite would have
> gone red if it were not. The diagnostic was the one deliverable with no gate
> behind it, and it is the one that was not there.

So the instrument arrives with `test/visual-diagnose.test.ts`, which runs it on
both engines under `npm run check` and holds three properties. The file cannot
now be deleted, emptied, or quietly broken without the suite saying so.

### Why it is `public/` and not `src/`, and why that decides everything else

The instrument's premise is that it is opened on a device where **the app may be
what is broken.** That rules out sharing anything with the app: no import, no
bundle entry, no module, and nothing fetched at parse time. Its presentation and
its logic are inline and complete before a byte of the app is requested, so a
deploy whose stylesheet 404s or whose entry chunk fails to parse still gets a
page that can say so. The app's real shipped stylesheet is then fetched *at
runtime*, which is also what makes the tool deploy-agnostic: it reads
`index.html`, finds whatever asset that build links, and tests that.

`test/visual-diagnose.test.ts` asserts the standalone property structurally,
against the file rather than against a run of it, because a page acquires an
import by accident and the cost only shows up on the one device that mattered.

The favicon is inline for a smaller reason with the same shape: a page with no
icon makes the browser request `/favicon.ico` anyway, and a 404 in the console
of a tool whose output is a console-clean report is noise that reads as signal.

### It reads computed style on purpose, and that is not a hole in Bug A's rule

`test/no-computed-timing.test.ts` bans `getComputedStyle` across the whole of
`src/`, and this file reads it constantly. Both are right. The rule is about
**app timing**: a value must travel one way, `data/` to JavaScript to CSS, and
Bug A was the round trip back. An instrument whose entire job is to report what
*this device's* engine resolved is the one thing that must read in the other
direction — and it is outside `src/`, so the structural test still covers
everything the rule was written for.

### Pause-and-seek, for the reason CI needed it and one more

The twelve beats are read by the technique section 27 arrived at after three
wrong turns: ask the element for its `Animation` objects, pause them, seek
across the active window, read the computed style at each point.

On a phone there is a second reason, and it is the stronger one. **Two of the
things this page exists to catch are exactly the conditions under which "wait
200ms and look" reports a working animation as dead** — Low Power Mode
throttling and a suspended compositor. A timing-dependent probe would produce
the very false positive the reader opened the tool to rule out.

### One element per `calc()` case, because the first build of this got it wrong

The PR #41 handoff records that its own discriminator reused a single element
between the three cases and re-assigned its `id`, so nothing restarted, cases
two and three reported no animation, and it called a healthy desktop Chromium a
broken engine. That build is not in the tree, but the bug is real and the shape
of it is general, so the fix is kept and so is the reason: each case is created
as its own element, and the test asserts all three `MOVES` lines individually
rather than asserting the absence of `STATIC`, so a case that silently stops
running fails rather than passes on an absence.

**A false headline is worse than no diagnostic.** It sends the reader to fix
something that is not broken, and it spends the credibility the next report
needs. That is why the healthy-engine case is the first assertion in the test
file and not the last.

### What it measures, and what it still cannot

Seven sections, in the order a reader should stop at the first red one: Reduce
Motion, the deployed build fingerprinted two ways (the asset names, which carry
Vite's content hash, and a checksum of the bytes this device actually received —
so a proxy serving stale content under a fresh name is still caught), what the
device's parser kept (the CSSOM walked for each of the six stage keyframe names,
plus `CSS.supports` measured rather than inferred from a support table), every
motion token as the device resolves it, the twelve beats, the `calc()`
discriminator with its two controls, and frame rate.

Two honest limits, both stated on the page rather than only here. The token
readout shows the **stylesheet fallbacks**, because the page does not run the
app and `ui/theme/motion.ts` is what writes `--motion-duration` and
`--motion-outro` at startup; a difference there is expected and an empty value
is not. And the instrument reports on the stage it builds, not on a live battle,
for the same reason `test/visual-motion.test.ts` drives beats by attribute:
reaching a flinch, a switch and a capture in one seeded run re-answers a
question already answered, and what neither can answer is the one this asks —
given the attribute, does *this device* move the pixels.

### Validation

Four runs before the file was committed: Chromium and WebKit 26.6, each with
and without `prefers-reduced-motion: reduce` emulated at the context. Both
healthy engines report `Everything this instrument can see is healthy`, 12 of 12
beats moving, all three `calc()` cases moving, no keyframe missing, ~60fps. Both
reduced-motion runs report `Reduce Motion is ON — this explains it` at `warn`
rather than `bad`, with `0 of 12` underneath it — the measurement is still taken
and still shown, so the reader can see what the setting did rather than take it
on trust. The suite file carries the same four cases forward.

**What this patch does not do is answer the iPhone question.** It cannot: that
answer is on a device this repository cannot reach, which is the whole reason
the instrument exists. What changed is that the question can now be asked.

### It was asked, and the answer is Reduce Motion

Added 2026-09-16, the same day, after the instrument reached the device. **The
tester checked and reported Reduce Motion on.** That closes the iOS thread:
there is no engine bug, there never was one, and every animation the report
described as missing was being cancelled by an OS accessibility setting that
GYMRUN honours by design.

Three things are worth keeping out of how it landed.

**Section 27's hypothesis was right, and it was right while being properly
hedged.** It said Reduce Motion "is the only configuration that reproduces the
reported symptom on the engine in question" and, in the same paragraph, "this is
not proof that the reporter had Reduce Motion on". Both halves were correct. The
hedge is the part to keep: the patch shipped the fix for it anyway — item 5, the
hold that no longer goes to zero — so being unable to prove the cause cost
nothing, because the change was worth making on its own terms.

**The instrument was not wasted by the answer being simple.** It is what moved
the claim from suspicion to fact, and it did it in one page-open rather than
another patch. A standing suspicion that nobody can discharge is a defect that
stays open; this one is closed. The next "no animations on a phone" report is
settled the same way, by the first line of section 1, before anyone reads a
stylesheet.

**What it says about the two patches before it.** PR #41 spent its length ruling
out five candidate causes for a bug that did not exist, and was right to: it
could not tell from a Linux box, and the five experiments are what establish
that. The cheaper path was never a better guess — it was a way to ask the
device, and that did not exist until now. The cost of not having an instrument
is paid in patches that investigate instead of measuring.

### The contention flake section 27 filed, reproduced — and this patch makes it likelier

Section 27 recorded one flake on the full gate: a browser test that is green in
isolation and on re-run, failing under a full suite because the visual files run
concurrently and starve each other. It named the real answer — a concurrency cap
on the visual suite — and said it was not that patch's to make, being a change
to shared config.

It happened again here, on the first full `npm run check`: `visual-v2`'s seed
stamp copy case failed on a `page.goto` timeout at 30s, with no assertion
reached. Green on its own (5/5) and green on the re-run of the whole WebKit leg
(27 files, 209 passed, 2 skipped).

**This patch makes it likelier and should say so.** `visual-diagnose` is a 27th
browser file and it launches two contexts of its own. The item is unchanged and
still not this patch's to fix, but it now has two sightings rather than one, and
a second cause to be read against: a `page.goto` that times out with no
assertion reached is contention, not a regression, and the distinguishing test
is a re-run in isolation.

## 29. The victory-order patch: the capture moved in front of the move

Branch `claude/victory-screen-battle-ui-p3op20`, prompt
[`spec/gymrun-patch-victory-order-and-battle-readouts.md`](spec/gymrun-patch-victory-order-and-battle-readouts.md),
2026-09-17. A playtest report of six items, three of which were open on scope and
were answered by the author before any code — the answers are in the prompt file
under its verbatim text.

Three axes moved: `RUN_LOG_VERSION` to `-17`, `RANDOMIZER_VERSION` to `-17`, and
`contentHash` from `c3964b` to `73c1ee`. `AI_VERSION` holds.

### 29.1 The order, and why `resolveNode` had to move with it

A node used to ask its move questions and then offer its Pokemon. That is
invisible at every node but one — a wild fight that pays a TM *and* offers its
species — where the player was asked "who learns Earthquake" while the Pokemon
they were about to catch was still standing on the other side of the field, spent
the card, and only then met the member they might have wanted to give it to.

The capture resolves first now. `playRun` builds `learners` —
`partyAfterAcquisition`, which runs the same `applyAcquisition` `resolveNode`
runs, on the same decision — and both move questions are asked against it.

**The half that is easy to leave out is the fold.** A recorded target index names
a slot in whichever party the question was asked against, so `resolveNode` had to
apply the acquisition ahead of both `applyReward` calls on both of its branches.
Leaving it where it was would resolve that index against a party one member
shorter, and after a release against one whose members had all shifted down a
slot — the move would land on somebody else, silently, and only at the nodes that
do both. The old comment's rule ("a fixed order is what stops the two being a
race") was right about needing a fixed order and free to pick either one, because
nothing then depended on which. Something does now.

**One run in the visual baseline changed its party, and the cause is the
backpack.** `SEED-B` ends holding the same two items on the same two members —
swapped. Its decision kinds went `reward acquisition items` to
`acquisition reward items`, so the captured Pokemon's held Lum Berry now reaches
the backpack *before* the reward card's Silk Scarf, and `defaultItemPlan` walks
the bag in order. Nothing else about the run moved: same nodes, same outcome,
same species, same moves. It is worth naming rather than waving through, because
"the fold order changed" and "a bag is ordered" compose into a visible
difference, and the next person reading a baseline diff for this patch should
find the answer here rather than derive it.

**What did not move: `reward` stays after Part A.** Stage 4.8 item 2 pinned the
gym's unconditional move ahead of the card chosen over two others, and that pair
is untouched — the `reward` entry is still recorded where it was, below the gym's
`target`. Only the acquisition moved, and it moved above both. A second
reordering with nothing asking for it would have been a second reason for every
recorded seed to be unreplayable.

The fixture is the evidence and it is worth quoting. `FIXTURE-CHARLIE`'s decision
kinds went from `… reward target replace acquisition …` to
`… acquisition reward target replace …` at three nodes, the gym's
`… target replace reward …` is unchanged, **every decision value is the same, and
the nodes, party, HP and outcome are byte identical.** The reorder changed the
order of the questions and nothing about the run.

### 29.2 The gym move can be handed back, and nothing else can

`rewards.DECLINED_MOVE` is `-1`, legal at exactly one payout. The rule is the one
`chooseMoveToReplace` already stated from the other side: "the place to skip a
move reward is the reward screen, where it was already chosen over two
alternatives; a second escape hatch here would make that pick meaningless." A
gym's move has no reward screen behind it — it was chosen over nothing — so
refusing it is the *first* escape hatch rather than a second one. That rule is
unchanged for reward cards, shop TMs and event grants, and
`askMoveQuestions` refuses the sentinel where it was not offered rather than
trusting its callers: it falls through to the ordinary range check and fails by
name.

Three details that a plausible simpler version gets wrong:

- **It is still a `target` entry.** An absent entry would be a cursor that slips
  at the first gym anybody declined at, and every answer after it read against
  the wrong question.
- **`-1`, not the party length.** A "one past the end" sentinel is the same
  integer as a legal slot in a party one member larger, and the party *does* grow
  mid-node now — see 29.1. A negative index can never be a slot.
- **`result.gymMoveDeclined` is a flag, not an absent target.** Absence already
  means "no gym, or a gym not won", and `resolveNode`'s `?? 0` would hand the
  refused move to slot 0.

`scriptedRunPolicy` never declines, at the gym or anywhere. A baseline that
sometimes refused a free move would put a move-economy heuristic inside every
balance figure recorded against it.

### 29.3 The animation report was right about the symptom and wrong about the cause

> "Animations are not tied to speed right now, are they? I just saw a Snubbull go
> before my Sizzlipede and the animation for my attack went first."

**The lunges were correct.** `ui/scene.ts`'s `beats` places a side by its first action in
the protocol the engine already resolved, and `test/battle-feedback.test.ts` has
driven a real Snorlax/Jolteon fight through the real adapter and asserted both
directions since Release C. Nothing there was wrong.

What was asserted **nowhere** is that slot 2 is later than slot 1 *on screen*.
`[data-acted="2"]` is one `animation-delay` declaration sitting at the same
specificity as the rule it overrides and winning only on source order; all twelve
beats in `visual-motion` trigger slot 1; and every other motion test in the repo
reads one element in isolation. So the first thing this patch shipped was the
missing assertion — both engines, both directions, plus the exact two-beat ratio
the four-slot budget is built from — and it passes. **The order is fine and now
it is held.**

**The defect is the bar.** Both sides' chunks were drawn on the frame the update
arrived, whoever had acted, so on a turn where both sides took damage the outline
of the hit the player *dealt* appeared simultaneously with the one they took —
before either body had moved. Two chunks at once is a turn with no order in it,
and the eye goes to the bar, not the sprite. From the losing side of a Speed
check that reads exactly as "the animation for my attack went first".

So the chunk is slotted, to the same two slots `data-hit` already uses, from the
same reading: `actingOrder` is lifted out of `beats` and read once per update,
before the panels redraw, and handed to both.

**What is not slotted, and the rule this does not break.** The bar's *fill*, the
HP text, the flag words and the move buttons are correct on the frame the update
arrives, and `ui/theme/motion.ts`'s "nothing mid-fight waits for this" is
untouched. The chunk is the ghost of the ground that was lost — emphasis, not
information — and a player who never looks at it loses no fact. Delay plus
duration is four beats on both slots, exactly `--motion-duration`, so the fade
still ends where the last lunge does and a turn's whole feedback is still the one
number.

`animation-fill-mode: both` is load-bearing and is the part a tidy-up would drop:
without a backwards fill the shadow sits at its base rule's `opacity: 0` through
the delay, and the chunk is invisible for the part of the turn it is waiting out.
The browser case asserts the held opacity directly for that reason.

### 29.4 A fourth timing trap, in the file that already documents three

`test/visual-motion.test.ts`'s header records three wrong turns in sampling an
animation. This patch paid for a fourth, and it is a different kind: not *when*
you sample, but *whether the cascade has run*.

`getAnimations()` reports what style has already been resolved into, and style
resolves on a frame. A case that removes `data-acted` at the end of its own
`evaluate` and a later case that sets it again can leave the engine seeing no net
change to the computed style — so it creates nothing, and the test reports "slot
2 has no lunge" on a build whose slot 2 works. It failed exactly that way,
intermittently. The fix is to clear, let a frame pass, then set, then read a
computed property as the flush. **The general form: an animation test must settle
the cascade before it asks what the cascade produced.**

### 29.5 The final segment's battle pair, and the one guarantee it is allowed to cost

`tuning.battlePairFromSegment` (7, the last segment) makes every route there carry
two consecutive steps that are a straight wild-versus-trainer choice. The player
still chooses at both — four routes across the pair — and what is removed is the
option to not fight, twice.

It is placed **first** in `enforceComposition`, before the guaranteed wild step,
and that is load-bearing in both directions. It is the only rule there that cares
*where* its steps are; every other floor takes any unclaimed step it can get, so
running them first would leave the pair choosing between whatever gaps they
happened to leave, and on a short route there may be no adjacent pair at all.

**It costs the rest density, and it is not allowed to cost the rest guarantee.**
`restFloorFor` is two numbers taken together: `minRestSteps`, which is the
guarantee that a route has somewhere to heal, and a density target that grew out
of segments getting longer. Four of a six-step route are claimed before the rest
pass runs, so the density target and the pair compete for the same steps.
`restFloorForRoute` resolves that in the pair's favour and drops a paired route to
the guarantee; `hasBattlePair` is the single predicate both it and
`placeBattlePair` read, so the generator and the table cannot disagree about which
routes are the gauntlet. And `hasBattlePair` refuses to place at all on a route
without room for the pair *plus* the wild step, the event floor, `minRestSteps`,
and the head of the route that `restEarliestStep` bars from being a rest.

At the shipped curve the covered segment is six to seven steps and the pair always
lands. The short-route branch exists for a sweep, which may legitimately try
`stepsPerSegment: 1`.

**The three fixture seeds do not reach segment 7** — they die in segments 0 and 1
— which is why the fixture's run payload is byte identical across this patch and
why the pair is covered by `test/node-curve.test.ts` and `test/locales.test.ts`
instead. That is a real gap in what the fixture proves, and it is named rather
than papered over: the fixture proves the *earlier* segments did not move, which
is the half `RANDOMIZER_VERSION` makes a claim about.

### 29.6 The opposing side's count, and the line that came off the header

`BattleUiView.opponentLeft` carries `{ standing, total }` with **`total: null`
when the player has not been told**. `RevealPolicy` gains `teamSize`, set per node
rather than per run — a trainer and a gym leader arrive with a team the player can
see, a wild encounter is whatever the grass has left — and the row renders `?`
rather than the number withheld.

The row carries marks *and* the number, and both are needed at the range it has to
cover: the marks are the glance, and the number is what still works at ten, on a
phone, for a player who cannot tell nine marks from ten. Built to ten on one line
at 390px, which is slack — a side fields at most `MAX_TEAM_SIZE` today and that
number does not move in this patch.

**The battle header's `N Pokemon` came out with it.** It was a fixed count read
straight off the node's generated team, which was right when nothing else said it
and wrong the moment the opposing panel carried a live one: a header reading
`3 Pokemon` beside a panel reading `1/? left` is one screen answering one question
two ways, and the header's answer is the one a wild node is not supposed to give.

### 29.7 The tooltip that was missing on one card

`src/ui/screens/acquisition.ts` built its ability span without the
`data-tip="ability:…"` that `member-card.ts` sets. Invisible on a desktop, where
the card names the ability and a reader can go and look it up; on a phone the
tooltip layer *is* the reference, so a missing trigger reads as the ability having
no explanation rather than as this card having no trigger. The screen where that
costs most is the one where a Pokemon is taken largely on its ability.

## 30. The chip audit: two filed decisions superseded, and a watermark

**2026-09-17**, on `claude/serene-bohr-xn433h`. Prompt:
[`spec/gymrun-patch-chip-audit-and-move-type-icons.md`](spec/gymrun-patch-chip-audit-and-move-type-icons.md).

Presentation only. No `core/` change, no version axis moves, `contentHash`
unmoved: the one new data-shaped file, `ui/theme/typeIcons.ts`, is under `ui/`
for the reason `ui/theme/itemIcons.ts` is, and nothing under `core/` imports it.

The brief asked for two audits and one small feature. Both audits landed on
decisions already in the lineage, so neither was implemented as a rediscovery —
each was put to the author with the standing decision quoted, and each answer is
dated today. This section is the account of what those answers retire.

### 30a. Patch 4.8.0.3 item 3 is superseded

**The retired rule:** the archetype chip is removed from every surface that
draws the six stat bars, because the bars show the same shape and the chip can
be wrong — `archetypeOf` reads base stats only, so a fully randomized move set
leaves a `pTank` attacking specially.

**What replaced it:** the chip is drawn on every surface that draws a Pokemon.

The audit that found this also found what the rule had cost. The chip was on
four surfaces and off six, and a label that appears on four surfaces out of ten
is not a shorthand anybody learns — it is a thing that turns up sometimes. The
known failure mode is real and unchanged; it is answered where it was always
answered, in `ARCHETYPE_CAVEAT`, inside the panel every one of these chips
opens.

The surfaces that gained it: the party card (so the party screen, the drawer and
the pre-gym lead chooser, all three through `memberCardContents`), starter
select, evolution, the acquire offer panel, and the learn-move recipient.

**The learn-move recipient was not a judgement call.** It is the one surface
that had neither the chip nor the bars the chip was traded for, so it carried no
shape information at all — the screen that decides which of four moves a Pokemon
keeps said least about the Pokemon. That is a hole rather than a decision, and
it would have been worth closing under the old rule too.

`src/ui/screens/locale-select.ts` had been hand-rolling `badge badge--archetype`
instead of calling `archetypeChip`, which is `.badge`'s metrics with none of
`.chip`'s recipe — bare uppercase text among siblings that all carry the fill
and the hairline outline. `test/chip.test.ts` exists to catch exactly that and
did not, because its regex lists the badge modifiers it knows about and
`badge--archetype` was not one. The modifier is in the list now, with `ability`.

### 30b. The 2026-09-10 type wheel ruling is superseded for Pokemon badges only

**The retired rule:** "keep the wheel, drop the trigger from the two Pokemon
panel type badges" (`spec/README.md`, "The register supersedes an archived
instruction").

**What the audit found:** it had been applied to every type chip in the app
rather than to the two it named. The wheel was reachable from a battle move card
and from nowhere else — not from a party card, an acquire panel, a learn-move
recipient, a result summary or either battle panel. The mechanism is why:
`screens/starter-select.typeChip` is a bare one-argument wrapper that nine
screens pass straight to `.map`, so there was no site at which a Pokemon's type
and a gym leader's type could be told apart.

**What replaced it:** `ui/chip.ts` grows `monTypeChip`, which is that site. A
Pokemon's types open the wheel. A gym leader's type, a locale's types, a threat
entry's type and the type an item boosts do not, because those are forecasts
about content the player has not reached and `CLAUDE.md` forbids them.

**The objection this leaves open, recorded rather than resolved.** `scene.ts`
carried a longer argument than the release plan's, from a playtester: on a
*Pokemon* panel the wheel answers "what does Water do offensively" beside a
Pokemon whose four moves are drawn off-species and predict nothing of the kind.
That argument is better evidenced than the ruling quoted in the question, and it
is preserved verbatim in the source under the new note. What it establishes is
that the wheel's **offensive** half is misleading on a Pokemon badge; it does
not establish that the **defensive** half is, and the defensive half is the
question a player asks of the thing standing opposite them. The wheel renders
both, so restoring the trigger restored both. The narrowing that would close it
— a Pokemon badge opening the defending half only — was not asked for and is not
built.

### 30c. The ability was a chip on two surfaces out of nine

Not a superseded rule, just drift, and one kind of it is worth naming. The
ability was a real chip on the result summary and the battle panel, a bare
`<span>` carrying a `data-tip` on the party card and the acquire panel, plain
text inside a concatenated string on starter select, and absent on the
learn-move, item-target, evolution and locale surfaces.

**The `<span>` case is the one that justifies a shared builder.** `ui/tooltips.ts`
binds `keydown` for Enter and Space, and an element with no `tabIndex` never
takes focus, so it never receives either. Those two triggers opened under a
mouse or a finger and did not exist for a keyboard reader — present in the
source, absent in use. `abilityChip` is now the one builder and it sets
`tabIndex` and `role`.

The battle panel's unrevealed case stays a plain `neutralChip`: there is nothing
to open, and a focusable chip that opens nothing is a keyboard trap.
`revealOpponentAbility` still decides which branch that is.

### 30d. One layout regression, found by looking

`.replace__owner` was a species, a level and two type chips, which fitted one
line at 390 with room to spare. Adding the archetype chip and the ability made
it overflow: the ability ran off the right edge and the sprite was pushed out of
the viewport. It wraps now and reserves the sprite's gutter off `--figure-size`,
the same way `.party__member > .panel__header` has since the idle-sprites patch.

Caught by screenshotting the surfaces rather than by a test, which is the honest
account — and the first version of this paragraph got the reason wrong. It said
nothing measures horizontal overflow. Something does: `scripts/smoke.mjs`
asserts `documentElement.scrollWidth <= innerWidth`, and two visual tests assert
it for the outro and the seed bar. **The guard exists, works, and would have
caught this**, because no ancestor of a screen clips horizontally — `body`,
`.shell` and `.screen` set no `overflow`. It is pointed at the locale screen,
the map and a battle, and `replace` is none of those.

That is a narrower defect than "untested" and a more useful one, so it is filed
rather than folded into this section: see "Carried out of the chip audit" in
[`README.md`](README.md) section 5. The short version is that the three
surfaces are a hand-picked list and nothing asserts the list is complete, which
is the property `test/visual-chips.test.ts` already holds for chip variants and
this guard does not.

### 30e. The move-card type watermark

`ui/theme/typeIcons.ts`: nineteen glyphs, one per type with a colour token, each
a single closed silhouette in a 24-unit box with interior detail cut as an
even-odd hole. Drawn for this repo rather than traced from the reference sheet
the brief arrived with — the sheet is somebody else's artwork, and at the size
and opacity this ships at, detail would not survive anyway.

The mark is redundant by design: the type is already on the button in words, on
the chip at the head of the identity line. So it is `aria-hidden`, carries no
tooltip, and `typeIconPath` returns `null` for an unknown type rather than
drawing a fallback a player would try to learn. Battle buttons only — `moveCard`
draws the same component outside a fight and carries the 4.7.2 expander in the
corner this would occupy.

**Three things were changed after looking at them**, and they are the reason the
report carries a contact sheet:

- The Bug glyph was one silhouette with the elytra split cut out of it, which
  even-odd rendered as a hairline outline: it read as a stick figure, not a
  beetle. It is separate solids now.
- The Dragon glyph read as a rocket, then as a pen nib. The pointed snout was
  doing it; it is blunt now, and the glyph is still the weakest of the nineteen.
- The mark was first placed at the button's vertical centre, which is where the
  fact chips are — they painted over its left half and the result read as a
  clipped icon rather than as a background. It sits in the corner beside the
  name now, and `.moves .move__name` yields 34px so that corner is reliably
  empty.

The brief's ceiling — "50% opacity max" — is a token, `--move-watermark`, and
`test/type-icons.test.ts` asserts it rather than a comment claiming it. It ships
at 0.3, well under, because at 0.5 the glyph competes with the move name.

**`test/type-icons.test.ts` has no bounds assertion, and its first draft did.**
That draft read every number out of the path data and asserted each was inside
the box, which is not what those numbers are — a lowercase path command takes
relative deltas and an arc takes radii and flags before its endpoint. It called
the Normal ring's legal `-7.4` an escape. It was deleted rather than loosened,
and the file says why in place of it.

## 31. The shop and moveset-variance patch: a category nothing drew, and a slot with no draw

**2026-09-17**, branch `claude/intelligent-newton-5ftz3j`. Prompt:
[`spec/gymrun-patch-shop-and-moveset-variance.md`](spec/gymrun-patch-shop-and-moveset-variance.md).
Report, filed before any code and treated as a hard stop:
[`reports/moveset-pool-validation.md`](reports/moveset-pool-validation.md).

Axes: `RANDOMIZER_VERSION` to `gymrun-randomizer-18`, `contentHash` to `fd9b5e`.
**`RUN_LOG_VERSION` holds at `-17`** and `AI_VERSION` holds.

### 31.1 Status moves were unreachable, not under-weighted

All four routes that hand a player a move — reward card
(`core/rewards.ts`), shop shelf (`core/economy.ts`), event grant
(`core/events.ts`), gym clear (`GYM_MOVE_ENTRY`) — call `damagingInBands`, and
`DAMAGING_MOVES` cannot hold a status move because `scripts/gen-pools.ts`
excludes the category at generation. **So no weight, price or table edit
anywhere in `data/` could ever have produced one.** That is why the fix is a
reward *kind* and not a row: `technique`, drawn through the new
`statusByImpact` in `core/randomizer.ts`, which is `damagingInBands`' opposite
number and reaches the same `STATUS_AVAILABLE` list `rollMoveset` already uses.
One pool, two doors.

`MoveReward` gaining the kind is the load-bearing line — `askMoveQuestions`,
`applyReward`, `party.teachMove` and the move-replace screen all work
unchanged, because a status move asks exactly what a TM asks.

**One reader did not come along, and it is the case `docs/README.md` open item
15 exists to warn about.** `isTargeted` was
`kind === 'tm' || kind === 'tutor'`, which stays valid TypeScript when the union
widens and silently answers `false` for the new kind. It did: a bought technique
reached `teachMove` with no slot and threw at the first party member holding
four moves, because `playRun` never asked the question. It is an exhaustive
`switch` with no `default` now, so the next kind is a compile error there.

### 31.2 The shelf is a list of categories

`data/shop.ts` was one weighted table walked `shopStockSize` times, so a shelf
could legally come out as three heals. It is an ordered list of `ShopSlot`s now
— battle move, technique, berry, heal, item, and a relic from segment 3 — each
drawn *within itself*, so the question a slot asks is "which heal" rather than
"a heal at all". The mapping is the brief's: Slay the Spire's cards, colorless
cards, potions, relics and removal.

`tuning.shopStockSize` became `tuning.shopExtraSlots`, `{ min: 0, max: 1 }`:
bonus rows above the guarantees, drawn from the flattened table. **It stayed a
range on purpose.** It is the only knob in `tuning.ts` that changes how much the
`rewards` stream is drawn, and `test/tiers.test.ts` and `test/rewards.test.ts`
use exactly that to prove a rewards-side change moves neither the map, the teams
nor the battle seeds. That lever was `allowSpeciesRewards`, then
`shopStockSize`; it moves when the feature under it does, and deleting it
outright would have left the property with nothing to pull.

Every slot draws exactly once whether or not it has anything to choose between,
so a single-entry category still spends its `nextFloat`. Same discipline as
`rollMoveset`, same reason.

### 31.3 The forced STAB slot got a window, and `stabBias` was measured and declined

Band 1 holds 82 moves, which reads healthy until it is sliced by type: **one
Psychic move and one Dragon move.** Thirteen of the 191 starters therefore had
no draw at all on slot 1 — every Psychic opened with Confusion, every Dragon
with Twister — and for Axew (base Attack 87, base Special Attack 30) that
mandatory move is a 40 BP *special*. Six types' band-1 pool is entirely one
attack category.

`MOVESET.stabWindow = 1` lets a STAB-restricted slot draw from its band and the
one above. Measured: 6.8 mean options to 14.5, thirteen deterministic species to
none, six single-category types to one. **It costs no randomness** — `take()` is
one `pick` whatever the pool size — so the draw count stays a function of
`MOVESET.slots` alone, which is the whole reason to prefer it to widening the
band.

Segments 0-2 moved from `moveBandWeights: { 1: 1 }` to `{ 1: 4, 2: 1 }`. Band 2
is 13.3% Normal against band 1's 20.7%, so it dilutes the beige problem from
both directions, and it applies to the player and every opponent equally.

**`stabBias` was the obvious lever and is declined**, with the arithmetic in the
report's section 4: Normal is 20.7% of band 1, so every coverage slot handed
back to an open draw is a one-in-five chance of the worst coverage type in the
game. Zero `stabBias` buys about half a distinct attacking type and ten points
of Normal, and does nothing about the thirteen, because that slot is forced by
`stabSlots`. Written down because it is cheap to reach for.

### 31.4 What the benchmark said, and what it could not see

`randomizer-18` · `fd9b5e`, 400 seeds, RETUNE, against the `-17` row: **+0.075
mean gyms (0.47 to 0.545), completion unmoved at zero**, gym 1 +5.1pt and gym 3
+5.0pt. Recorded, not chased; `balance.md` §0 carries the row.

**The shop half is essentially unmeasured by it.** 95 shop visits landed in
segment 1 and 12 in segment 2, none past it, so the relic slot, the late price
band and every segment-3-onward shelf never appeared in the population. The one
reading worth carrying forward is `broke on arrival` at 86.9%: the early shelf
is priced above what a segment-1 wallet holds. That is a number to watch rather
than to act on, and acting on it would be retuning against a curve that this
patch just moved.

### 31.5 Seed-pinned tests, and the pattern they moved to

Seven tests failed on the bump for a reason with nothing to do with what they
assert: they pinned a seed, and a `RANDOMIZER_VERSION` bump reshuffles how far a
seed gets. They now search across a seed list and assert that the search found
something — the pattern `test/backpack.test.ts` already records and explains.
`test/party-slots.test.ts` carries the sharpest version: the scripted policy
clears a gym on roughly one seed in five, so its list leads with four that work
today and carries a tail of fourteen, because a short list is a coin flip at the
next bump rather than a pin that fails honestly.

`test/banding.test.ts` is the exception and was rewritten rather than
re-seeded. It asserted "never gives a starter a move above band 1", which the
window makes false on purpose; the assertion's real job was that a starter
cannot reach the middle of the table, and that job survives intact one band
wider.

### 31.6 The shelf's move card, and the gate that caught its height

Open item 13 — the shelf printed `Tutor: Flamethrower` and nothing else while
the reward screen offering the identical move printed its type, base power,
band, PP, category and tags — is closed here rather than left, because this
patch put a *third* move kind on that shelf and shipping it with the same gap
was worse than fixing it. The rows go through `scene.moveCard` over
`moveCardData`, the reward screen's own insertion point, with no holder passed.

**It cost height, and the assumption that it was free was wrong.** The shop is
not one of the two screens `heights.json` guards, and that was mistaken for "the
shop is not guarded": `test/visual-pocket.test.ts` holds *every* decision
surface, the shop included, to a document `scrollHeight` at or under 844 — "a
hard gate, no exemptions". With five or six guaranteed rows instead of three or
four drawn ones, two of them carrying a card, a segment-0 shop measured 864.

Pocket hides the cards, in CSS (`:root[data-density="pocket"] .shop__item >
.move--card`). Not by a branch in the screen: a screen that reasoned about
density in JS would not re-render when the mode is switched live, and
`test/density.test.ts` greps for exactly that. Detailed and Simple keep the
cards and scroll, which they always did.

The lesson is the ordinary one and it is worth the line: **the gate found this,
not the reasoning that preceded it.** "The shop is not a guarded screen" was
said in this session, with confidence, and was false.

### 31.7 The WebKit leg of the gate did not run, and this is the record of that

`npm run check` is five legs chained with `&&`: lint, typecheck, `vitest run`,
`test:webkit`, `test:trim-strict`. **On the container this patch was built in,
two of them could not run**, and the reason is worth writing down because the
failure mode is the one `docs/README.md` open item 8 exists to remember — a gate
believed to be green, or believed to be red, by a session that never read it.

Only Chromium is installed here. `GYMRUN_ENGINE=webkit` fails at launch with
`Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh`, and the
environment forbids `npx playwright install`. All 24 browser test files then
fail at `openHarness`, before any assertion. Because the legs are `&&`-chained,
**`test:trim-strict` never ran in that invocation either** — and the wrapper
still reported exit 0, which is exactly how a chained gate lies.

What did run, and passed, run directly rather than through `check`:

| leg | result |
|---|---|
| `eslint .` | clean |
| `tsc --noEmit` | clean |
| `vitest run` (Chromium) | 136 files, 1805 tests, all passing |
| `GYMRUN_TRIM_STRICT=1 vitest run` | 136 files, 1805 tests, all passing |
| `test:webkit` | **did not run — no WebKit binary** |

Both suite figures are from the *merged* tree, after the chip audit came in and
after the height re-record section 31.8 describes. Run directly rather than
through `npm run check`, because the wrapper's `&&` chain stops at the WebKit
leg and would have skipped the strict trim run behind it.

There is no CI in this repository, so the WebKit leg is local-only and nothing
else will run it. **It has to be run by hand on a machine that has the binary
before this branch merges**, and this section is here so that "the gate was
green" is not read off a run that skipped a fifth of it.

The patch's own risk against that leg is small but not zero: it changes one
stylesheet rule (`:root[data-density="pocket"] .shop__item > .move--card`) and
the shop screen's DOM, and the WebKit suite is the one that measures layout on
the second engine. The Pocket no-scroll gate passed on Chromium at 17/17.

### 31.8 The merge with the chip audit, and the 21px neither patch caused

PR #44 merged while this branch was building and the code conflicts were none:
two documents that both grew a section 30, and a register that grew two rows.
`styles.css` auto-merged because the two rule sets are disjoint, and `scene.ts`'s
`moveCard` — which this branch calls from the shop shelf — kept its signature
across the audit.

**The guarded battle screen did not merge cleanly, and neither patch is at
fault.** The chip audit put a type icon on the move buttons and moved
`heights.json` by nothing on `main`. This branch moved the battle screen 5.5px
*shorter*, because the moveset change gives SMOKE24's lead different moves and
their names cost one line less. Together the new icons land on those different
names and the screen measures **610.5**: +21 on this branch's 589.5, +15.5 on
main's 595. Four `visual-v*` height tests failed on the merged tree and on
neither parent.

Re-recorded against the merged tree, which is the only tree that produces the
number. `decisionTop` is unmoved everywhere and the map did not move at all, so
the guard's own property held through the interaction — what moved is content
under an unchanged layout, which is what the guard is shaped to allow.

**The cost is headroom.** `test/visual-v0.test.ts` holds both decision points at
or above y=740, and the battle screen's margin went from 37.5px to **16.5px**
(723.5 against 740). It passes, and it is a real assertion rather than an
`it.fails` marker. But two independent patches that each looked free spent
57% of that slack between them without either one measuring it, and the next row
added to a move button will find the line. `docs/visual/baseline/README.md`
carries the correction and the numbers.

## 32. The missing sprite was 84px wide, and the alt text is why

**2026-09-17**, on `claude/serene-bohr-xn433h`, after PR #44 merged at `df2982f`.
Presentation only: one CSS declaration and one regression test. No `core/`
change, no version axis moves, `contentHash` unmoved.

**The defect predates the chip-audit patch and was exposed by it.** That
distinction is the whole reason this section exists rather than a line in
section 30.

### How it surfaced

`test/visual-phone-seed-bar.test.ts` asserts `documentElement.scrollWidth`
equals 390 on the starter screen. It began failing at 401 — but only inside the
full 136-file run. It passed standalone, passed under `GYMRUN_TRIM_STRICT=1`,
and passed with all 28 browser files in parallel. A probe on that screen in the
passing configurations found nothing past 390.

The first three explanations were all wrong and all plausible: a font falling
back (there are no web fonts in this project, so metrics are deterministic), the
new ability chip failing to wrap (it wraps, and `.starter__meta` was given
`flex-wrap` anyway), and CPU contention (the run that failed had the machine to
itself).

Two measurements settled it. A full-suite run on `9616ade` — the commit before
the chip audit — **passed**, which said the branch was responsible. Then the
failing assertion itself was instrumented to dump every element past 390, and it
named one: `img.sprite`, 84px wide, right edge at 401. Running the same probe on
`9616ade` reproduced it **identically**, which said the branch was not
responsible after all. Both are true: the bug is older, and the patch changed
the starter card's render enough to move the timing that hid it.

### The mechanism

`ui/sprites.ts` sets `alt = species` and `width = height = 96` as attributes;
`.figure > .sprite` sizes the image to `--figure-size` in CSS, which beats a
presentational hint. That holds while the image loads.

It stops holding when the image fails. **A broken `<img>` carrying alt text is
no longer a replaced element** — Chromium lays it out as an inline box around
the alt string, and `width` does not apply to a non-replaced inline. So the box
becomes as wide as the species name. On one seed's three starters:

| alt | characters | width, in a 48px figure |
|---|---|---|
| `Zorua` | 5 | 48px |
| `Flabébé` | 9 | 59px |
| `Hippopotas` | 10 | **84px** |

`.sprite[data-missing='true']` used `visibility: hidden`, which hides the box and
keeps every pixel of it in the layout. So the longest species name on screen
pushed the document 11px past a 390px viewport.

### The fix, and the three that were rejected — one of them after it shipped

`display: inline-block`, keeping `visibility: hidden`. `width` does not apply to
a non-replaced inline; it does apply to a non-replaced inline-block. One word
gives the alt-text box back the dimensions the stylesheet already specifies, and
nothing else about the element changes.

**`display: none` was tried, committed, and reverted in the same session.** It
returns the page to 390 and it broke four tests in `test/visual-motion.test.ts`:
`sprite-hit`, `sprite-sink`, the switch-in and the recall all stopped firing,
because an element that is not displayed runs no CSS animation.

That is not a test artifact, and it is the more serious defect of the two.
Branch 3A of the battle-animation run (section 23) made `reviewBattle` *wait* on
those beats — the one place in this project where something waits on an
animation. A player whose sprite request failed would have been waiting on an
animation that could never start. **The overflow makes a page scroll sideways;
this would have stalled a fight.** Caught by the full suite on the commit that
shipped it, which is the argument for running the whole thing rather than the
files a change looks like it touches.

**Clearing the alt text** also returns the page to 390 and was rejected: the alt
is correct when the image loads, and a layout that holds only while no species
has a long name is not a layout.

**Clipping the figure** was rejected for the reason the stylesheet already gives
at `.stage`: a box that clips is a box that cuts something which overhangs by
design.

### Why the sandbox saw it and a player might not

Every sprite is broken in this environment — there is no route to the sprite
CDN — so the defect is permanent here and intermittent anywhere with a network.
A player meets it when a request fails: a phone page that scrolls sideways
because one Pokemon has a long name and the network dropped.

`test/visual-sprites.test.ts` already aborts the CDN and its header already
claims "a figure is a fixed box whether or not its image arrived". That claim
was false for three patches and is now asserted — against the figure rather than
a pixel count, so it fails for the right reason, with the document-level check
beside it because that is the symptom a player would actually meet.

## 33. The opening was drawing from a table nobody wrote

**2026-09-17**, branch `claude/admiring-euler-dhn536`. Prompt:
[`spec/gymrun-patch-band-recut-and-level-curve.md`](spec/gymrun-patch-band-recut-and-level-curve.md).
Report, filed before any code and treated as a hard stop:
[`reports/early-game-band-and-curve.md`](reports/early-game-band-and-curve.md) —
which is also the decision record, because the instruction that produced it asked
for one.

Axes: `RANDOMIZER_VERSION` to `gymrun-randomizer-19`, `RUN_LOG_VERSION` to
`gymrun-run-18`, `contentHash` to `49e50f`. **`AI_VERSION` holds** at
`gymrun-ai-6-spent-item`, deliberately: `GREEDY_BASELINE` is the yardstick every
benchmark row is read against, and moving it would move every row with it.

### 33.1 The complaint was band 2, and the cause was not the weights

The report opens on a measurement. Segments 0 to 2 are written
`moveBandWeights: { 1: 4, 2: 1 }` — 80/20 — and across 600 seeds gym 1 was
measured fielding **61% band 1, 34% band 2 and 5% band 3**. The opening was
drawing from a distribution that appears in no file.

Two channels. `MOVESET.stabWindow` was 1, so the forced STAB slot read
`damagingInStabWindow(band)` — its band *and the one above* — and `rollMoveset`'s
`take(from) ?? take(inBand) ?? take(pool.all)` fallback reaches the whole pool
whenever the type filter empties, which at band 1 it frequently did.

Both arrived in `40dbb0b`, whose message describes the window and not the weights:
that commit also moved segments 0 to 2 from `{ 1: 1 }` to `{ 1: 4, 2: 1 }` without
saying so. `starters.ts` still claimed "segments 1-2 draw band 1 only" and had
been wrong since.

### 33.2 Five bands, cut where the dex is empty

`POWER_CUTS` went `[55, 75, 95]` to `[60, 75, 90, 110]`.

| band | range | moves |
|---|---|---|
| 1 | ≤60 | 117 |
| 2 | 61-75 | 63 |
| 3 | 76-90 | 114 |
| 4 | 91-110 | 58 |
| 5 | 111+ | 45 |

**No move in the pool has effective power in 91-94 or in 111-119**, so the two new
edges fall in ranges the dex already leaves empty and not one move is reclassified
by an arbitrary boundary. That is the argument for these four numbers rather than
four neighbouring ones, and it is checkable by re-running the census.

Band 1 going from 82 moves to 117 is what makes closing the window affordable.
The window existed because band 1 held one Psychic move and one Dragon move; at
117 the count of types whose entire band-1 slice is one attack category drops from
six to three, and of types with fewer than three band-1 moves from four to two.
The fix moved from the symptom to the cause.

### 33.3 Three type gaps, pinned rather than designed around

The recut leaves band 2 with no Dragon move, band 4 with no Bug move and band 5
with no Dark move. `test/data-tables.test.ts` required every band to hold all 18
types; that requirement is now false and no cut makes it true without moving an
edge into a dense part of the dex and reclassifying dozens of moves to rescue one.

The test asserts what is true instead: every band non-empty, at least 15 of 18
types, and **this exact set of gaps**. A fourth gap fails it and so does closing
one of these. A species of those types drawing that band loses STAB for that slot
and takes open coverage — the same trade accepted for Psychic below.

### 33.4 Deterministic Confusion, accepted

With the window closed, Psychic holds exactly one band-1 move. Every Psychic
species' forced first slot is Confusion, deterministically — the defect
`stabWindow` was added to fix, reintroduced knowingly. Steel has two band-1 moves
and Fairy three, all one category.

The user's ruling, in full: *"yes accept the deterministic. psychic is a strong
typing and needs investment to win."*

### 33.5 The first external reference the ramp has ever had

[`reports/moveset-pool-validation.md`](reports/moveset-pool-validation.md) records
that this project ships no learnsets and that this is permanent. True of the
*game*; it does not stop the dex being read at analysis time, and this patch is
the first to do it.

Gen-9 level-up learnsets for all **900 pool species** (0 failures), pre-evolution
chains walked, scored as the four most recently learned damaging moves — what a
nuzlocke Pokemon actually carries. All eight `moveBandWeights` rows are fitted to
that table. They had to be rewritten regardless: the old band 3 (76-95) splits
across the new bands 3 and 4, so every row meant something different than it did.

The measurement says two things the old table got wrong in opposite directions.
The opening weights were already about right — real games give 58/18 at level 15
against a written 80/20, and the 61/34 measured was the leak, not the table. And
the back half was the under-specified end: real gym 8 is 38% top-band and the old
table had no top band to give. Segment 7 is the first row whose modal band is the
ceiling, so gym 8 draws and pays band 5.

### 33.6 The curve, and the two goals the dex will not give

`playerLevel` went `7, 14, 20, 27, 33, 40, 47, 55` to `15, 20, 26, 32, 38, 44, 50, 58`.

Emerald pace rather than Kaizo pace, stretched. Vanilla Emerald's gyms are 15, 19,
24, 29, 31, 33, 42, 46 and its Champion is 58. Gyms 1 and 2 are taken from that
list; the middle is stretched because Emerald's own is flat — 29, 31, 33 across
three gyms — while the dex's final-evolution mass sits at 30 to 36 with a median
of 35, so the vanilla curve parks under the entire cluster and shows the player
nothing for three gyms. Measured over the starter pool, verbatim Emerald reaches
38% fully evolved by gym 6 where the stretched curve reaches 89%.

Gym 8 takes the Champion's 58 rather than the eighth gym's 46, for two reasons: it
is this game's final fight, and at 46 no pseudo-legendary line could ever finish.

**Two stated goals are missed and recorded rather than chased.** "First evolutions
by gym 2" reaches 20% — dex stage-1 levels cluster at 16 to 30 and a majority needs
gym 2 at about 26, which makes the opening a sprint. And Tyranitar and Dragonite at
a *real* dex 55 finish at gym 8 rather than gym 7; `evolutionThresholds.ts` may not
raise a real dex level, and the Dragon gym is arguably where they belong.

One synthetic moved: **Alakazam 55 to 50**, the only one the curve stranded. Gengar
(50), Machamp (50) and Golem (42) already land by the gym 7 fight.

### 33.7 Raising levels sharpens the early swing; it does not soften it

Recorded because the patch's own framing had it backwards until the report
measured it, and because the next reader will assume the same thing.

The damage formula's level term is `floor(2L/5) + 2`, which doubles from 4 to 8
between level 7 and level 15. Median starter HP grows from 26 to 44, a factor of
1.69. Damage outgrows HP, because the flat `+10` in the HP formula dominates at
very low level and stops mattering by 15.

Chance a STAB super-effective hit one-shots, per damaging slot, over every
drawable move and every starter-pool defender:

| config | rate |
|---|---|
| before, gym 1 at L7 | 14.2% |
| gym 1 at L7, new cuts, window closed | **11.3%** |
| after, gym 1 at L15 | **22.3%** |

The band work did what it was asked to do and the level raise undid it and more.
**The curve is justified on evolution pacing and on nothing else.** Neutral-damage
OHKO rate is 0.0-0.6% at every level and config, so all of the swing is
super-effective hits — which is ordinary Pokemon, and the one forecast the UI is
already allowed to show.

**And then the benchmark said the opposite, which is why it is the benchmark.**
Against the pinned `greedy` baseline at 400 seeds, gym 1 clears **56.4%** — up
from 48.3% at `randomizer-18` — and mean gyms goes 0.545 to **0.56**.

A wrong number was carried for part of this patch and is corrected here rather
than quietly dropped: an interim 120-seed run was read off the `ladder` policy's
*first* sample, which is `random`, not `greedy`. `random` clears gym 1 at 22.7%
and always has; the baseline every row in `balance.md` is read against is
`greedy`, and reading across them is the "read down a prefix, never across" rule
failing in a new direction.

So the arithmetic above stands — the per-slot one-shot rate really does rise —
and the outcome does not follow it. The closed window is why. Gym 1's measured
band mix is now **83% band 1, 17% band 2, no band 3**, against the 61/34/5 the
leak was producing; a player facing fewer band-2 and no band-3 moves wins more
often even though each individual super-effective hit is likelier to one-shot.
The two effects are not the same measurement, and only one of them is the game.

Gym 1 fields **0% evolved forms** and its mean `specPower` matches the starter's,
so the widened stage gate is not doing anything either way.

The user's standing ruling on clear rate, given before these numbers arrived:
*"don't worry about your clear rates... the game was too easy in a prior case and
average gyms was 3, and I was clearing all 8 consistently. the slay the spire
comparison only is apt if it's genuinely difficult but gives tools to a player
(read: real strategist) to progress non-trivially."*

### 33.8 A superseded rule: the gym offer is no longer strictly better than elite

`rewardPools.ts` stated that a gym offer must be strictly better than an elite
node's, and `GYM_MOVE_ENTRY` resolved at `elite` to pay for it: the segment's band
plus `REWARD_BAND_OFFSET.elite`'s +2 plus `GYM_MOVE_BAND_BONUS`'s +1. At segment 0
that clamped to the ceiling, and **300 gym-1 clears out of 300 handed the player a
band-4 move** — Fire Blast, Cross Chop, Sacred Fire, Overheat — at level 14. The
largest single swing in the opening, on the player's side.

**The rule is deleted from the lineage, not weakened.** It was measuring the wrong
axis. The replacement argument, in the user's words: *"gym already pays +1 move and
relic/gold, which is strictly better than +2 move. elites are also just the move,
while gyms also unlock a level up to the next tier. elites being better
rewards/harder than a gym is also not terrible. the player makes that decision
going in."*

So a gym clear is **two pages of three**: three distinct moves at the segment's
band +1, then three distinct relics-or-gold. `GYM_OFFER_SIZE` went 2 to 3, which
retires the Stage 4.8 item 2 Part B exception recorded in section 7c — the third
card on the item page is a second distinct relic rather than the padding that
exception was avoiding. CLAUDE.md's rewards invariant (every offer is exactly three
distinct options) now holds on both pages where it held on neither.

Bands paid, by gym: 2, 2, 3, 4, 4, 4, 4, 5.

### 33.9 Why `RUN_LOG_VERSION` moved, and the decline that survived it

The gym's grant became a question, so a gym node records **two** `reward` entries
where it recorded one. No decision *kind* was added — the replay cursor is
positional and kind-checked, so the pair needs only a fixed order — but the
sequence a gym writes is one entry longer, and a `-17` log replayed here would read
its gym `reward` as the move page and then run out of step at the card.

`playRun` also stops handing the review screen a gym's cards. Every other node
answers its one offer there; a gym would otherwise answer page 2 before page 1 was
asked, so `reviewOffer` is null for gyms and both pages go through `chooseReward`.
`test/result-screen.test.ts` asserts that exemption rather than tolerating it.

The `DECLINED_MOVE` sentinel survives with a **rewritten justification**. Its old
argument — that a gym move is unconditional, so refusing it is the first and only
escape hatch — is dead, because the move is now chosen over two others, which is
exactly the condition `chooseMoveToReplace` cites when it refuses a decline of its
own. What replaces it: an ordinary reward node offers a move *against an item or a
relic*, so declining spends the card elsewhere; a gym move page offers three moves
and nothing else, the relics being on the next page and already guaranteed. A
player whose four slots all work has no "take the other thing" answer on the page
where the question is asked. This is that answer.

### 33.10 Two tests were passing for the wrong reason

`test/banding.test.ts` asserted the gym move-band spike at segment 0, where
`gymMoveBandBonus` returns 0 and there is by definition no spike. It passed because
the STAB window was leaking a band above whatever the slot drew. It also measured
one seed, and a segment-0 gym fields two Pokemon with band 2 at a fifth of the
weight, so "this seed drew no band 2" was a one-in-four coincidence. It asserts
across the seed list now, and asserts the *absence* of a spike below
`GYM_MOVE_BAND_BONUS_FROM_SEGMENT`.

The starter ceiling in the same file derives from `MOVESET.stabWindow` rather than
restating it, which is why it survived the window opening and closing without a
third rewrite — and it now asserts the closed case (nothing above band 1) as well
as the open one.

### 33.11 Seed-pinned tests, and the one that could not be re-seeded

The pattern section 31.5 records — search a seed list, assert the search found
something — covers `capture`, `lead-selection`, `move-replacement` and `party`.

`test/evolution-run.test.ts` could not be fixed that way and says so. **Nothing in
400 seeds reached a branching evolution**: only 14 species in the pool fork at all,
and a run has to be holding one when a gym clear crosses its threshold. It uses a
**pacifist opponent** now — the idiom `test/party.test.ts` already uses for its
full run, on that file's own argument that whether the game is winnable is
`npm run sim`'s question and what this file tests is the plumbing. Its replay needed
the opponent handed to it too: a `RunLog` records the player's decisions and nothing
about the bot across from them, so replaying a pacifist run against the default
opponent runs out of step at the first reward that is no longer there.

### 33.12 A contrast defect the recut exposed

`test/visual-chips.test.ts` found the `STAB` flag chip at **4.36:1** against a
green locale tint, under `displayTuning.minChipContrastRatio`'s 4.5. The flags
strip is the one place a chip sits on the locale-tinted battle stage rather than a
panel, and the seed the sweep walks reaches that tint now and did not before — so
the pairing had never been sampled.

**The defect predates this patch and was exposed by it**, the same shape as section
32. `.flags .chip` takes full cream instead of the dim default. Every flag moves
together, so the Release C rule the strip holds is untouched: a kind is still
identical to every other kind within a side, and `[data-side='p1']` is still the
only thing that distinguishes them.

`docs/visual/baseline/heights.json` was re-minted. `decisionCount` is unchanged on
every guarded screen and every budget still holds — battle's decision bottom at 708
and the map's at 687.6, both under the 740 fold line — so the movement is seed
drift in the pixels rather than a layout change.

### 33.13 The gate, and the one line in it that is not a pass

`npm run check` exits 0: lint, typecheck, the full suite, the WebKit browser leg
and strict trim. **136 files, 1807 tests, all passing.** `npm run build` and
`npm run smoke` pass, and smoke still walks `SMK49-2` — the seed whose header
records five predecessors retired by exactly this kind of bump did not need a
sixth.

Vitest also reports `Errors 1 error` on the strict-trim leg, and it is recorded
here rather than left for someone to rediscover. The error is
`[vitest-worker]: Timeout calling "onTaskUpdate"` — the reporter's IPC channel
timing out on a 12-minute run, with no assertion behind it and no test file
marked failed. It first appeared on a diagnostic run made *concurrently* with the
smoke browser walk, which flagged a file as failed; run alone the file count is
136 of 136 and the error survives as a bare warning. Vitest's own message says an
unhandled error "might cause false positive tests", so the claim being made here
is narrow: the suite is green on two independent runs, and this line is
infrastructure rather than product. If it starts appearing with a file attached,
that is a different finding.

The benchmark is `RETUNE`, 400 seeds, `ai-6-spent-item` pinned — 0.56 mean gyms,
0% completion — and the row in [`balance.md`](balance.md) carries what it means
and what it cannot see.
