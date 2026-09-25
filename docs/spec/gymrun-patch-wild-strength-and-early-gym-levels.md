# Wild encounters below the curve, and gyms 1 to 3 one level lower

Filed 2026-09-25 on `claude/wild-pokemon-gym-balance-gpykz5`, before any work.

A playtest brief in one message, filed as it was written. Two asks, both about
the early game, both levers already in `src/data/scaling.ts`.

---

## 1. The brief, verbatim

> Can we stop the wild mons from being so strong? And also have to lower gym
> 1-3 by 1 level

---

## 2. What is built from it

Both items are one column each of `SEGMENTS` in `src/data/scaling.ts`.

**Wild.** `levelOffset.wild` moves down by two at every segment, both ends.
The level lever rather than a band lever, because a capture keeps the moveset
and species it was fought with (`core/acquisition.ts`) and re-levels to the
party: a wild drawn one band lower is a weaker catch for the rest of the run, a
wild drawn two levels lower is the same catch fought at a discount.

**Gyms 1 to 3.** `levelOffset.gym` at segments 0, 1 and 2 moves down by one at
both ends, so the ace of those three gyms sits one level under the party and
the spread keeps its shape. `max` is still never above zero; the pinned rule in
`test/generation.test.ts` relaxes from "exactly parity" to "never above", which
is the argument it was built on.

Both feed the level a seed draws and the species the stage gate admits, so
`RANDOMIZER_VERSION` moves. `RUN_LOG_VERSION` holds: no decision changes shape.
