# Patch: the clipped tier line, the copy chart, and an intro for new players

**Filed 2026-09-19, on `claude/game-copy-audit-intro-rar7gf`.**

**Committed after work on it had begun, and this file says so.** Protocol 5 in
[`README.md`](README.md) asks for the prompt to land before any code does. It
did not here: the brief arrived as a single message with a screenshot attached
and the session went straight at it. The brief is reproduced verbatim below,
unedited, and the deviation is recorded in
[`../generation.md`](../generation.md) section 51 rather than smoothed over.

## The brief, verbatim

> Bug the copy in the card says this segment's and is cut off. Pull up all the
> copy in the game so far in a nice chart. I will rewrite them all since live is
> all claude generated
>
> Also create a "intro" for new players that appears alongside the tutorial. A
> pop up that says "this is slay the spire meets pokemon randomizer. If this
> doesnt mean anything to you, good luck."

## The screenshot

An iPhone at 390pt, GYMRUN 0.3.0 · R21, seed `GYMRUN-d4e080-C6U873ZJ`, standing
on step 4 of 6 in Shore before Volta's Electric gym. The two cards on the
current step are a `WILD HARD` and a `WILD ELITE`. The hard card reads:

> 17 coins · Rookie · The segment's, a little above its level, +1 species band.
> Pays a move one band up.

The report is about the second sentence of that card, and the reading it
produced — "says this segment's and is cut off" — is the finding, not a
misreading to be corrected.

## What the brief asks for, as three things

1. **The card.** Nothing is truncated. `TIER_INFO.normal` and `TIER_INFO.hard`
   open on a possessive with the noun elided, and on a two-line card that reads
   as a string that stopped.
2. **The chart.** Every player-facing string in the game, in one place, with
   room to write a replacement beside each. The author intends to rewrite all of
   them, so the chart's job is to be a worklist rather than a report.
3. **The intro.** A panel before the first decision that says what kind of game
   this is, for the player who would recognise the comparison — and says, to the
   player who would not, that not recognising it costs them nothing.

## What is deliberately not in scope

The rewrite itself. The brief is explicit that the author will do it ("I will
rewrite them all"), so this patch changes exactly one existing string — the one
reported as a bug — and leaves every other word in the game as it is. The chart
is built to be filled in by someone else.
