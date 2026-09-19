# Patch: a Toll that charges nothing

**Filed 2026-09-19**, on `claude/t2-berry-inventory-gating-7gvcye`, before any
work. A playtest report, so it is filed as it was written rather than as a
brief: it names one defect, prescribes the fix in one clause, and then asks for
a rule — and that third sentence is the part with the longest reach, so the
framing is part of the record.

The build in the screenshot is stamped `GYMRUN-d4e080-C6U873ZJ`, `0.3.0 · R21`.

## The report, verbatim

> New bug i can pick the t2 result even when i didnt have a berry in inventory. Should gate that option (grey out) if the inventory doesnt have a berry
> If has berry, show what berry will be forfeited (sts precedent show the cost explicitly) so players can plan
> Write that down as a rule to help keep the ethos of the game consistent

## The screenshot it arrived with

An event screen, `SOMETHING HAPPENS`, gate chips `Requires Cut` and `neither`,
prompt "A stair choked with roots, descending further than you can see." Three
options, the third taken:

| label | hint | attributes |
|---|---|---|
| Take the top landing | The top landing is reachable and has not been emptied. | `Reward: T1` |
| Force your way down | The roots hold the stair together as well as block it. | `Reward: T0 to T2` |
| **Trade the digger for a blade** | The digger has a blade and an appetite for berries. | `Costs A berry` `Reward: T2` |

The reveal under it reads `Paid: A berry` in red and `Quick Attack` in green.
The run's bag held no berry. Nothing was taken and the `T2` was paid in full.

## What is not in the report, and is in scope anyway

The report names the berry price because that is the one the reporter hit. The
same hole is in three of the five price kinds `TollPrice` carries — a coin
price against an empty purse charges `max(0, 0 - owed)`, which is nothing, and
an HP price against a party already at `tuning.eventDamageFloor` takes nothing
either. A rule that says a price must be charged, and then exempts the two
kinds that happen not to have been screenshotted, is a rule that is already
being violated when it is written. The gate is therefore defined over
`TollPrice` rather than over berries.

## What is out of scope, and must stay out

**A drawn cost is not a price.** A `T0` consolation's `loseItem` is the result
of a Gamble, revealed after the press, and gating the button on it would show
the player the drawn outcome before they chose — which is the two-phase reveal
the event screen exists to protect. Only the Toll's *stated* price is gated,
because only a stated price is something the player read before pressing.
