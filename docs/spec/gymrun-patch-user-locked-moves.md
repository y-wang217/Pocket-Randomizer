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

---

## The follow-up, verbatim

Arrived 2026-09-19, after the move cut was built, benchmarked and pushed. Filed
here before any further work, under the same protocol.

> to confirm ,sucker punch is definitely a real move no?
> and burn up is also fine since it's a valid battle move. it's just unique
>
> one more thing to add to this patch is to prevent useless abilities in the same way? like i dont want the arceus plates or hoopa's ability if the mon can't use it

### The two confirmations

Sucker Punch is a real move and this patch never touched it. It is on the
pre-existing `UNSCOREABLE` list in `scripts/gen-pools.ts` because `@smogon/calc`
cannot score a move that only resolves when the target attacks. Section 51.4
named Thunderclap and Upper Hand as its gen 9 clones, which that older rule
never picked up. That remains a note and not a change.

Burn Up never reached the pool: gen 9 marks it `Unobtainable` and the
`isNonstandard` rule had already cut it.

### Ruling 1: type-locked moves stay

**Double Shock is re-admitted, and the rule narrows to a user that must be a
particular species or forme.** The author's reading is that a move gated on the
user's *type* is a valid battle move that is merely unusual, and the pool keeps
it. Two facts were put beside that before it was taken and did not change it: a
non-Electric holder's Double Shock fails on every turn of every fight, and a
holder that can use it loses its Electric typing to a damage calc that does not
model the loss.

This reverses part of what shipped at `gymrun-randomizer-22`, which is recorded
rather than edited out of the history: `-22` cut three moves and `-23` puts one
back.

### Ruling 2: the ability cut is the wider one

Asked whether to cut only the abilities that name a species, the author chose
**the species-locked ones plus every ability that cannot fire in this game at
all**. That is three groups rather than one:

1. **Species-locked.** Fifteen abilities whose every handler is gated on the
   holder's base species — Disguise, Stance Change, Ice Face, Zen Mode,
   Schooling, Shields Down, Gulp Missile, Hunger Switch, Zero to Hero, Power
   Construct, Tera Shift, Forecast, Flower Gift, Battle Bond, Commander.
2. **No in-battle effect at all.** Multitype and RKS System — the Arceus and
   Silvally case the brief names — carry no handlers whatever, because the type
   change is the species and the plate together. Ball Fetch, Honey Gather and
   Run Away carry none either, for the different reason that what they do
   happens outside a battle.
3. **Ally-only.** GYMRUN is a singles format with one Pokemon a side, so an
   ability that acts only on a partner never fires.

The brief says "if the mon can't use it", and group 3 is the same sentence with
a different subject: the mon cannot use it because the thing it acts on is never
on the field.
