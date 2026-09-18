# Patch: the R19 overnight playtest — five items

Filed 2026-09-18 on `claude/party-check-mantyke-anorith-xttrxm`, **before any
work on any of them**, per [`README.md`](README.md) rule 7. Nothing in this file
has been built.

A playtest report in five messages, filed as written. It arrived during the
update-sequence audit session and is **not** part of that patch: every item here
is a gameplay or data change, where that patch is presentation and observation
only.

---

## The build these are against, and why it matters

Every screenshot is stamped **`a036d6` · R19**. The session that received them
was working on a clone whose `contentHash` was `94c6c1` and whose
`RANDOMIZER_VERSION` was R18, and whose `origin/main` was `379c154` — **behind
the reported build**, with `git fetch` failing on a connection reset for the
first few attempts.

**That is resolved**: `origin/main` was fetched at `32dad08` and merged, and the
merged tree's `contentHash` is `a036d6` — the build the screenshots are stamped
with. Item 4's diagnosis below is read against that tree; items 1 to 3 were
first read against R18 and are marked where that still shows.

That is recorded here rather than worked around, because it changes what can
honestly be said about each item. Item 4 in particular describes a TM sitting in
an *inventory*, and in this clone a shop TM is taught at the moment of purchase
through `askMoveQuestions` — there is no TM item and no teach screen to click
out of. Diagnosing it against this tree would be diagnosing different code.

**So every diagnosis below is marked as either checked against R18 and
carried over, or as awaiting the newer tree.**

---

## Item 1 — two coin cards in one offer, and a blank relic card

> One more bug the gym reward offers 2 golds which shouldnt be possible. Put an
> item option there, whatever would be comparable to the move like a good one.
> And we should add the ability to put items on gym mons

Screenshot: [`assets/r19-playtest-duplicate-coin-cards.png`](assets/r19-playtest-duplicate-coin-cards.png).
`SHORE`, `1 / 8`, "CHOOSE A REWARD — one of the three. There is no skip.",
`TAKE ONE` `ELITE`, then three cards:

| card | label | body |
|---|---|---|
| 1 | `RELIC` | **blank — no name, no description** |
| 2 | `COINS` | 159 coins · "You are carrying 34." |
| 3 | `COINS` | 150 coins · "You are carrying 34." |

**This violates a `CLAUDE.md` invariant**: "Every offer is exactly 3 distinct
options."

Two things are worth separating, because the report names one of them.

**a. The duplicate. Root-caused and measured on the merged tree.**

**It is the relic fallback, and the problem is bigger than the report.** Every
relic card carries a `fallback` drawn by `resolveRewardEntry` from
`pool.filter(kind !== 'relic')`, and `resolveOffer` collapses onto it when the
run already holds the relic. **That fallback is drawn with no knowledge of the
other two cards on the table**, so it can land on a kind already there.

Scanned 18,000 generated offers across three tiers and five segments, resolved
against a run holding every relic:

| | offers | share |
|---|---|---|
| three distinct kinds | 14,956 | 83.1% |
| a repeated kind | **3,044** | **16.9%** |

Broken down: `item` 1,674, `tutor` 729, `heal` 528, `technique` 60,
**`currency` 53**.

**Most of that is not a defect.** Two `item` cards are two *different* items —
`takenItems` guarantees it, `NORMAL` deliberately carries a berry entry and a
type-item entry, and a Leftovers against a Charcoal is a real choice. Same for
two move cards, which `takenMoves` keeps distinct. Those are "distinct options"
in the sense `CLAUDE.md` means.

**The defect is the fungible kinds**, where a second card is the same decision
with a different number on it: `currency` (53, the reported screenshot) and
`heal` (528, and strictly worse — two identical full heals). Both come from the
relic fallback and only from it; a pool never holds two `currency` entries, so
without-replacement drawing cannot produce the reported card pair on its own.

Worked examples from the scan:

