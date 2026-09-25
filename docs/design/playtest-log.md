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
