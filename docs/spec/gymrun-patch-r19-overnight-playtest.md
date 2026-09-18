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

**Superseded 2026-09-18.** Every item has now been re-read and re-measured
against the merged tree on `claude/blissful-brown-5tv8fv`, and the "awaiting the
newer tree" caveat no longer applies to any of them. Two first readings turned
out to be wrong — item 1's root cause and item 2's premise — and both are
corrected in place with the original kept beside them, per the `CLAUDE.md` rule
that a superseded rule is recorded rather than deleted. The summary table at the
bottom is the current state. **Still nothing built.**

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

**a. The duplicate. Re-measured, and the earlier root cause was wrong for this
screenshot.**

**This is not an elite node. It is a gym clear's second reward page.** Three
readings force it and they agree:

- The numbers. Elite currency at segment 1 is `62–95` against
  `currencyScaleFor(0) = 1`. The gym pool at the same segment is `110–165`.
  **159 and 150 are both inside the gym band and neither is reachable from the
  elite one.**
- The pool. `GYM` at `throughSegment: 2` holds exactly two entries — one
  `relic`, one `currency` — which is the card set in the screenshot and nothing
  else.
- The badge lied. `generateGymRewardOffer` returns **`tier: 'elite'`** on both
  pages, hardcoded, and `screens/result.ts` prints `tierBadge(offer.tier)`. So
  every gym reward page in the game badges `ELITE`. That is what sent the first
  reading to the elite pool.

The same arithmetic confirms the header: `3 / 8` on the Item 3 screenshot is
segment index 2, where `priceAt` scales by 1.35 and reproduces all four shelf
prices exactly. `1 / 8` here is segment index 0, scale 1.

**The mechanism is the gym page's own draw, not the relic fallback.** Page 2
draws `GYM_OFFER_SIZE` times **with replacement** — the entry is deliberately
not removed, which is the change that took `GYM_OFFER_SIZE` from 2 to 3 — over a
two-entry pool. Two currency draws are therefore not merely possible, they are
common. Measured over 4,000 seeds at segment 1/8, **holding no relics at all**:

| page 2 shape | share |
|---|---|
| `currency + relic + relic` | 43.3% |
| **`currency + currency + relic`** (the screenshot) | **26.3%** |
| `relic + relic + relic` | 25.0% |
| **`currency + currency + currency`** | **5.4%** |

**Roughly one gym reward page in three shows two or more coin cards**, and the
rate is flat across all eight segments (29.8%–32.6%). The relic fallback
contributes *nothing* to it until the run holds all ten relics: `concreteReward`
walks `alternates` first, so with 0, 1, 2, 3 or 4 relics held the duplicate rate
is identically 31.8%. At 10 of 10 it becomes **100%** — three identical coin
cards, every gym, forever.

**A second violation in the same draw, not in the report.** `resolveRewardEntry`
draws a relic as `shuffledRelics(RELIC_IDS, stream)` and consults **no** taken
set — `takenItems` and `takenMoves` do not track relics. The comment above the
page-2 loop says it "will not hand back a relic the page already holds"; the
code does not do that. Measured: **11.3% of gym pages offer the same relic on
two cards.** That is a harder reading of "three distinct options" than two coin
cards is — it is literally the same card twice.

For contrast, the elite *node* path is much healthier: two coin or two heal
cards appear in 8.8% of elite offers and **0.0%** of normal and hard offers,
and only once every relic is held.

*(The relic-fallback reading below was the previous session's and is kept: it
describes a real defect, it is the reason the elite figures above are not zero,
and it is not the defect in this screenshot.)*

**a-prime. The relic fallback, measured across all three tiers.**

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

**b. The blank relic card. Root-caused, and it is wider than one card.**

Not "the screen is drawing something other than a resolved relic reward" — the
screen has **no case for it**. `renderRewardCard`'s switch handles `item`,
`currency`, `heal`, `tm` and `tutor`. There is no `case 'relic'` and no
`case 'technique'`, so both fall through with `name` and `detail` left empty and
only the `KIND_LABELS` chip rendered. Driven through jsdom:

```
currency   label="Coins"      name="159 coins"    detail="Spend it at a shop, ..."
heal       label="Restore"    name="Full restore" detail="Heals HP and PP, ..."
tm         label="TM"         name="Ice Beam"     detail="A new move. ..."
technique  label="Technique"  name=""             detail=""
relic      label="Relic"      name=""             detail=""
```

