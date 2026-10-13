# Patch: the Turret, the Commander's MP card, the starting decks, and floors

2026-10-13, on `claude/shared-mana` at `b04e615` (`cards-0.16.0`,
`cardrun-0.14.0`), after section 146's benchmark (3/20 runs won, Turret Alley
stopping 7 losses). Filed **before any change to `src/`**, verbatim, as
[`README.md`](README.md) rule 7 asks.

---

## The message, verbatim

> drop the turret to strike 1
> make the commander's mana a 0-cost gain 1 mana instantly use once, instead of passive 2 mana constantly. list the starting decks for me or write the starting decks in the readme for the repo so we can tune things quickly in the future.
> Also early fights are too long. 1-wave in 'floor 1'
> structure it like this :
> 2 1-wave fights then a 1-wave plus a second wave that's the boss
>
> then big reward, floor 2 is everything harder, new enemies, but the player has more tools
>
> make sense?

## The questions, and the author's answers, verbatim

**Floor 1 becomes: fight (1 wave), fight (1 wave), then the boss fight (1
wave, then the boss as wave 2). What do floors 2 and 3 look like?** Options
offered: *Same shape, one more wave (Recommended)*: floor 2 two 2-wave fights
then a boss fight of 2 waves plus the boss, floor 3 3-wave fights then the
Siege as it is, 3 floors. *Same shape, waves stay short*. *Only two floors*.

> Same shape, one more wave (Recommended)

**Keep the City / Town / Wild stop between fights on floor 1?** Options
offered: *Keep them (Recommended)*. *One stop before the boss*. The author
answered in their own words:

> no city between fight 1 and fight 2, and encounters in the town/wild are both shorter based on floor.

**What is the 'big reward' after a floor's boss? Today it's +4 supplies and a
pick of 3: a talent, a talent, or a stat for one unit.** Options offered:
*Two picks + full heal (Recommended)*. *Pick + full heal*: the current
talent/stat pick and +4 supplies, plus every unit heals to full. *Pick 2 of
the 3*.

> Pick + full heal

**Floor 2's 'new enemies' and 'more tools' — how far should this go now?**
Options offered: *Use what exists (Recommended)*. *Design new enemies too*:
2–3 brand-new enemy types from floor 2 on, built from the existing moves,
drafted and filed for the author's review before building.

> Design new enemies too

## A further message, verbatim, sent while the above was being built

Filed before any work on it. It is a second batch: built after the floors,
from its own design, which is filed under it for the author before code.

> you'll want a new skin for floor 2, with new sprites for the new enemies. give me a list for requested assets liek before and i'll file them with chatgpt to create them.
> allow new enemies to hit harder, faster. with new statuses like root(prevents movement)
> frail (can't gain shield)
> both for n where n is turn duration
> also introduce 'cleanse n' which reduces duration of all debuffs by n turns
>
> also, melee currently can't hit units in the top row. this is frustrating and means melee doesn't get payoff. melee should be able to get to the end, hit once, and get repelled back outside of the 'end zone', meaning it takes move and strike to hit in the end zone, which is flavourful. make snese?

## The go-ahead for floor 2, verbatim

Filed before any work on it, at `baeb0e6`, with the author's assets attached
as a zip.

> build floor 2. here are the assets

What it approves is [`../reports/floor-2-design.md`](../reports/floor-2-design.md)
as drafted.
