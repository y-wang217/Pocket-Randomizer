# Patch: the bench that outlived its run, and gym levels down to the party's

Filed on 2026-09-17, on `claude/amazing-edison-1koyiy`, before any work, with a
transcription of the screenshot it arrived with.

A playtest report, so it is filed as it was written rather than as a brief. It
is two items in one message: the first names a symptom and a cause that is not
the cause, and the second names a fix rather than a symptom. Both framings are
part of the record.

## The brief, verbatim

> bug report: on a new seed, party is not reset. screenshot shows a dead horsea
> when i'm on a new seed
>
> also gyms have mons at higher level than the player, which makes speed nearly
> impossible to compete against.
> let's reset gym levels to EQUAL to the player, never higher.

## The screenshot, transcribed

A phone-width battle screen, build stamp `0.3.0-#18`, seed
`GYMRUN-fd9b5e-XMVGWETI`, segment counter `1 / 8`.

- Opposing panel: `Opposing Yamper Lv4 ♂`, `1/? left`, HP `19 / 19 · 100%`,
  chips `ELECTRIC`, `MIXED TANK`, `STICKY HOLD`.
- Player panel: `Chingling Lv7 ♂`, HP `25 / 25 · 100%`, chips `PSYCHIC`,
  `SPEC. ATTACKER`, `MARVEL SCALE`, `▲ FIRST`.
- Four move cards: Confusion, Acid Spray, Mystical Power, Gust — all at full PP.
- Below them, a `SWITCH` heading and **one bench row**: `Horsea Lv7 ♀`,
  `WATER`, `0 / 23 Fainted`, greyed and disabled.

Both actives are at full HP on what the counters say is the first fight of a
fresh run, and the run's only party member is the starter. The Horsea is not in
this battle.

## What is asked

1. A new seed must not show a previous run's party.
2. Gym levels equal to the player's, never higher.

## What is deliberately not asked

The brief's diagnosis — "party is not reset" — is a reading of the symptom, not
a request to change `createRun`. Nothing in it asks for a change to what a gym
fields, how many it fields, or what it draws from; item 2 names one column of
one table and stops there.