So a relic card the player could actually take renders nameless, and **so does
every Technique card** — the elite pool carries one at weight 2 and it has been
blank since status moves became reachable at all (`generation.md` section 31).

`test/chip.test.ts` and `test/band-badge.test.ts` are the only tests that call
`renderRewardCard`, and both pass `{ kind: 'tm' }`. That is the coverage gap
that let two kinds ship unrendered.

This is a UI-only fix. It moves no version axis.

**What is asked for**: the duplicate becomes an item option, "whatever would be
comparable to the move, like a good one". `PREMIUM_ITEM_IDS` and
`CHOICE_ITEM_IDS` are the two lists the elite pool already draws from and are
the obvious source; which of them, and at what weight, is a tuning call the
build should put back to the author with a measurement rather than guess.

**Second request in the same message**: gym leader Pokemon should be able to
hold items. A separate feature, and it has its own section below — see **Item 5**.

## Item 2 — wild encounters should not swap optimally

> Also wild encounters shouldnt be able to swap optimally. They should swap
> randomly, with no knowledge of the opponent. Different ai.

**Measured on the merged tree, and the premise does not hold: a wild Pokemon
already never swaps.** This is the one item of the four with nothing to build,
and it needs a reply rather than a patch.

The chain, end to end:

- `aiTierFor('wild', tier, segment)` returns `'easy'` for every tier and every
  segment — `void segment`, one line, no exceptions.
- `EASY.flags` is `['avoidFailingMoves', 'crudeDamage']`. It holds neither
  `smartSwitching` nor `smartSendIn`.
- In `scoreChoices`, a voluntary switch without `smartSwitching` is scored and
  then set to `Number.NEGATIVE_INFINITY`. It is never chosen.
- `EASY.switchFailure` is `0` — there is no switch for it to fail.
- The game's own copy already says so. `AI_TIER_DETAIL.easy`: *"Reads base power
  and type matchups. **Stays in.**"*

Driven on a board built to make switching unambiguous — the wild side's active
is a Charizard facing a Blastoise, its bench holds a Jolteon that walls the
matchup:

| tier | best switch score | best move score | picks |
|---|---|---|---|
| easy | `-Infinity` | 0.40 | **move** |
| medium | 5.35 | −2.19 | switch |
| hard | 5.35 | −2.19 | switch |

`aiPolicy(AI_TIERS.easy)` called 500 times on that board: **0 switches.**

**So what did the playtest see?** There are exactly two routes left by which the
wild side's Pokemon can change, and neither is a choice:

1. **A forced send-in after a knockout.** Without `smartSendIn` this resolves
   through `sequenceSendIn`, which scores `-member.slot` — the next one in party
   order, the largest handicap in the table. A party-order send-in will
   sometimes look well chosen, and that is almost certainly what was seen.
2. **A pivot move.** There are none: `movePools.ts` contains no U-turn, Volt
   Switch, Flip Turn, Baton Pass, Parting Shot or Teleport. `Dragon Tail` and
   `Circle Throw` are in the pools, and both force the *player* to switch.

**The question back to the author**, in place of the design question the first
reading filed: which of those two was it, and is party order the "random" that
was asked for? Party order is not random — it is deterministic and, in
principle, learnable — but teams are regenerated per node, so there is nothing
to learn across fights. If the ask is literally a random send-in, that is one
new flag and a table entry and it moves `AI_VERSION`; if the ask was for wild
opponents to stop *choosing*, it is already built.

*(Superseded first reading, kept: the seam it names is correct and is where any
future change would go — `tieredOpponentFor` reads `aiTierFor`, so "a wild node
plays a different policy" is a table entry plus a policy rather than a special
case in the run loop. What it got wrong was assuming the wild tier switches at
all.)*

**Closed 2026-09-18, and the reading above is superseded in turn.** The
reproduction arrived
([`gymrun-patch-wild-encounter-swap.md`](gymrun-patch-wild-encounter-swap.md)):
a voluntary switch on turn 4 with nothing fainted, which is neither of the two
routes named above. The 500-call measurement is still correct and still
irrelevant — **`src/ui/app.ts` pinned `opponent: greedyAiPolicy`, so no tier was
ever played in the shipped game.** Every fight was `GREEDY_BASELINE`, which
holds `smartSwitching`. Both readings on this item asked what the wild tier
does; neither asked whether the app reads the table.
[`../generation.md`](../generation.md) section 47 is the account, per the
`CLAUDE.md` rule that a superseded reading is recorded rather than deleted.

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

