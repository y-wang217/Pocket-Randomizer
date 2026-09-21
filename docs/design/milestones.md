# GYMRUN Presentation Milestones: the working checklist

Companion to [`design-bible.md`](design-bible.md). Release 4.10.

The document itself is
[`../spec/gymrun-presentation-milestones.md`](../spec/gymrun-presentation-milestones.md),
verbatim, which is the record. This file is the working copy: the same items,
with their status, their branch and the discrepancy rows that block them. It
changes constantly; the record never does.

Same relationship `docs/visual/OVERNIGHT.md` has with its spec copy.

## How 4.10 is built

One sub-branch per item, `visual/4.10-<item>`, merged back into a tier trunk
with a merge commit and no squash, so any single item is reverted by reverting
its merge. One pull request per trunk. See D13 in
[`bible-discrepancies.md`](bible-discrepancies.md) for why that is compatible
with the record's "one item, one PR" rule.

**The trunk is per tier group, not per release.** `claude/visual-revamp-jb20na`
carried Tiers 0 and 1 and shipped as
[#61](https://github.com/y-wang217/Pocket-Randomizer/pull/61), merged
2026-09-20; `main` is `7e0c46d`. Tier 2 was cut fresh from there and shipped as
[#63](https://github.com/y-wang217/Pocket-Randomizer/pull/63), merged
2026-09-20; `main` is `8869623`. Tier 3 is cut fresh from *that*. A merged pull
request is finished and does not grow a second tier.

## The bible wins, and blocked items wait

Every conflict between an item and the bible is a row in
[`bible-discrepancies.md`](bible-discrepancies.md). **An item with an unruled
row against it is not built.** Rulings land as amendments to the bible under its
section 10, or as deviation notes in `docs/generation.md`, never as an item
quietly doing something else.

## Status

`blocked` means a discrepancy row is waiting on a ruling. `ready` means nothing
is in its way. `open` means it is ready but its tier is not.

**Twenty of twenty-one discrepancy rows are ruled** — eleven on 2026-09-19,
which took the bible to Rev 2, then D2 and D8, then D15, D16 and D17 across
Tier 2, all on 2026-09-20, then D18 on 2026-09-21 opening Tier 3. **D14 is the
one open row**, it blocks nothing, and it is timed with M5.6. **D19 is deferred
rather than open**: it is ruled with M3.2, which meets the same two chips on
the party row and was ruled with it, taking the bible to **Rev 3**. D20 and D21
were ruled inside M3.2 on the same day. **D14 is the one open row**, it blocks
nothing, and it is timed with M5.6.

**M0.2 is shipped**, and [`inventory.md`](inventory.md) section 4 carries four
findings the items downstream depend on: M1.1 is smaller than it reads (band and
status need no glyph, type has a drawn set already, category has none), M2.1 has
two R3 collisions to resolve before it mounts anything, and M4.1 has a
vocabulary collision that would cost four facts if it is walked into.

**M0.1 is shipped**, and [`text-census.md`](text-census.md) is the before column
every later item is measured against. Rebuild it with `npm run census`; the
`census` leg of `npm run check` prints the delta and cannot fail the run. Four
readings worth carrying forward:

- **Every decision surface is over budget, most of them by an order of
  magnitude.** Pocket, less the app shell: event 89 against a budget of 40, shop
  64 against 8 per card, result 48 against 6, pre-gym 41 against 4, and the map
  node cards carry prose against a budget of nothing at all.
- **The largest single source is the field label R2 already forbids.** `PP`,
  `BP`, `HP`, `Lv` and `STAGES` repeat per move and per member, so one fix in
  M2.1 and M3.1 takes tens of words off six surfaces at once.
- **`Explain` renders 24 times on the summary**, once per move. Section 7
  rejects a legend button as "a mechanism the player must know exists"; 24 of
  them is the same objection at scale, and M1.2 is where it goes.
- **Density does nothing for the worst surface.** The event screen censuses 95
  in all three modes. It is the surface furthest over budget and the one mode
  switching cannot help, which is M5.6's problem and, under D8, a Tier 7 input
  rather than a licence to move the requirement.

**M0.3 is shipped, and Tier 0 is closed.** The count was nine, not six: three
more lines turned up the moment **worth** joined the word list, which section 8
had always named and the shipped twelve-word list had never carried. The rule
did not change; its enforcement caught up. `scripts/hedge-lint.ts` holds it,
`npm run hedge` runs it, `test/hedge-lint.test.ts` proves it can fail, and it
reads string literals rather than comments — the first cut read whole files,
returned 31 hits of which 3 were real, and flagged the comment M0.3 had just
written explaining the rule. `contentHash` holds at `d4e080`.

**Two more it did not fix, and one open row.** Widening the list also made an
existing test see two event sentences in violation. They live in
`data/events.ts`, which is inside `contentHash`, so two words of flavour text
would refuse every recorded seed and force the visual baseline to be
re-recorded — the trade D12 was ruled against four hours earlier. They are
listed in `test/event-copy.test.ts` as `KNOWN_UNFIXED`, asserted to be exactly
those two so nothing can join them, and the decision is **D14**.

### Tier 0: measure before touching anything

| Item | Status | Blocked by |
|---|---|---|
| M0.1 Text census | **done** | — ([`text-census.md`](text-census.md), `npm run census`, `visual/4.10-m0.1`) |
| M0.2 Glyph and mechanism inventory | **done** | — ([`inventory.md`](inventory.md), `visual/4.10-m0.2`) |
| M0.3 Close the verdict-copy violations | **done** | — (D3 ruled six; it was **nine**. `npm run hedge`, `visual/4.10-m0.3`) |

**M1.1 is shipped, and its kills-it condition fired once.** 42 glyphs, nine
families, sixteen newly drawn; the eighteen type glyphs are referenced from
`typeIcons.ts` rather than restated. The band pips came in at **0.063** against
a floor of 0.12, because the shipped `.band__pip` distinguishes filled from
empty by fill tone and nothing else — as shapes they are one mark twice. Redrawn
filled-against-outlined: **0.262**. No bible amendment was needed; section 2 says
what a filled pip means and nothing about how an empty one is drawn. Nothing is
mounted on any screen, and a test walks `src/ui/` to prove it.

**M1.2 is shipped, and it found a dead trigger.** Inspect is a long press per
R5: hold opens, release closes, tap selects. The battle move button is its own
trigger now and the `?` chip on its PP line is gone, which is one fewer
mechanism a player has to know exists. Eighteen of section 3's nineteen inspect
rows open — archetype is excepted by the table itself and by D4 — and five of
them had no panel at all before this item: base power, PP, coverage, capability
and tier.

**`flag` was missing from the tooltip layer's allowlist.** Release C gave every
post-resolution flag a `data-tip` and wrote its renderer, and never added the
kind to `KINDS`, which `render` checks before it reaches the switch. So every
flag word on the battle screen has been a focusable trigger that opened nothing
since Release C shipped. Fixed, and the union, the switch and the allowlist are
now reconciled by a compile-time guard rather than by three places agreeing.

**One thing it did not do: D15.** The `Explain` expander is an inline collapse,
not a tooltip, so the item's done-when is met without touching it — but it is a
help button on any ordinary reading of R5, and the census counts 24 of them on
the summary. Recommended to fold into M2.1, which rebuilds that card anyway.

**M1.3 is shipped, and Tier 1 is closed.** A count per family beside the
tutorial flags, incremented once per screen rather than once per render — a
battle screen draws a type chip four times and re-draws itself every turn, and
counting either would put a player past R7's third exposure before they had
read anything. The set of families already counted on this screen is not
persisted, so a reload is a fresh arrival at whatever screen it lands on. The
tutorial reset control clears the counts too, because section 7 gives coach
marks, exposure labels and inspect one job each and a control that reset a
third of onboarding would be a control that lies about what it does.

Nothing renders a label: that is M6.1. The nine family names moved to
`data/glyphFamilies.ts` so the store could read the roster without importing
the drawings, which M1.1's own test forbids — and it is where M6.1's labels
will be keyed from.

### Tier 1: foundations

| Item | Status | Blocked by |
|---|---|---|
| M1.1 Glyph sheet | **done** | — (42 glyphs, `npm run glyphs`, [report](../visual/reports/m1.1-glyph-sheet.md), `visual/4.10-m1.1`) |
| M1.2 One inspect layer | **done** | — (D4 ruled; 18 mount points, archetype excepted. `visual/4.10-m1.2`) |
| M1.3 Exposure store | **done** | — (`visual/4.10-m1.3`) |

### Tier 2: the move card

**D16 was opened reading into M2.1 and it changed the item.** Pocket's 61 words
against Detailed's 477 is not a compact encoding: `styles.css:1088` hides base
power, the category glyph, the status readout and the fact strip outright,
which is C2 rather than a density choice. The `power:` inspect trigger sits on
the element that rule hides and `moveCard` is not a trigger itself, so on a card
in Pocket the only route to base power is the `Explain` expander — the thing
D15 deletes. **That is why the two are one ruling**, and why M2.1 removes the
expander and the `display: none` block in the same pass.

Ruled **Pocket only**: M2.1's zero binds the Pocket face, Detailed and Simple
keep their labelled face until M6.4 rules on them with M7.1's evidence. No rule
moved; R6 already sanctions the two modes for one validation cycle.

**M2.1 is shipped, and it opened one row before it closed.** The face is
section 3's on both call sites, and it mounts M1.1's glyph sheet for the first
time. Census in Pocket: **move card 61 → 0, battle move button 16 → 0.**

It did not reach 0 on the first pass, and **D17** is the row it filed rather
than closing around — 15 and 14, from two unrelated causes. The button's
fourteen were the status readout, a sentence the item *restores* because hiding
it was the C2 violation D16 was filed against; the card's fifteen were the fact
strip's icon characters and a PP max that section 3 requires be dimmed, which
splits one number into two tokens. Ruled: the readout sits behind the long
press, which is safe only because M2.1 made the card a trigger and
`moveExplanationRows` builds its rows from the same phrase functions the
readout joins; and the counting rule gains a leading separator and one glyph
slot.

**The census fix was narrowed after being measured.** The first cut exempted
all `aria-hidden` text and silently stopped counting the corner stamp's seed
string — a census flattering a milestone, which is what the row existed to
prevent. One selector instead, and the app shell still reads 109.

**M2.0 is not on the record and is a prerequisite, not a milestone.** It touches
no player-facing surface, so it reads no bible rule and carries no census delta.

**It shipped, and the handoff's diagnosis was the symptom rather than the
cause.** The fixed `waitForTimeout(25)` was not what broke the walk. Two older
defects were: the screen is read twice per lap and the app can move between the
reads, so a walk steps off a screen its own predicate never saw; and `stepOnce`
returned a screen name from every branch including the ones that only waited, so
`maxSteps` — documented as decisions — counted laps and a walk could spend its
budget without making a decision. Both are fixed, `test/visual-walk.test.ts`
pins them without a browser, and four of its five cases fail against the old
driver.

**The original overnight failure was never reproduced** and probably cannot be:
throttling the page slows the app and narrows the gap the race needs. What is
observed is that both formerly-flaky files passed under full-suite load on a
four-core box. That these two defects are the whole of it is not proven — see
[`generation.md` §53](../generation.md).

| Item | Status | Blocked by |
|---|---|---|
| M2.0 Browser harness waits on state | **done** | — (not on the record; [`generation.md` §53](../generation.md), `test/visual-walk.test.ts`) |
| M2.1 Move card face | **done** | — (D15, D16, D17 ruled. Census 0 and 0 in Pocket, from 61 and 16) |
| M2.2 Battle move button | **done** | — (D9 closed with the number: column mode deleted. §2 forecast, 44px floor) |
| M2.3 Move chip | **done** | — (census 0 in Pocket; pinned card 262 and chip row 526 against an 844 fold) |

### Tier 3: panels and party

**M3.1 is shipped, and it opened two rows before it closed one.** The panel
censused **20 words in Pocket**, ten per surface across `battle` and
`log-sheet`, sitting in five elements: the roster label's `left`, the name's
`Opposing`, `Lv` welded to the level, the archetype chip, and the Pocket stage
marker's `STAGES`. Four were re-encodings with no rule in their way. The fifth
was **D18** — section 5 does not list the archetype chip, section 3 bars the
label outright, and V5's own note (`scene.ts:910`) says the chip is the only
remaining channel for what the thing opposite is built to do, so deleting it
was a C2 ruling rather than a tidy-up. **Census in Pocket: 20 → 0.**

**D18 ruled option 2, and its own condition was the expensive half.** The chip
goes and the six stats it was derived from come back behind the panel's long
press, drawn as section 3's Six stats row specifies: glyph, bar, number, all
six, display order, no sort. That is only re-encoding rather than removal if
the panel becomes a trigger in the same pass — D17A's precedent, stated in the
row before it was ruled — so it did. The value is `base` and not `effective`,
because the stages already on the chip row are the boosts and printing the
post-boost number would be one fact in two channels (R3).

**A fourth word source the census could not see, and it was the same family.**
`▲ FIRST`, the Speed marker, spends a word *and* borrows the triangle section 2
gives to the Priority family for a fact that is not a bracket. The fixture has
no faster side, so no census ever charged it. It is the Stat family's Speed
glyph now, and the panel's new chevron slot — D6, and empty until M4.2 fills it
— is free to mean what section 6 says it means.

**Detailed and Simple read 4, and that is D16 rather than a miss.** The
residue is the type chips' word forms, which the stylesheet hides in Pocket;
D16 ruled that the labelled face survives in the other two modes until M6.4
decides with M7.1's evidence, exactly as it did for the move card in M2.1.

**D19** is the gap behind the census rather than in front of it: the ability
chip and the nineteen volatile chips have no row in section 3, no family in
section 2 and no budget line in section 4, and they read near zero only because
`properNouns()` happens to carry `Levitate` and `Leech Seed` and not `Confused`.
M3.1 touched neither, and it is ruled with M3.2.

**M3.2 is shipped, and it was three rows rather than one item.**

**D20: the tree had three six-stat components and the census could see one.**
`statBlock` was private to the member card, `statLine` was exported from
starter select to two more screens, and M3.1 added a third in the inspect
layer. The `stat block` row read `90 | 108 | 0` against `.stats` while
`.statline` spent six words on `starter` and six more on `result-capture` —
D2's failure one layer down. `ui/stat-block.ts` takes six numbers and a layout,
which is what let all four kinds of caller mount it, and the two "layouts" were
never two components: Pocket already drew `.stats` as the same six-across row.
**Mounting it made the number briefly worse** — 24 in Pocket, because an older
density rule re-showed the label the new one had hidden — and that is the
census becoming honest rather than a regression. Final: **0**, over four call
sites instead of one.

**D19 took the bible to Rev 3.** The ability and the volatile chips had no row
anywhere. The Status family absorbs the volatiles rather than a tenth family
being opened; the ability gets a row saying it is the one attribute with no
glyph, and a budget that names it. None of the twelve rules moved.

**D21a was ruled one way, built, and re-ruled back by three invariant tests.**
The chip came to the party row with PP, which section 9's own disconfirmer for
M2.3 names. Then `test/band-badge.test.ts` went red on four cases — the badge
exists so a band 3 offer can be compared against the four moves a member
knows, and the drawer carries no second copy of it — and then
`test/visual-move-cards.test.ts` caught the fact strip going the same way, on
`party`, `drawer` and `pre-gym`. Restoring all three would have made the chip a
card with a different class name. **So the row is wrong**, and it is the row
that changed: the bible's Party row reads "four move cards" now, corrected from
"four move chips", which was written before M2.3 decided what a chip leaves
out. Nothing is spent at rest either way — the move card censuses 0 in Pocket
and the body folds there.

**Two layout regressions, both a rule the tree already had.** The stat label
drew its glyph *and* its word outside Pocket, which is R3 and which
`.chip--type`, `.badge--category` and `.move__pp` were already handled for; and
the six-across layout drew `Hit Points` where `statLine` drew `HP`, deleting
the comment that said why — *"six full names do not fit a card at 390 wide"*.
Together they put the capture offer's decision buttons 17px past the 844 fold.
Two rounds of CSS arithmetic moved the number 861 → 845 → 855 and explained
none of it; probing the card printed a 24px label at a 12px line-height, which
is a wrapped line. **Measure before reasoning.**

**The map rail keeps its `Lead` chip.** Taking it off a party card is R3
because the card draws a slot number; the rail draws none, so the chip is its
only channel. Giving it the number instead wrapped its header to a third line
and moved the map's `decisionTop` 23.5px down, failing the height baseline in
every guarded mode.

**What M3.2 did not close.** The done-when also asks for 0 on the drawer. The
census has a `party drawer` component now (D21b) and it reads **13** in Pocket:
four section headings, two blurbs and four picker labels — the settings surface
the drawer also happens to be, and no item on the list owns any of it.
Recommended to M6.3, which touches the density picker anyway. It blocks
nothing.

| Item | Status | Blocked by |
|---|---|---|
| M3.1 Pokemon battle panel | **done** | — (D6 and D18 ruled. Census 20 → 0 in Pocket; item sprite at 24px, empty slot renders nothing) |
| M3.2 Stat block and party row | **done** | — (D19, D20, D21 ruled; D21a re-ruled to cards. Party row 121 → **63** in Pocket, 0 on party and pre-gym; stat block 0, now covering four call sites) |
| M3.3 Teach target screen | ready | — (D1 ruled: at or under 4. It takes 42 of the party row's remaining 60) |

### Tier 4: battle feedback

| Item | Status | Blocked by |
|---|---|---|
| M4.1 Flag precedence | open | — (D12 ruled: per-file split) |
| M4.2 Forecast and feedback vocabulary | open | — |
| M4.3 Log at rest | open | — (D7 ruled: the strip has its own row) |

### Tier 5: remaining surfaces

| Item | Status | Blocked by |
|---|---|---|
| M5.1 Reward, shop and TM shelf cards | open | — (D12 ruled) |
| M5.2 Map node card | open | — |
| M5.3 Locale card and pre-gym screen | open | — (D1 ruled) |
| M5.4 Result screen and capture card | open | — (D1, D5 ruled: no label line) |
| M5.5 Confirm overlays | open | — (D1 ruled) |
| M5.6 Event screen | open | — (D8 ruled: hold at 40, report, wait for M7.1) |

### Tier 6: onboarding and density

Order confirmed by D10: M6.2 re-anchors the coach marks **before** M6.3 flips the
default, and section 7 was amended to say so.

| Item | Status | Blocked by |
|---|---|---|
| M6.1 Exposure labels | open | — (D5, D12 ruled) |
| M6.2 Coach marks re-anchored | open | — |
| M6.3 Pocket default | open | — |
| M6.4 Retire Simple and Detailed | open | — (D11 ruled: two rounds) |

### Tier 7: validation

| Item | Status | Blocked by |
|---|---|---|
| M7.1 Playtest protocol | open | — |
| M7.2 Post-census | open | — |

## What the record says that this file does not repeat

The item text, the done-when and the kills-it for every row above. Read them
from the record before building, and read the ruling in
[`bible-discrepancies.md`](bible-discrepancies.md) beside it: eight items have a
done-when the rulings changed, and the record is not edited to match. Where this
file and the record disagree on what an item asks for, the record plus its
ruling is right; where they disagree on whether it is built, this file is.