```
elite seg1: [relic, tutor, heal] → [tutor, tutor, heal]
elite seg3: [item,  tutor, relic] → [item, tutor, item]
elite seg7: [tutor, relic, heal] → [tutor, heal, heal]
```

**Fix direction, and the constraint on it.** The information needed is available
where the cards are drawn — `generateRewardOffer` has all three — but the
fallback is currently computed per entry inside `resolveRewardEntry`, before the
other cards exist when the relic is card 0. So the fix is either to re-draw a
relic's fallback after the loop, excluding kinds already on the table, or to
resolve the relic entry last. **Either changes draw order and therefore moves
`RANDOMIZER_VERSION`** — the eager-generation contract means a fallback must
still be decided at map generation and consume no RNG at resolution.

The report's own ask fits here cleanly: making the fallback prefer an `item`
entry over `currency`/`heal` both removes the duplicate and puts "a good one"
in its place, which is what was asked for. Which item list, and whether the
preference is a hard rule or a weight, is the tuning call.

*(Superseded first reading, kept because it was wrong in an instructive way:*
checked against R18, It is not a gym offer: a gym pays
`GYM_OFFER_SIZE = 2` cards from a two-entry pool (one relic, one currency), and
this screen says three and badges `ELITE`. It is an elite *node*. The elite pool
has exactly one `currency` entry and `generateRewardOffer` draws entries
**without replacement**, so two currency entries cannot both be drawn — which
means the second coin card is not a second currency *entry*. The likely
mechanism is the **relic fallback**: `resolveRewardEntry` gives every relic card
a `fallback` drawn from the pool's non-relic entries, and `resolveOffer`
collapses a relic the run already holds onto that fallback. A fallback that is
`currency`, beside the pool's own currency card, is two coin cards from one
draw. Unverified on R19.

*— end of the superseded first reading.)*

**b. The blank relic card.** Not mentioned in the report and possibly the same
defect seen from the other side: `describeReward` returns
`relicById(reward.relic)?.name ?? reward.relic`, which cannot render empty — so
a blank card means the screen is drawing something other than a resolved relic
reward. Worth fixing whatever item 1a turns out to be.

**What is asked for**: the duplicate becomes an item option, "whatever would be
comparable to the move, like a good one". `PREMIUM_ITEM_IDS` and
`CHOICE_ITEM_IDS` are the two lists the elite pool already draws from and are
the obvious source; which of them, and at what weight, is a tuning call the
build should put back to the author with a measurement rather than guess.

**Second request in the same message**: gym leader Pokemon should be able to
hold items. A separate feature, touching gym definitions and team generation,
and it moves `contentHash`.

## Item 2 — wild encounters should not swap optimally

> Also wild encounters shouldnt be able to swap optimally. They should swap
> randomly, with no knowledge of the opponent. Different ai.

Awaiting the newer tree for the exact shape, but the seam is known and is the
same in R18: `tieredOpponentFor` in `core/run.ts` reads `aiTierFor(node.kind,
node.tier, segment)` and `data/ai.ts` holds the table, so "a wild node plays a
different policy" is a table entry plus a policy, not a special case in the run
loop — which is what `docs/generation.md` section 13 built that table for.

It moves **`AI_VERSION`**, and by the standing policy in `balance.md` section 0
it wants a benchmark row on mean gyms cleared rather than a retune.

The design question the build must not answer on its own: "no knowledge of the
opponent" is stronger than "random". A wild Pokemon that switches at random will
sometimes switch into a Pokemon that is about to be knocked out, which is a
different game from one that never switches — and the report says *how* they
should swap, not *how often*. Whether the swap rate stays where the tier table
has it is the author's call.

## Item 3 — status moves are underpriced

> Also these status moves are way underpriced. They should be around the same
> value as a +2 band move or a relic, maybe less than a relic.

Screenshot: [`assets/r19-playtest-status-move-pricing.png`](assets/r19-playtest-status-move-pricing.png).
`MARSH`, `3 / 8`, carrying 190:

