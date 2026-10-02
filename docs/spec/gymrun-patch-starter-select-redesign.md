# Patch: the starter select redesign

Filed 2026-10-01 on `claude/magical-shannon-64iefo`, **before any work on it**,
per [`README.md`](README.md) rule 7, with the mockup it arrived with.

The author's message, filed as written, then the rulings the author gave the
session's questions before any code. The design bible outranks this prompt on
presentation; where the two disagree, the author ruled the bible amended
(Rev 19, D78 to D80), and the deviations from the mockup are in
[`../generation.md`](../generation.md).

---

## The message, verbatim

> few instant bug fixes before we do stage 6. the starter page is too bright all white - make it darker
> and we've kept the pocket display for starters. i hate it. i need speed to know which starter i want.
> let's redesign the starter page to something like this
> but notice the effective against only has specie's typing. it should have the move's typing meaning electrike should be strong against elec's supers, flying's supers and rock's supers. make sense?

One image: [`assets/starter-select-redesign-mockup.webp`](assets/starter-select-redesign-mockup.webp).

### The mockup, transcribed

- Top: the shell nav (Map, Team, Bag, Run Info, Run Sets, Settings), the
  GYMRUN wordmark, "A Pokemon roguelike for your browser".
- **Choose Your Starter**, with the blurb: "Species, ability and moves are
  randomized. HP and PP carry between fights; a gym clear restores both."
- Three compact starter cards, stacked. Each card has a left half (name, gender
  mark, `Lv5`, type chips, the sprite standing on a painted scene matching its
  type) and a right half (`Ability` and the ability name with its description,
  then four move rows: type icon, move name, base power, `--` for a status
  move). The first card, Electrike, has a heavy blue outline: selected.
  - Electrike, Electric, Justified: Charge Beam 50, Wing Attack 60, Rollout
    30, Encore 5.
  - Finizen, Water, Overgrow: Aqua Jet 40, Frost Breath 60, Water Shuriken 15,
    Absorb 20.
  - Geodude, Rock/Ground, Opportunist: Rock Tomb 60, Metal Spin 30, Snack Down
    50, Magnitude `--`.
- Below the cards: a primary **Choose Electrike** button and a **Reroll
  Starters** button.
- A right-hand column (the desktop sidebar): **WHERE** (Gym 1 of 8, Garnet,
  eight gym pips); **ELECTRIKE'S STATS** (sprite, type chip, Lv5, six rows of
  label, bar and number: HP 50, ATK 65, DEF 40, SpA 50, SpD 40, SPE 95); **TYPE
  MATCHUP (ELECTRIC)**: *Effective Against* Water, Flying; *Weak To* Ground.

The author's correction: the mockup's *Effective Against* is the species'
typing. It is to be the union of the super-effective targets of the
**moves'** types: Electrike's Electric, Flying and Rock.

---

## The rulings, 2026-10-01, before any code

Asked by the session, answered by the author.

1. **Reroll Starters: left out.** A reroll is new keyed draws made at
   generation, a new logged decision and a `RUN_LOG_VERSION` bump. A core
   patch of its own if it is still wanted.
2. **The bible is amended**, not deviated from: the message is the playtest
   observation, recorded in `../design/playtest-log.md`, and the amendment is
   Rev 19 in the same PR as the code.
3. **Effective against counts damaging moves only.** A status move deals no
   damage, so its type adds nothing.
4. **The mockup's detail panel**: compact cards without the stat block; a tap
   selects one and fills a detail panel (stats with numbers, the matchup) and a
   "Choose" button. Inside the game frame, beside the cards where the frame is
   wide and below them on a phone, because the desktop sidebar is hidden on a
   phone and is read-only.
