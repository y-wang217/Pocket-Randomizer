# Patch: Defender Mode, four design changes

2026-10-06, on `claude/affectionate-hopper-0beolc`, from `main` at `22fb781`,
after [`gymrun-patch-blank-abilities.md`](gymrun-patch-blank-abilities.md) on
the same branch. Filed **before any change to `src/`**, verbatim, as
[`README.md`](README.md) rule 7 asks. A design message in the author's words,
followed by the eight rulings the session asked for and received the same day.

---

## The message, verbatim

> also, trades don't look like trades. the trade should be a 'trade' offer with a questionmark mystery sprite icon, with the mons and a rotating two arrows to represend trade.
> there should be a special fight that contains all the mons you traded away.
> also, to balance against a single mon defeating your whole gym with a fast strong typing, allow the user to acquire non-typed mons, but make passives (gym badge the player holds) disabled once you add a non-typed mon, which the relic that allows non-typed mons reenables. make sense?
>
> also, i see very few ? event nodes now. was that a real change?
> also make ? event nodes possible to have any number of results, not just acquire something for a price. e.g. battle, make a decision, get something special, a special store, or a rest spot. could be a free relic on rare occasions.
>
> plan this design change to make it mimic slay the spire events. look those up so you know what the variety could look like.

## The rulings, verbatim

Asked and answered 2026-10-06, before the plan was written.

**Which mode were you in when you saw very few ? event nodes?**

> Defender Mode

**On the trade card, what does the question-mark mystery sprite hide?**

> mon received is a mystery. you choose that option to discard the others. then you choose to take the trade or not

**When should the fight against everything you traded away happen?**

> the special door in a later rank is nice. hidden inside an event is also good. beat him to get a reward per mon traded away

**Under the new rule, what does Stranger's Pass do?**

> Restores badges, lifts the cap (Recommended)

**Where do ? nodes sit in a defender rank?**

> Dedicated ? step

**At the trade's second step, is the offered mon revealed before you Take/Decline?**

> Revealed, then Take/Decline (Recommended)

**The two-arrows swap mark: a 15th glyph family or no mark?**

> 15th glyph family 'exchange' (Recommended)

**Where does the revenge fight live?**

> Rank 7's last door (Recommended)

## The session's reading

**"Very few ? nodes" is not a regression.** A defender run has no event
nodes at all (`data/defender.ts`: *"a defender run has no events"*;
`core/defender/waves.ts` emits doors, an intermission and a boss). The
attacker map's event weights have not changed since the first visible commit;
what thinned events there was the 2026-09-19 battle floor, which overwrites
extra drawn events before the event floor runs, and shorter runs. Recorded
here, out of scope.

**Four changes**, built in the order 4, 2, 3, 1, UI last, each recorded in
[`../generation.md`](../generation.md) sections 117 to 120:

1. **Defender ? nodes.** One dedicated ? step per rank from rank 1, before the
   intermission, always visited. Six shapes drawn at generation from a
   per-rank weight table: a dilemma (Big Fish), a gamble with stated odds
   (Wheel of Change), an ambush that offers a fight for the node's cards
   (Masked Bandits), a bazaar (Designer In-Spire), a shrine (Shining Light),
   a cache with a rare relic (Lab). Slay the Spire rolls the room's kind on
   entry with pity counters; this game cannot draw at entry, so the shape is
   drawn at generation and the counters are a weight table. Options log an
   index. The "an event is a node with no battle in it" sentence is deleted
   for this mode; section 14's Toll ruling stands, a paid option never
   containing a fight.
2. **The blind trade.** The received mon is a mystery on the card; picking
   the card forfeits the other two; a reveal step then shows the mon and
   asks Take or Decline, a new logged decision. A fifteenth glyph family,
   `exchange`, draws the two arrows. The leaving mon is recorded.
3. **The Collector.** Rank index 6's last door, side 1, becomes a hard-tier
   trainer fielding the traded-away mons (the six most recent, at the rank's
   level) once any trade has happened, and pays one three-card offer per mon
   fielded. An ordinary door otherwise.
4. **Off-type members.** The recruit draft always offers one off-type mon
   and the cap is deleted. While any off-type member stands in the party the
   badge is off for the whole team; the Stranger's Pass turns it back on.

Version axes: `RANDOMIZER_VERSION` to `-32`, `RUN_LOG_VERSION` to `-25`,
`contentHash` moves, `AI_VERSION` holds. Bible amendments D109 to D112 are
filed in [`../design/bible-discrepancies.md`](../design/bible-discrepancies.md)
before any surface is drawn.
