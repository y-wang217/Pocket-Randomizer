# Stage 5.1: band bars, the starter detail over the moves, a starter screen without a scroll

Filed 2026-10-01 on `claude/level-15-stat-bars-layout-s8s0ma`, from `main` at
`0d7b6e2` (PR #84 merged), **before any work on it**, per
[`README.md`](README.md) rule 7, with the two screenshots it arrived with. Played
against production, `0.3.0 · R22`, seed `GYMRUN-715122-DNCFGVFU`.

The author named this one: *"Make this 5.1"*. The design bible outranks this
prompt on presentation. Where the message asks for something the bible forbids,
the amendment is bible Rev 21, in the same PR as the code. The session's
reading, and the one question it asked, are below the message. Deviations go in
[`../generation.md`](../generation.md).

---

## The message, verbatim

> Im still not happy w the bars.
> Lets map the possible values for level 15 mons. And instead of marking out of 400 or whatever, mark it out of the band of possible values for that stat. Eg make it easy to see when a high hp target like munchlax has near max hp for a lvl 15 and the stats have boosted values based on nature and ivs right? It should hilight when we get a max iv with a gold and a red outline for nature + and blue outline for nature-
> I also dont like the scroll. Can we open the detailed stats as a thinner (less wide) menu
> Over top of the moves? So no scroll is needed
> And notice how 3 starters dont fit neatly on the page? Lets make it non-scroll as a goal overall
> Make this 5.1

Two images:

1. [`assets/stage5.1-starter-detail-scrolled.png`](assets/stage5.1-starter-detail-scrolled.png):
   the starter screen scrolled to the bottom. Oddish's card, and under it the
   full-width detail panel for Chinchou: six rows of glyph, a long blue bar and
   a number (HP 52, the rest 21 to 29, every bar short), then *Effective
   against* with eight type chips and *Vulnerable to* with two.
2. [`assets/stage5.1-starter-cards.png`](assets/stage5.1-starter-cards.png):
   the same screen at the top. Chinchou selected, Grubbin, and Oddish cut off
   by the fold. Each card is the sprite on a backdrop crop, the name, level,
   gender and type chips, the ability, and four moves on two lines each.

---

## The question asked before any code, and the answer

The message assumes natures and IVs (*"the stats have boosted values based on
nature and ivs right?"*). **They do not exist.** Every Pokemon in GYMRUN is
Serious with 31 IVs and 0 EVs (`src/core/battle/stats.ts`,
`toPokemonSet` in `src/core/battle/driver.ts`), so a max-IV gold mark would sit
on every stat of every Pokemon and a nature outline would never paint. Adding
them is a generation change (`RANDOMIZER_VERSION`, balance), so the session
asked whether 5.1 should add them, and with what IV range.

The author's answers, verbatim:

> build band bars, ignore iv and nature.

> ignore ivs

So 5.1 is presentation only: no `core/` generation change, no version axis
moves, no IV, nature or outline work.

---

## The session's reading, before any code

1. **The band.** For a stat at a level, the band is the lowest and highest
   value that stat can take on a Pokemon the randomizer may field at that
   level: the species pool filtered by `stageAllowedAt(level)` and the species
   blacklist, each base stat run through the same formula `stats.ts` uses.
   A bar is drawn from the band's floor (empty) to its ceiling (full), and the
   number stays beside it. At level 15 that puts HP at 32 (Diglett) to 86
   (Wobbuffet), and the author's Munchlax at 70, about 70% of the band. The
   band is read off the pool and the formula, so nothing is drawn, nothing is
   tuned, and no data table moves.
2. **"Mark it out of the band" is the bar's scale on every stat block**, not
   just the starter's. The bars were retired at Rev 20 (D82) and the stat block
   is one component (R1), so the bars come back everywhere the block is
   mounted, each at its own Pokemon's level. The production build the author
   played still drew the pre-Rev 20 bars against a flat ceiling (`main` had
   already removed them), and *"still not happy w the bars"* is about that
   ceiling. The number stays at rest beside every bar: R13 forbids a vital
   fact as a shape that cannot be read to its number, and a bar beside its
   number can be.
3. **The detail panel over the moves.** Selecting a starter opens its stat
   block and coverage rows as a panel over that card's move column, narrower
   than the full-width panel it replaces, so selecting never scrolls. The
   moves stay one tap away: tapping the selected card again flips the panel
   back to the moves (C2).
4. **No scroll as a goal.** The starter screen fits a phone viewport (390 wide,
   Safari's toolbars up, about 700 tall) with three cards, the heading, the
   blurb and, once a card is selected, the Choose control. Achieved by
   tightening the card (one line per move, a shorter scene), not by dropping a
   fact. Other screens are not reworked in 5.1; *"as a goal overall"* is
   recorded as a goal.
