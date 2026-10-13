# Patch: shared mana, one per unit

2026-10-12, on `claude/shared-mana`, from `main` at `0482454` (`cards-0.11.0`,
`cardrun-0.9.0`). Filed **before any change to `src/`**, verbatim, as
[`README.md`](README.md) rule 7 asks. A feature request, then three questions
the session asked and the author's answers.

---

## The message, verbatim

> Mana doesnt gatr properly we give it too generously
> Instead eberyt unit has a max mana and its usually one unlesss moidied by unit or card abilities
>
> Mana is shared between all units
> So your cards olay off those
> And getting more max mana is crazy powrfukneso id its permanent for. That run.'mmmm

## The questions, and the author's answers, verbatim

**Does the shared pool refill to full each turn, or bank leftovers? (Ults cost
4–5 today, and three units with 1 max each make a pool of 3.)**

Options offered: *Refill, leftovers lost (Recommended)*: Slay-the-Spire
energy. At the start of each turn the pool resets to the sum of the units' max
mana, and unspent mana is gone. Ults are repriced to 3 or less so they fit.
*Gain per turn, bank up to a cap*.

> Refill, leftovers lost (Recommended)

**When a unit faints, does its max mana leave the pool?**

Options offered: *Yes, pool shrinks (Recommended)*. *No, pool stays*: the pool
is the team's total for the battle, whoever is standing.

> No, pool stays

**How should the existing MP sources map onto the new model?**

Options offered: *Permanent = max, cards = one-off (Recommended)*: the boss
upgrade's +1 MP becomes +1 max mana for the rest of the run, drawn rarely. The
Commander and the Battery talent get max 2. Resupply, Focus, Ration and Stim
Pack add one-off bonus mana next turn, above the max. *Strip all extra mana*.

> Permanent = max, cards = one-off (Recommended)
