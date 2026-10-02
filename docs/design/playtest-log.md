# GYMRUN playtest log

The evidence file for [`design-bible.md`](design-bible.md). Section 10 of the
bible says a rule changes only when its disconfirmer in section 9 has been
**observed in a playtest and recorded here**, with the date, the tester count
and the observation. This is that record.

It is an observation log, not an argument. One row per observation. A row says
what was seen, not what should be done about it. The "what happens then" column
of the bible's hypothesis register already says that, and the amendment PR
carries the reasoning.

**A row here is a precondition for an amendment, never a substitute for one.**
Writing a row does not change a rule. The rule changes when the PR to the bible
lands.

## Observations

| Date | Testers | Rule or hypothesis | What was observed | Amendment |
|---|---|---|---|---|
| 2026-09-22 | 1 | R5, long press never submits | On an iPhone, a **tap** on a move card chose the move and also opened its inspect panel, which then could not be dismissed by tapping and covered the stage and the log for the rest of the fight. Tapping the panel opened a different move's panel. Reported as *"tooltips dont close. And clicking any movr opens a tooltip that blocks the screen"*, with a screenshot of the stranded panel | — |
| 2026-09-25 | 1 | R5, "Release closes" (no section 9 row) | On an iPhone, a long press on a move card selected the word under the thumb and raised the copy callout, which closed the panel; when the panel did open it sat beside the thumb, too small to read, and left on release. Reported as *"The text is highlightable so holding down to get tooltips means i get the highlight and opens a tooltip too small"* and *"once i highlight the text, it exits the menu bc it opens the hightlight text tooltip for copy etc"* | the docked sheet patch, same PR |
| 2026-09-29 | 2 | Section 7, coach marks (no section 9 row) | An outside tester on desktop Chrome counted *"11 tutorial steps before the first battle, followed by 6 more battle steps"* and suggested shorter progressive guidance. The author, asked: *"yes, tutorial shorter is better.i always skip it."* | the opening playtest QA patch, same PR: 29 marks to 17, cut along section 7's own division of labour |
| to 2026-09-30 | 2 (the author; the outside tester, an AI-driven QA agent) | R6, Pocket default and retiring Simple/Detailed loses nothing | The author: *"i did a full successful playthrough. i've also been doing playtest runs via chatgpt and given feedback."* The outside tester's two QA passes against production ([`../spec/gymrun-patch-opening-playtest-qa.md`](../spec/gymrun-patch-opening-playtest-qa.md), [`../spec/gymrun-patch-qa-persistence-pass.md`](../spec/gymrun-patch-qa-persistence-pass.md)) reported eleven findings between them and none asked for more numbers at rest. **The disconfirmer, a request for all numbers always visible, was not observed.** Fewer testers than D11's validation cycle names (two rounds of three, one without Pokemon knowledge); the author ruled the cycle done on this evidence | bible Rev 15, D50 |
| 2026-10-01 | 1 (the author) | R6 row of section 9, one face loses nothing: *"A tester asks for all numbers always visible"* | On the starter screen: *"we've kept the pocket display for starters. i hate it. i need speed to know which starter i want."* The stat block there drew bars with the numbers one press away, and the pick turned on a number (Speed) the bar could not be read to. The same message found the screen *"too bright all white"*, and asked for the matchup of the starter's **moves**, not its species. Filed verbatim at [`../spec/gymrun-patch-starter-select-redesign.md`](../spec/gymrun-patch-starter-select-redesign.md). | Bible Rev 19, D78 to D80 (2026-10-01): the remedy is applied to the one surface the observation was made on, not as a setting |
| 2026-10-01 | 1 (the author) | R6 row of section 9, *"A tester asks for all numbers always visible"*, a second time; and section 5's map node card (D63's row) | Against production R22 on desktop Chrome: *"i can't see litten's stats in any page, including the team page"*, *"bars suck. replace bars with the stat numbers proper"*, and *"amend a new rule that number of words must be limited as usual EXCEPT for vital information, of which the stats is key."* On the map: *"map should hide future node's reward bands. show the node type shop/wild/etc, but not the sub heading"* and *"the map buttons look awful"*. On the bag: *"the click to open sucks"*. On the locale screen, the card should be *"the peek into the map"* with the text on a semi-opaque background. Filed verbatim, with three screenshots, at [`../spec/gymrun-patch-r22-stats-at-rest-and-map.md`](../spec/gymrun-patch-r22-stats-at-rest-and-map.md). The map items are the author's directive, not D63's disconfirmer, which runs the other way | Bible Rev 20, D81 to D86 (2026-10-01): R13, vital information; the bars retired; the stats at rest on the party row and the player's battle panel; the swap's stat change; later map rows at the glyph; the locale card as a peek |
| 2026-10-01 | 1 (the author) | D82, *"no bar"* (no section 9 row); section 4's starter detail panel and starter card rows | Against production R22 on an iPhone, which still drew the stat bars D82 had retired on `main`, against a flat ceiling: *"Im still not happy w the bars. Lets map the possible values for level 15 mons. And instead of marking out of 400 or whatever, mark it out of the band of possible values for that stat. Eg make it easy to see when a high hp target like munchlax has near max hp for a lvl 15"*. On the starter screen: *"I also dont like the scroll. Can we open the detailed stats as a thinner (less wide) menu Over top of the moves?"* and *"notice how 3 starters dont fit neatly on the page? Lets make it non-scroll as a goal overall"*. The message also asked for IV and nature marks; GYMRUN has neither, and the author, asked, answered *"build band bars, ignore iv and nature."* Filed verbatim, with two screenshots, at [`../spec/gymrun-stage5.1-band-bars-and-starter-fit.md`](../spec/gymrun-stage5.1-band-bars-and-starter-fit.md). The author's directive, not a registered disconfirmer | Bible Rev 21, D88 to D90 (2026-10-01): the banded bar beside the number; the starter detail over the moves; the starter screen without a scroll |
| 2026-10-01 | 1 (the author) | None: the palette and the PP glyph's drawing are not bible rules (section 2's PP row says *"Small PP glyph"*) | Against production on an iPhone: *"the old color scheme was much nicer"*, with a screenshot of the dark starter screen; asked which, *"Whole app back to dark"*. And: *"the symbol for pp is a water droplet which makes no sense. Its essentially ammo, so use an ammo symbol"*. Filed verbatim at [`../spec/gymrun-patch-dark-palette-ammo-pp.md`](../spec/gymrun-patch-dark-palette-ammo-pp.md). The author's directive, not a registered disconfirmer | None needed: built by the patch, same PR |
| 2026-10-01 | 1 (the author) | C1, *"no conditional emphasis"*; R4, neutral renders nothing; R8, *"on the move button"* (no section 9 row for any) | In the same session as a long-press bug on the claim band: *"also help me highlight when a move is super and grey it out when the move is not super. also highlight the moves for effectiveness in the party select from switch team out. teach players what to do"*. The session reported the conflicts first; the author chose *"Amend: grey out non-super"* and *"Edges on bench moves"* (no recommendation). Filed verbatim at [`../spec/gymrun-patch-effectiveness-emphasis.md`](../spec/gymrun-patch-effectiveness-emphasis.md). The author's directive, not a registered disconfirmer | Bible Rev 22, D91 to D93 (2026-10-01): the bar lit and greyed while a super effective move is on it; the forecast on the bench's moves; one coach mark |

