# Patch: the basic cards cost MP, and shields are not free

2026-10-12, on `claude/shared-mana`, after the shared MP pool
([`gymrun-patch-card-battle-shared-mana.md`](gymrun-patch-card-battle-shared-mana.md),
`../generation.md` 144) at `a2bddaf` (`cards-0.12.0`, `cardrun-0.10.0`).
Filed **before any change to `src/`**, verbatim, as [`README.md`](README.md)
rule 7 asks.

---

## The message, verbatim

> now that we have limited mana, make the basic cards each cost mana. that means 1 card per mon per turn, max. and shields aren't free.

## The follow-up, verbatim

Filed before any change to `src/` for it, at `0ee58c8` (`cards-0.13.0`,
`cardrun-0.11.0`), after the session said Move costing MP would make
repositioning compete with every attack.

> oh that's a good point. move should be free but shield should cost mana. or melee units get -1 cost for move? that should make more sense or give commander the give others plus 1 move in the base deck.

The session asked which. Options offered: *Move free again (Recommended)*:
the neutral Move card back to 0 MP, Dash and Sprint staying at 1 since they
move further. *Melee units: Move -1*. *Commander gets Command* in the starting
deck in place of a Move. *Melee -1 and Command*. The author's answer:

> Move free again (Recommended)
