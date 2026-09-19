# Patch: a wild Pokemon rolled a move only one species may use

Filed 2026-09-19, before any work, on `claude/wild-mon-restricted-move-bug-hifsw6`.

A playtest report, so it is filed as it was written. It names the defect and no
fix, and that framing is part of the record.

---

## The brief, verbatim

> Bug report the wild mon can learn a species restricted move

It arrived with one screenshot: the battle history sheet on a phone, seed
`GYMRUN-04e080-c0087325`, build `0.5.0`, segment 3/8, locale SHORE. Transcribed
rather than summarised, because the protocol text is the evidence:

```
TURN 4
  Opponent sent out Kilowattrel !
  [The opposing Kilowattrel's Teravolt]
  The opposing Kilowattrel is radiating a bursting aura!
  Swablu used Brick Break !
    It's not very effective...
    (The opposing Kilowattrel was hurt!)
    Kilowattrel: 70 / 77 HP (91%)

TURN 5
  The opposing Kilowattrel used Aura Wheel !
  But it failed!
    (Only a Pokemon whose form is Morpeko or
    Morpeko-Hangry can use this move.)
  Swablu used Slash !
    (The opposing Kilowattrel was hurt!)
    Kilowattrel: 51 / 77 HP (66%)
```

The turn is not wrong. `@pkmn/sim` refused the move exactly as it should, the
readout reported the refusal exactly as it should, and the hint it printed names
the reason. What is wrong is upstream of the battle: the move was drawable at
all, so the Kilowattrel was generated with a move slot that can never do
anything, on any turn, against any opponent.

## What it is not

Not a legality question. GYMRUN is a randomizer and the whole point is that a
Swablu may hold Slash and a Kilowattrel may hold Brick Break; a learnset check
would be the feature being removed. The line this crosses is narrower and
mechanical: **the engine cannot play the move**, which is the criterion
`scripts/gen-pools.ts` already exists to apply.

## Scope

One class: moves whose *user* must be a particular species, forme or type, and
which the engine refuses outright when it is not. Everything else the report
touches — the history sheet's rendering of the failure, the AI's choice to spend
a turn on it, the wild moveset roll itself — is correct and stays as it is.