**The second row amended R5 without a section 9 disconfirmer**, and says so
in the bible's own amendment note. The observation was the author's directive
rather than a tester failing a registered bet; the row is here because the
log is the record of what a rule was changed on, and a change with no row
would be the quiet patch section 10 forbids.

**The first row is not R5's disconfirmer, and its blank Amendment column is
the point.** R5's kills-it condition is an accidental *submission during inspect*;
what was observed is its mirror, an accidental *inspect during submission*. No
long press spent a turn. The cause was the hover enhancement layered over the
gesture taking the compatibility `mouseover` every mobile browser synthesises
after a touch, and it was fixed rather than amended —
[`../spec/gymrun-patch-inspect-hover-on-touch.md`](../spec/gymrun-patch-inspect-hover-on-touch.md),
[`../generation.md` §71](../generation.md).

The row is here anyway, because this is the first time anyone has played
against the inspect layer and the log is where that goes. A reader asking
later whether R5 has ever been tested should find this rather than an empty
table.

Otherwise empty. Rev 1 of the bible landed 2026-09-19. The next entries are
expected out of the milestone M0 census and whatever validation cycle retires
or keeps Simple and Detailed under R6.

## How to write a row

- **Date** the session, not the day you wrote it up.
- **Testers** is a count. One tester is a legitimate row and the count says so.
- **Rule** names the row in the bible's section 9, by its left-hand cell.
- **What was observed** is behaviour or a quoted question. "A tester asked
  'does this always hit?'" is an observation. "Accuracy is confusing" is not.
- **Amendment** is the PR once one exists, or blank. A blank means the rule
  still stands.

A disconfirmer that fires once is a row. Whether one row is enough to amend is
the amendment PR's argument, and the bible deliberately does not set a
threshold.
