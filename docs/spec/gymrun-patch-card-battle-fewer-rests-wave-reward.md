# Patch: enemies rest less, and a small reward after each wave

2026-10-13, on `claude/shared-mana` at `287335d` (`cards-0.15.0`,
`cardrun-0.13.0`), after the shared MP pool and the no-free-cards ruling.
Filed **before any change to `src/`**, verbatim, as [`README.md`](README.md)
rule 7 asks.

---

## The message, verbatim

> Make enemies have fewer rest turns. And give the player a small reward after each wave

## The questions, and the author's answers, verbatim

**How should enemies rest less?** Options offered: *Cut the do-nothing turns
(Recommended)*: delete every step where an enemy neither moves nor acts
(Turret, Bulwark, Sniper, Pikeman and Juggernaut lose one each), and the
Drone loses one of its two advance-only steps; steps that walk closer stay.
*Moving steps also hit*. *One rest each, at most*.

> Cut the do-nothing turns (Recommended)

**What small reward should the player get when a wave falls (before the next
one arrives)?** Options offered: *Heal 1 HP each (Recommended)*. *+2 bonus
MP*. *Pick 1 of 3*: heal 1 HP each, +2 bonus MP next turn, or draw 2 extra
cards. The author answered in their own words:

> instead of heal, get a supply pack - get resource or get a hp pack or a mp pack
