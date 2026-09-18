# Moves as inventory TMs

Filed 2026-09-17 on `claude/gym-2-reward-check-2prefx`, before any work.

A playtest thread in three messages, filed as it was written. It opens as a
question about one reward, widens into a defect report about the decline, and
ends by replacing the fix that was on the table with a different design. All
three are verbatim below, with the two screenshots transcribed, because the
last message only makes sense as an answer to the first two.

**The brief arrives as an answer to a picker question, not as a brief.** The
question offered three ways to handle a declined shop TM and the author took
none of them, which is the part worth keeping: the decline was the wrong frame,
and the reason given is that a discarded move is a decision with nothing on the
other side of it.

---

## 1. The first message, verbatim

> Report: is this supposed to be reward for gym 2?

### The screenshot it arrived with

iPhone, 17:31, `pocket-randomizer.vercel.app`, stamped
`GYMRUN-94c6c1-2LXMR82Q`, `0.3.0 · R18`.

Header reads `MARSH` on the left and `1 /` on the right (cut off by the seed
drawer's pull tab). Screen title `TUTOR: DYNAMAX CANNON`, blurb *"Who learns
it? You choose what it replaces next."*

Move card: **Dynamax Cannon**, `DRAGON`, `SPEC`, `100 BP`, four filled band
pips, `⊙100`, `PP 8`, an `EXPLAIN` control.

Two recipient cards, both at full HP:

- **Doduo** `Lv7`, `PHYS. ATTACKER`, `NORMAL` / `FLYING`, `NEUROFORCE`,
  24 / 24 HP.
- **Oshawott** `Lv7`, `MIXED ATTACKER`, `WATER`, `MULTITYPE`, 26 / 26 HP.

Both carry *"Knows four moves. You choose which one Dynamax Cannon replaces."*

Below them: **Don't learn it** — *"Nobody learns this move. It is not offered
again."*

## 2. The second message, verbatim

> Also you still cant refuse a new move. This was a reward from a ? Event.
> Check on all learn move screens there should be a decide not to learn button
> like from gym rewards

### The screenshot it arrived with

Same build and stamp, 17:36, five minutes after the first.

Header reads `CITY` on the left and `2 /` on the right. Screen title
`TM: WATER GUN`, blurb *"Who learns it? You choose what it replaces next."*

Move card: **Water Gun**, `WATER`, `SPEC`, `40 BP`, one filled band pip,
`⊙100`, `PP 40`, an `EXPLAIN` control.

Two recipient cards, both at full HP:

- **Riolu** `Lv14`, `PHYS. ATTACKER`, `FIGHTING`, `TRACE`, 39 / 39 HP.
- **Deino** `Lv14`, `PHYS. ATTACKER`, `DARK` / `DRAGON`, `WELL-BAKED BODY`,
  42 / 42 HP.

Both carry *"Knows four moves. You choose which one Water Gun replaces."*

**No decline control.** That absence is the report.

## 3. The third message, verbatim

> No. We just did a revamp of rewards. Look for the latest commits

---

## 4. The question put to the author, and the answer

Asked before any code, because the shop is the one route where a decline costs
the player something they already paid for, and the three readings of it lead
to different work.

**Question.** *A shop TM is the one route where declining costs coins. What
should happen there?* Three options were offered: decline with no refund,
decline with a full refund, or no decline in the shop at all.

**Answer, verbatim:**

> more true to the game, the move should be put into the inventory as a TM,
> instead of discarded. this creates a now vs later decision making more akin
> to deck builders. in fact, every move offered should take up inventory space,
> and the player needs to decide what takes precedence in the inventory. more
> good tms for the late game or more optionality with items now. this is a
> bigger lift, but worth it

**None of the three options was taken, and that is the brief.** The decline is
withdrawn as the fix. A move that arrives is not taught at the node and is not
thrown away at the node: it becomes an object in the backpack, competing for
the same finite space as held items, and the player decides later who learns it
— or never teaches it and carries something else instead.

---

## 5. The second question, and the answer

Asked after the plan was drafted and before any code, because when a banked TM
may be spent decides both the log shape and whether the carry is a real cost.
Three options were offered: any node boundary, rest and shop nodes only, or gym
clears only.

**Answer, verbatim:**

> rest and shop nodes only PLUS, TMs replace a move, not displaces it into the
> inventory. they're one-use only, if that was not explicit

Three rules, and the second was not in the question:

1. **Rest and shop nodes only.** A TM cannot be spent at an arbitrary node
   boundary. The bag is a bank and those two node kinds are the counter.
2. **A replaced move is destroyed, not banked.** Teaching over a move does not
   hand its predecessor back as a TM. This closes the loop that would otherwise
   make the inventory a free move buffer — carry four, rotate them per fight —
   and it is the reason the carry decision has teeth.
3. **A TM is consumed by teaching it.** One use. This was assumed in the draft
   plan and is now explicit.

## 6. What this replaces

**The gym-only decline rule, and the argument under it.** `docs/README.md`
states it as *"A gym's guaranteed move may now be declined, and nothing else
may"*, built at `7829062`, on the reasoning that a gym's move is the one taught
move the player never chose over alternatives. The reasoning was sound for the
shape the game had. It does not survive this brief: under a TM inventory no
move is taught at the moment it arrives, so there is no question at that moment
to decline, and the decision the decline was standing in for — *is this move
worth a slot* — is asked of every move by the capacity rule instead.

`DECLINED_MOVE` and the `allowSkip` overloads on `askMoveQuestions` are
therefore in scope to be retired rather than extended, which is the opposite of
what the second message asks for. That is a deliberate supersession by the
third message and the answer, not a dropped item.

## 7. Named non-goals

Neither of these is asked for anywhere above, and both are the obvious places
scope would leak to:

- **The band a gym clear pays.** The report that opened this thread found that
  `GYM_MOVE_ENTRY` resolves to band 4 at every segment from gym 1 onward,
  because `segmentMoveBand + REWARD_BAND_OFFSET.elite + GYM_MOVE_BAND_BONUS`
  clamps at `MAX_MOVE_BAND`. That is a live finding and it is **not** this
  stage's to fix; it needs its own brief and a benchmark. Recorded here only so
  the next session does not rediscover it as part of this work.
- **What a TM costs in a shop.** Prices are `data/shop.ts` and a tuning pass,
  not a design change.