**The screen is decoded exactly**, which pins which band the report is about.
`3 / 8` is segment index 2, inside `SHOP_STOCK` band 1 (`throughSegment: 2`),
and `priceAt(base, 2)` scales by `CURRENCY_SCALE[2] = 1.35`:

| shelf | base | ×1.35 | shown |
|---|---|---|---|
| TM (`bandOffset: 0`) | 70 | 94.5 | **95** |
| Technique | 60 | 81.0 | **81** |
| Berry | 25 | 33.75 | **34** |
| Restore 50% | 40 | 54.0 | **54** |

All four match. **So the number to move is the band-1 `technique` base of 60,
and its band-2 twin of 95.**

### Deriving the target rather than inventing one

Every base price the shop holds, both bands:

| | band 1 (seg 1–3) | band 2 (seg 4–8) |
|---|---|---|
| TM | **70** (`bandOffset: 0`) | **110** (`bandOffset: +1`) |
| Technique | **60** | **95** |
| Berry | 25 | 35 |
| Restore 50% / full | 40 / 85 | 60 / 120 |
| Item | 55 modest·type / 130 staple | 145 staple / 165 Choice |
| Relic | — | **260** |

A technique currently sits at ~86% of the same-shelf TM in both bands
(60/70 = 0.857, 95/110 = 0.864). That is the thing the report is calling wrong.

**The shop never sells a +2 band move at any price**, so there is no direct
anchor for the phrase. The only move-to-move price comparison the table offers
is the band-1 TM against the band-2 TM: `70 → 110`, a step of **+40 base per
band offset**. Extending that ladder by two steps:

| | band 1 | band 2 |
|---|---|---|
| TM at its shelf offset | 70 | 110 |
| **+2 bands above it** | **150** | **190** |
| Relic | — | 260 |

**Proposed number: technique base `150` in band 1 and `190` in band 2.** Both
are "around the same value as a +2 band move" by the table's own arithmetic and
both are "less than a relic", which is the range as stated. It is one edit to
two literals in `data/shop.ts` and moves `contentHash` only.

### Two consequences the author should price in before saying yes

1. **It takes the technique shelf out of reach early.** At segment 0 (scale 1.0)
   a technique becomes 150 flat, against `NODE_PAYOUT` of 8 for a wild fight, 14
   for a trainer and 40 for a gym. At the screenshot's segment 2 it becomes
   `150 × 1.35 = 203` against the 190 the player was carrying — just out of
   reach, which may be exactly right or may be a wasted row.
2. **The technique slot is guaranteed, not drawn.** `shopSlotsFor` returns every
   slot in the band, so `TECHNIQUE` is on every shelf. An unaffordable guaranteed
   row is a permanently dead slot rather than an occasional expensive one. If
   that is not wanted, the alternative is a smaller step (`+1` band, so 110/150)
   or moving the technique behind a weight rather than a slot — both are changes
   to the same file.

`generation.md` section 31 is the relevant history: status moves were
**structurally unreachable** before that patch (all four routes that hand the
player a move called `damagingInBands`), so this is the first playtest in which
their price has ever been visible. **And see item 1b** — a Technique offered as
a *reward card* currently renders blank, so the elite pool's weight-2 technique
entry has never been legible either.

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

## Item 5 — items on gym leaders' Pokemon

> And we should add the ability to put items on gym mons

From the same message as item 1. The first reading said "nothing measured, I
didn't investigate this one at all". Investigated now, and **it is the cheapest
of the four by a wide margin: the plumbing already exists and is already paid
for.**

`generateGymTeam` already passes `holding: { kind: 'gym', segment }` into
`rollSpec`, and `rollSpec` already calls `rollBerry` for anything with a
`holding`. `rollBerry` spends **both** of its draws unconditionally —
`stream.nextFloat()` for whether, `stream.pick(BERRIES)` for which — and only
then compares against the rate. Its own comment says why: *"retuning
`BERRY_HOLD_RATE` cannot move a single roll that follows it."* `generateGymTeam`
says the same from the other side: *"`holding` is passed even though a gym's
rate is zero, so a gym member costs the same draws as any other opponent and
**the table is the only thing deciding what it holds**."*

