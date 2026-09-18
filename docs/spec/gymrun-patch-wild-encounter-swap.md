# Patch: the wild encounter that swaps out

Filed 2026-09-18 on `claude/wild-encounter-swap-bug-1vd4q8`, **before any work
on it**, per [`README.md`](README.md) rule 7.

A one-line bug report with two screenshots, filed as written. It is the
reproduction that
[`gymrun-patch-r19-overnight-playtest.md`](gymrun-patch-r19-overnight-playtest.md)
item 2 was deferred to: that item was closed as "the wild tier does not switch,
what you saw was a forced send-in", and this report is a mid-battle voluntary
switch with nothing fainted.

---

## The report, verbatim

> Bug report wild encounter does swap out

Two screenshots, both stamped `GYMRUN-UGU419-ADA1FF8X` · `0.5.0` · `R20`,
`SUMMIT`, `4 / 8`.

1. [`assets/wild-encounter-swap-battle-screen.png`](assets/wild-encounter-swap-battle-screen.png)
   — the battle screen. `WILD ENCOUNTER`, `Wild Cyclizar · Rookie`. The opposing
   panel reads `2/? left` and the Pokemon on the field is **Aerodactyl**, not
   Cyclizar. Player side: Raboot, with Lopunny and Dhelmise on the bench.
2. [`assets/wild-encounter-swap-history.png`](assets/wild-encounter-swap-history.png)
   — the history drawer, turns 2 to 4:

   | turn | line |
   |---|---|
   | 2 | the opposing Cyclizar used Fake Out, but it failed |
   | 2 | Lopunny used Spirit Break, super effective — **the opposing Cyclizar fainted** |
   | 2 | Opponent sent out **Skarmory** |
   | 3 | Go! Raboot! |
   | 3 | the opposing Skarmory used Aqua Step, super effective; its Speed rose |
   | 4 | **Opponent sent out Aerodactyl** |
   | 4 | Raboot used Fire Fang |

Turn 4's send-out is the report. Skarmory did not faint — the opposing panel
still reads two standing — and no move in either moveset phazes. A send-out in
slot 1 of a turn with nothing fainted is a **voluntary switch**, which is the
one thing the `Rookie` badge on that same screen promises does not happen:
`AI_TIER_DETAIL.easy` is "Reads base power and type matchups. **Stays in.**"

## What this is asked to settle

The R19 reading measured `aiPolicy(AI_TIERS.easy)` at 500 calls on a board where
medium and hard both switched and got **0 switches**, and concluded the player
must have seen a forced send-in. That measurement is not in dispute. The
question this reproduction puts back is the one the measurement could not see:
**is the tier table what the shipped app actually plays?**