| shelf | item | price |
|---|---|---|
| `BATTLE MOVE` | TM: Mystical Power — Psychic, Special, 70 BP, 90 acc | **95** |
| `TECHNIQUE` | Technique: Leech Seed — Grass, Status | **81** |
| `BERRY` | Occa Berry | 34 |
| `RESTORE` | Restore 50% | 54 |

The target is stated as a range rather than a number — "around the same value as
a +2 band move or a relic, maybe less than a relic" — so the build derives it
from the existing price table rather than inventing one, and reports the number
it picked. Moves `contentHash`.

`generation.md` section 31 is the relevant history: status moves were
**structurally unreachable** before that patch (all four routes that hand the
player a move called `damagingInBands`), so this is the first playtest in which
their price has ever been visible.

## Item 4 — teaching a TM does not stick

> Alsk bug report: teaching tms doesnt work. When i click out of the teach
> screen, the tms return to inventory. Check on that

**Reproduced, root-caused and fixed.** The two candidates filed here first —
"the copy is wrong" and "a completed teach is not sticking" — were both wrong,
and they were guesses rather than measurements. The report named a rest and the
reading did not go there. `generation.md` section 40 is the account.

**The mechanism was never broken.** `applyItemPlan` teaches, `reconcileItemPlan`
keeps the teach, and all three screens fire their callbacks. Driven end to end
through `playRun` over 300 seeds, **56 of 56** composed teaches landed on the
member the plan named; the party, target and replace screens were each driven in
jsdom and each behaved.

**What was wrong is where the control was offered.** `run.canTeachNow` reads the
node the run has just walked, and stays true for the whole time the player then
stands on the map — so the map's Manage button showed a Teach control after
every rest and every shop. The plan it composes is not spent there: it is held
in `pendingPlan` until the boundary of the node walked *next*, where
`canTeachNow` reads that node instead. Walk into a fight and
`reconcileItemPlan` drops the teach, correctly by its own rule and silently, and
the TM is back in the bag.

Measured, scripted baseline, 400 runs: of **111** teaches composed from the map,
**9** survived and **57** were dropped (the rest never reached another boundary
before the run ended). A control that works 8% of the time is worse than one
that is not offered.

`chooseItemPlan` already described the fix in its own comment — "the screen
opens here, where composing and spending are the same moment" — and opened the
screen at the boundary. It just never stopped the other route offering the same
control. `atTeachBoundary` now gates it, and `test/teach-boundary.test.ts` pins
it. The browser smoke run still reaches the target and replacement screens, so
the route that works is untouched.

### The larger finding, which is not fixed

**A TM is spendable in 13% of runs.** Same 400-run scan, with a policy that
never teaches so the TM stays in the bag:

| | |
|---|---|
| runs that ever hold a TM | 174 (43.5%) |
| runs that ever reach a boundary where one can be spent | **53 (13.3%)** |
| boundaries holding a TM where teaching was legal | 74 of 687 (10.8%) |

So roughly seven in ten runs that earn a TM never get to use it. That is not a
defect in any one function — teaching is legal at a rest or a shop
(`run.canTeachAt`), and most runs die before reaching one while holding a move.
`scripts/smoke.mjs` hit the same wall from the other side: its seed had to be
re-chosen at the inventory-TM merge because the old one "stopped reaching a rest
while holding a TM", and four of the five best candidates died on node 1 or 2.

**Filed as a design question, not fixed.** Widening `canTeachAt`, letting a
teach wait for the next legal boundary instead of being dropped, or paying TMs
closer to rests are all answers, and they are balance decisions rather than bug
fixes.

## Scope, for whoever picks this up

Five items, none built. Item 1a is an invariant violation and is the only one
that is unambiguously a bug with a right answer; 1b is an unreported defect
found in the same screenshot; item 4 is a bug whose code this clone does not
have. Items 1's second half, 2 and 3 are changes with a tuning or design call
inside them, and each names the call rather than pre-empting it.

Axes: item 1 and item 3 move `contentHash`; item 2 moves `AI_VERSION`; items 1's
second half and 4 are unknown until the newer tree is in hand.