So a gym member is already drawing an item and throwing it away, every time, on
every seed. The only thing stopping it holding one is two lines in
`data/scaling.ts`:

```ts
export const BERRY_HOLD_RATE: readonly { trainer: number; wild: number }[] = [...]

export function berryHoldRate(kind: BattleKind, segment: number): number {
  if (kind === 'gym') return 0;        // <- this
  ...
}
```

**Turning it on is: add a `gym` column to the table, delete the early return.**
Both edits are inside `src/data/**`, so this moves **`contentHash` only** —
`RANDOMIZER_VERSION` does not move, because the draw composition is byte-for-byte
unchanged. That is not luck; it is the outcome the two comments above were
written to guarantee.

### The three calls the author still has to make

1. **Which items.** `rollBerry` picks from `BERRIES` and nothing else, so the
   one-number change gives gym leaders **berries only**. If the ask is held items
   in the wider sense — Leftovers, a type item, a Choice item — the pick list has
   to widen. That is still one `stream.pick` over a different array, so it stays
   one draw and stays `contentHash`-only, but it is a rename away from
   `rollBerry` and it needs a list per `BattleKind` rather than one shared
   `BERRIES`.
2. **Whether it scales by segment.** The existing table descends with segment
   (trainer `0.5 → 0.2`, wild `0.25 → 0.1`) because the player's own options
   widen. A gym column could descend with it, or hold flat, or *rise* — a gym is
   the segment's difficulty statement and the ladder already widens its roster
   and raises its move band, so rising is the one that matches the rest of the
   gym curve. No evidence either way; this is a taste call, and per
   `CLAUDE.md` it should be recorded as one.
3. **Whether it is revealed.** Already answered, and the answer is yes with no
   new rule: `tuning.revealOpponentItem` defaults to `true` and `ui/app.ts` feeds
   it straight into the battle view. A gym's held item sits *inside* that rule
   rather than beside it, exactly as the report asked — nothing to build.

### The one thing that has to move with it

`test/berries.test.ts` asserts `expect(berryHoldRate('gym', 3)).toBe(0)` under
the name *"gives a gym leader nothing to hold"*, and the file's own header lists
*"gyms hold none"* as rule 4. Both are the current rule written down, not an
invariant — but they are a **gate**, so the change is not done until they move
with it.

## Scope, for whoever picks this up

**Re-read 2026-09-18 on `claude/blissful-brown-5tv8fv`, against the merged tree.
Still nothing built.** Every item below was measured on this tree rather than
reasoned about; where the earlier reading was wrong it is corrected above and
the wrong reading is kept beside it.

| item | what it actually is | axis |
|---|---|---|
| 1a — duplicate coin cards | **Confirmed and worse than reported.** Not the elite pool and not the relic fallback: the gym page-2 draw is with replacement over a two-entry pool. ~31% of gym pages, 100% once all ten relics are held. Plus 11.3% show the *same relic twice*. | `RANDOMIZER_VERSION` |
| 1b — blank relic card | **Confirmed, and wider.** `renderRewardCard` has no `case 'relic'` and no `case 'technique'`. Both render label-only. No test covers either kind. | none (UI) |
| 2 — wild swaps optimally | **Not reproducible. The premise does not hold.** The wild tier holds neither `smartSwitching` nor `smartSendIn`; 0 switches in 500 calls on a board where medium and hard both switch. Needs a reply, not a patch. | none, unless the ask is a random send-in |
| 3 — status moves underpriced | **Confirmed.** Screen decoded exactly; a derived target of 150/190 base is proposed with its two consequences named. | `contentHash` |
| 4 — teaching a TM | Fixed in the previous session. The larger finding — a TM is spendable in 13% of runs — is still open and still a design question. | shipped |
| 5 — items on gym mons | **Cheapest of the set.** The draws are already spent and discarded; it is a table column and one deleted line, both in `data/`. | `contentHash` |

**The one hard blocker across all of it**: item 1a's fix moves
`RANDOMIZER_VERSION`, which by `CLAUDE.md` means every recorded seed is
reinterpreted and the mismatch must fail loudly. Nothing else here does. Items
1b, 3 and 5 are independent of it and of each other and can land in any order.

**Order these sort into, if the author wants one**: 1b first (no axis, pure
defect, unblocks reading a Technique card at all), then 5 and 3 together (one
`contentHash` bump between them), then 1a on its own with the version bump and a
benchmark row. Item 2 is a question, not work.

