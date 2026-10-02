# Patch: stats at rest, the map's later rows, the locale card as a peek

Filed 2026-10-01 on `claude/sleepy-dijkstra-tp2176`, **before any work on it**,
per [`README.md`](README.md) rule 7, with the three screenshots it arrived
with. Played against production, `0.3.0 · R22`, seed
`GYMRUN-715122-WD9RLYAL`.

The author's message, filed as written. The design bible outranks this prompt
on presentation; the message itself asks for the bible to be amended, and the
amendment is Rev 20 in the same PR as the code. Where the session had to read
the message rather than follow it, the reading is under it, and the
deviations are in [`../generation.md`](../generation.md).

---

## The message, verbatim

> quick feedback. the choose region should have the card be the peek into the map, and the text be highlighted with a semi opaque background to make readable.also the map buttons look awful. can we make the buttons nicer aethetically? and ideally hidden
> i can't see litten's stats in any page, including the team page. the stats should be visible in the team page and ideally in the battle screen too.
> map should hide future node's reward bands. show the node type shop/wild/etc, but not the sub heading, which will be revealed once it's time to make a decision in that node. more ui on the bag. the click to open sucks.
> bars suck. replace bars with the stat numbers proper.
> i know the bible says a lot of stuff.  amend a new rule that number of words must be limited as usual EXCEPT for vital information, of which the stats is key.
> ideally, the swap mon for a new mon screen highlights the stat change, green for increase, red for decrease.

Three images:

1. [`assets/r22-feedback-locale-screen.png`](assets/r22-feedback-locale-screen.png):
   the locale screen. Three locale cards (Summit, Forest, Ruins), each a name,
   four type chips and a thin strip of the map backdrop under them.
2. [`assets/r22-feedback-map-screen.png`](assets/r22-feedback-map-screen.png):
   the Forest map. Every node is a white disc with a black ring; under each
   later-row node a strip of tier pips, and on the two event nodes a
   capability glyph with its chevrons. The gym rail above the map scrolls
   with a visible scrollbar.
3. [`assets/r22-feedback-team-screen.png`](assets/r22-feedback-team-screen.png):
   the Team screen mid-fight. Litten's party row shows the name, level,
   gender, type chip and HP bar, and a `+` control; the six stats are behind
   the `+`. The bag is four empty slots and *"Read only."*

---

## The session's reading, before any code

The author did not take questions on this one. Each item below is how the
session read the message; a different reading is a new prompt.

1. **The new rule** is a carve-out from R2's word budgets, not a repeal: a
   fact the bible names *vital* is shown at rest, as numbers, on every surface
   that carries it, and is never counted against a budget. The stats are the
   first and only fact named vital today. The bars go (*"bars suck"*): the
   stat block is glyph and number, everywhere, at rest. R10's comparison rule
   stays, aimed at numbers rather than bars.
2. **Team screen and battle screen.** The party row's stat block is at rest,
   not behind the `+`. The battle screen's own panel (the player's side) shows
   the six numbers; the opponent's panel does not, because those numbers are
   not facts the player holds.
3. **The swap screen** is the capture card on a wild encounter swap. Each stat
   of the incoming Pokemon shows its signed difference against the Pokemon it
   replaces, green up, red down, nothing at zero. C1 reads this as an
   attribute (this number is larger than that one), the same reading section
   3 already gives the capture card's coverage plus and minus rows; section 9
   carries the bet.
4. **The map's later rows.** A node on any row but the one being chosen from
   shows its kind glyph and nothing else: no tier pips, no reward-tier pips,
   no capability chevron. **C2 holds by inspect, not by hiding**: the long
   press on a later node still opens the whole card. Removing the facts from
   the long press as well would be the first time the UI withholds a fact the
   run has already drawn, which is C2 and a CLAUDE.md invariant, and that is
   the author's ruling to make, not a reading.
5. **"The map buttons look awful ... ideally hidden"** is read as the node
   buttons: the white disc and black ring go, and the node is its glyph on a
   small soft token over the painting, with the disc's chrome shown only on
   the row being chosen from. The gym rail's scrollbar is hidden too.
6. **The bag.** *"The click to open sucks"* is read as the `+` fold
   (`ui/collapse.ts`) on the party screen's backpack rows, and the read-only
   bag's hotbar, whose cells say nothing until long-pressed. Both bags list
   each item at rest: sprite, name and effect line, with the party screen's
   give and discard controls on the row rather than behind the fold. A carried
   item's name and effect line are the second fact the session names vital;
   that is recorded as the session's reading in the amendment, not as the
   author's ruling, so a later ruling can take it back without touching the
   stats. The same fold on the party row goes from the stats (item 2); the
   moves and the contribution row stay behind it.
7. **The locale card** is the crop of its map backdrop, full-bleed, with the
   name and the type chips each on a semi-opaque plate over it.
