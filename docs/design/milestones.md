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
request is finished and does not grow a second tier. Tier 3 shipped as
[#64](https://github.com/y-wang217/Pocket-Randomizer/pull/64) and Tier 4 is open
as [#65](https://github.com/y-wang217/Pocket-Randomizer/pull/65).

## The bible wins, and blocked items wait

Every conflict between an item and the bible is a row in
[`bible-discrepancies.md`](bible-discrepancies.md). **An item with an unruled
row against it is not built.** Rulings land as amendments to the bible under its
section 10, or as deviation notes in `docs/generation.md`, never as an item
quietly doing something else.

## Status

`blocked` means a discrepancy row is waiting on a ruling. `ready` means nothing
is in its way. `open` means it is ready but its tier is not.

**Twenty-one of twenty-two discrepancy rows are ruled** — eleven on 2026-09-19,
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

**M3.3 is shipped, and Tier 3 is closed.** The item's plan was to delete the
36-word pairing line and let the mounted party row say the same thing — four
move cards means a replacement is coming, three means a free slot. Measured at
390x844 it does not survive the viewport: **a party card folds to 92.9px in
Pocket and opens to 514.0px**, of which the four move cards are 376.2px. Six
unfolded in the two-column grid is about 1542px against 844, and the first card
plus the pinned move already passes the fold. The moves cannot be at rest here,
so deleting the line would have put the screen's only question behind a tap.

**Mounting the component resolved it structurally.** The line is a fact about
this member *and this reward together*, not about the member — so it moves out
of the card and sits beside it. The card is the party row at **0**, which is
what the done-when asks for. Mounting also deleted the screen's hand-rolled
header, level, archetype chip and HP line — three weeks of drift M3.2 had
already fixed in the component — and two stylesheet carve-outs written because
the old card was a `<button>`, worth `HP` and `PP` twelve times.

**The card cannot be a button now**, because the row carries a fold toggle, six
stat labels and four inspect triggers and nesting those in a `<button>` is
invalid. `ui/screens/pre-gym.ts` had the shape: a slot wrapper, the component,
a control beside it.

**The gate, on `89fabd8`.** lint, hedge, typecheck, chromium (207), strict
trim (browser), build, smoke and census all PASS; `test:node` and `trim:node`
ERRORED on vitest's reporter RPC with all 1766 tests passed, which
`scripts/check.mjs` documents as its own status and not a failure. **`webkit`
SKIPPED — no browser binary in this container**, so nothing in Tier 3 has been
verified on the second engine; CI promotes that skip to a failure, which is
where it will be checked. `contentHash` holds at `d4e080` across all three
items and no version axis moved.

**The one figure Tier 3 missed is now D22, ruled.** The decline overlay
measures 5 against a budget of 4 — the question is 3 under the counting rule
and a confirm cannot have fewer than two controls. D1's own table reads that
row as *"Counting the rule as written: 3"*, so the figure was derived from the
question alone, before `ui/band.ts` existed. **Ruled: 6**, matching the replace
overlay, which is the same component. Bible **Rev 4**, and section 9 carries
the bet — a ceiling raised to fit what shipped is watched, not trusted. Pinned
by a test rather than the census, because no fixture opens a confirm and that
component reads `absent`.

| Item | Status | Blocked by |
|---|---|---|
| M3.1 Pokemon battle panel | **done** | — (D6 and D18 ruled. Census 20 → 0 in Pocket; item sprite at 24px, empty slot renders nothing) |
| M3.2 Stat block and party row | **done** | — (D19, D20, D21 ruled; D21a re-ruled to cards. Party row 121 → **63** in Pocket, 0 on party and pre-gym; stat block 0, now covering four call sites) |
| M3.3 Teach target screen | **done** | — (target card 42 → **0**; the decline overlay measures 5 against a budget of 4, see below) |

### Tier 4: battle feedback, closed 2026-09-21

**Five rows were filed against this tier before it opened**, from a reading done
while Tier 3 was closing: [`../handoff/4.10-tier-4-prep.md`](../handoff/4.10-tier-4-prep.md)
carries the options, the register carries the rulings. Four are ruled. D23 keeps
R9 binding hits and puts the six kinds that are not outcomes on a target into a
bounded second channel; D24 corrects the strip's budget to one *flag* per hit,
which is what D7 filed it to say; D25 re-encodes the event line wordless; D27
puts the forecast's colour on the effectiveness flags alone and restates the
shipped "same chip" rule as what it always meant, no weight axis. Bible **Rev
5**, two amendments, both in section 4, no rule moved.

**Two rows were opened against M4.3 and both are ruled.** D26: build the pull,
keep a glyph handle as the visible affordance, and let R7's exposure label carry
the first encounter. **D28**, opened after M4.1 and M4.2 had shipped: once the
strip and the event line are done, what is left on that screen is the header —
node kind, opponent and AI tier — and section 4 budgeted none of the three.
Ruled at **4**, with a canon row beside it, bible **Rev 6**. The census had
never counted the AI tier at all, because the gallery fixture passes no segment
and the tier line is built only when there is one, so the measured 10 was lower
than the screen a player sees; M4.3 fixes the fixture, which raises the number
before anything lowers it.

**One recommendation the merged bible withdrew.** The prep doc proposed taking
the effectiveness flags wordless, on R8's reasoning that the forecast spends no
words. Section 3 says *"Effectiveness (feedback) | One word on the target, edge
colour family"*, so the word stays and D24 is what makes the budget reachable.
The bible outranks a recommendation exactly as it outranks a prompt.

| Item | Status | Blocked by |
|---|---|---|
| M4.1 Flag precedence | **done** | — (D12, D23, D24 ruled. `data/flagPrecedence.ts`, `visual/4.10-m4.1`, [`generation.md` §61](../generation.md)) |
| M4.2 Forecast and feedback vocabulary | **done** | — (D6 filled, D27 ruled. `visual/4.10-m4.2`, [`generation.md` §62](../generation.md); the visual diff is a token assertion, recorded as a deviation) |
| M4.3 Log at rest | **done** | — (D7, D24, D25, D26, D28 ruled. Battle screen 10 → **7**, all of it budgeted; `visual/4.10-m4.3`, [`generation.md` §63](../generation.md)) |

### Tier 5: remaining surfaces

**Open, one item of six done. Seven rows filed before the tier; five are
ruled**, from the reading in
[`../handoff/4.10-tier-5-prep.md`](../handoff/4.10-tier-5-prep.md). D30 and D31
are instrument rows that apply D2 and D21b rather than asking for a new ruling
and close on the build; D29, D32, D33 and D34 each edit a bible table and are
the lead designer's. **D14 stops being nobody's blocker here**: M5.6 reaches
every string in `data/events.ts` whichever way D33 is ruled.

| Item | Status | Blocked by |
|---|---|---|
| M5.1 Reward, shop and TM shelf cards | open | **D36**, D35 (D12, D29 ruled; **D34 ruled on a false premise**, moot if D36 is option 1) |
| M5.2 Map node card | open | D35 (**D29** ruled) |
| M5.3 Locale card and pre-gym screen | open | — (D1, **D29**, **D32** ruled) |
| M5.4 Result screen and capture card | open | — (D1, D5, **D29** ruled) |
| M5.5 Confirm overlays | **done** | — (D1, D22, D31 ruled. Replace **4**, forfeit **5**, ceilings 6 and 6; `CONFIRM_SURFACES`, the `decline` kind, [`generation.md` §64](../generation.md)) |
| M5.6 Event screen | open | D35 (**D33** ruled: amend the row and name the hints. **D14 closed**: the copy is split, so the rewrite is free) |

**D30 is closed**: four census component rows and a worst-instance column,
committed with the before-numbers and before any card was touched. The column
is new and is the one a ceiling is read against — the table had been summing
instances since M0.1, which is the same number only where the budget is 0.
Worst instance in Pocket: reward card **8** against 8, shop stock card **11**,
map node card **12** against 0, locale card **6** against 0, capture card **3**
against 0. **No relic card renders on any fixture**, so the reward card's 8 is
not the heaviest card the game draws (D34).

D31's band fixtures landed **inside M5.5**, not as a pre-tier commit: they add
a third gated category and touch three test files, which is the item's own
work. `CONFIRM_SURFACES` is separate from `OVERLAY_SURFACES` because a band has
no `__sheet` and the overlay gate would have passed on an absence.

**D35 is the fixture audit Tier 4 asked for, and it lands on three items.** The
fixture grants every relic, so all 28 relic cards on the map collapse and all
six gated nodes read `known`; and `wordiestEvent` searches `forest` alone, which
has the lowest ceiling of the eight locales. M5.1, M5.2 and M5.6 each build
their own fixture rather than the shared one being re-cut under four surfaces.

**M5.5 was nearly built when the tier opened, and its item text was out of date
twice over.** M2.3 shipped the replace band with both cards; M3.3 shipped the
forfeit band with **one**, deliberately, and D22 then moved the decline budget
from 4 to 6. The record still reads "the two cards" and "census reads 6 and 4",
and is not edited: the deviation is
[`../generation.md` §64](../generation.md). What the item actually built was
its last line — overlay cancel and flow decline visually distinct, via a
`decline` control kind and one rule under `body[data-band-open]` — plus D31's
two fixtures and the number they made readable.

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
