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

Empty. Rev 1 of the bible landed 2026-09-19 and nothing has been playtested
against it yet. The first entries are expected out of the milestone M0 census
and whatever validation cycle retires or keeps Simple and Detailed under R6.

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
