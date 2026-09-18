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

**a. The duplicate.** Checked against R18. It is not a gym offer: a gym pays
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

**Read on the merged tree, and it does not resolve to one cause.** Two
candidates survive reading, and they call for different fixes, so neither was
acted on.

**Candidate A — it is behaving as designed and the copy is wrong.** The teach
path renders `targetScreen` with `allowSkip: true`, and that screen's only exit
is the decline control, whose copy is `TARGET_COPY.decline` — **"Don't learn
it"**. That string was written for a different question: the gym's guaranteed
move, the one payout that may be handed back. On this path it means "not this
one, not now" and `app.ts` says so in a comment — the TM stays in the bag, by
design. So a player who reaches the screen, changes their mind about *which*
Pokemon, and presses the only control that leaves gets exactly the reported
sentence, and nothing is broken except that the only way back is spelled as a
refusal.

**Candidate B — a teach that was completed is not sticking.** Traced and not
found: `onTeach`'s `done` pushes onto `teaches` and calls `commit`, which is
`handlers.onPlan`, which sets `pendingPlan`; `back()` re-renders through
`showParty`, which passes `plan: pendingPlan`, and the re-render recomputes
`carried` as `remaining(view.tms, teaches ∪ discardTms)` — so the TM should
leave the bag panel and stay gone. `canTeachNow` gates the button, not the
commit, so a teach composed where it is illegal cannot be silently dropped
either.

**What would settle it in one message**: a screenshot of the teach screen
itself, or the answer to "did you pick a Pokemon before the TM came back, or
did you leave without picking one?" If the answer is "left without picking",
this is Candidate A and the fix is copy plus a separate Back control. If it is
"picked one and it still came back", it is Candidate B and the trace above is
wrong somewhere worth finding.

## Scope, for whoever picks this up

Five items, none built. Item 1a is an invariant violation and is the only one
that is unambiguously a bug with a right answer; 1b is an unreported defect
found in the same screenshot; item 4 is a bug whose code this clone does not
have. Items 1's second half, 2 and 3 are changes with a tuning or design call
inside them, and each names the call rather than pre-empting it.

Axes: item 1 and item 3 move `contentHash`; item 2 moves `AI_VERSION`; items 1's
second half and 4 are unknown until the newer tree is in hand.
