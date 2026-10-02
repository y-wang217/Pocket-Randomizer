# Text census

**Generated. Do not edit.** Rebuild with `npx vite-node scripts/visual/census.ts --write`.

Milestone M0.1. Words at rest per design bible section 4, excluding proper
nouns and bare numbers, counted per surface and per component (discrepancy
D2). Seed `SMOKE24`, viewport 390x844, every fixture loaded.

The rules, the component list and the glyph list are in the script, each with
its reason. Read them before reading a number.

## Per surface

`less shell` is the column section 4 budgets: the app shell renders on every
surface and is not the surface, so its words are shown separately below and
subtracted here.

Every column but the last is the steady state: every glyph family past R7's
third exposure, which is the face section 4 budgets (D44). **The last column
is a first launch**, less shell at a fresh store, with every exposure label
that is due. It is recorded and never gated. One face since Stage 5.0/1, so
the three density columns this table carried are one.

| Surface | words | less shell | first run |
|---|---:|---:|---:|
| starter | 29 | 20 | 38 |
| locale | 12 | 3 | 10 |
| map | 18 | 9 | 22 |
| battle | 15 | 6 | 30 |
| result | 11 | 2 | 4 |
| result-capture | 49 | 40 | 65 |
| target | 61 | 52 | 77 |
| replace | 24 | 15 | 23 |
| party | 26 | 17 | 40 |
| pre-gym | 12 | 3 | 25 |
| shop | 26 | 17 | 29 |
| event | 63 | 54 | 54 |
| result-relic | 21 | 12 | 16 |
| shop-relic | 26 | 17 | 32 |
| drawer | 25 | 16 | 38 |
| map-drawer | 29 | 20 | 33 |
| confirm-replace | 28 | 19 | 27 |
| confirm-forfeit | 69 | 60 | 85 |
| summary | 361 | 335 | 402 |
| log-sheet | 145 | 136 | 160 |

## Per component

Every instance on every surface, summed. A component absent from the tree says
so rather than reading zero.

**The last column is the one a budget is checked against** (D30). Section 4's
figures are ceilings (D1), and a ceiling binds the worst instance, not the
total: three reward cards summing to 22 is 8 + 8 + 6, which passes a ceiling
of 8, or 14 + 4 + 4, which does not. The two columns are equal only where the
budget is 0 or the component renders once.

| Component | words | worst instance |
|---|---:|---:|
| battle move button | 0 | 0 |
| move card | 0 | 0 |
| move chip | 0 | 0 |
| party row | 18 | 3 |
| pokemon battle panel | 0 | 0 |
| party drawer | 7 | 7 |
| flag strip | 6 | 3 |
| confirm overlay | 9 | 5 |
| stat block | 0 | 0 |
| reward card | 0 | 0 |
| map node card | 8 | 1 |
| locale card | 0 | 0 |
| starter card | 0 | 0 |
| starter detail panel | 0 | 0 |
| event choice | 40 | 13 |
| app shell | 197 | 14 |
| screen chrome (no component) | 765 | — |

## Every word counted

The one face. One row per surface, so a number
above can be argued with rather than taken on faith.

- **starter** (29): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Choose` `your` `starter` `Species` `ability` `and` `moves` `are` `randomized` `HP` `and` `PP` `carry` `between` `fights` `a` `gym` `clear` `restores` `both` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **locale** (12): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Choose` `a` `region` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **map** (18): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **battle** (15): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Trainer's` `Seasoned` `Turn` `Paralysed` `Badly` `poisoned` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **result** (11): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `one` `NORMAL` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **result-capture** (49): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Lv58` `Beaten` `Yours` `to` `take` `Party` `full` `one` `goes` `Your` `party` `of` `choose` `who` `to` `release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `Keep` `my` `party` `as` `it` `is` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **target** (61): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **replace** (24): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **party** (26): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Your` `party` `Slot` `leads` `Release` `is` `permanent` `Watch` `for` `Backpack` `of` `carried` `Relics` `Back` `to` `the` `map` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **pre-gym** (12): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Send` `in` `Items` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **shop** (26): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `Leave` `without` `buying` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **event** (63): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `A` `sinkhole` `pool` `with` `a` `clear` `bottom` `and` `no` `shallows` `at` `all` `Fish` `from` `the` `rim` `A` `line` `brings` `something` `up` `Drop` `in` `and` `grab` `to` `the` `bottom` `and` `deep` `Drag` `it` `with` `nets` `Every` `pair` `of` `hands` `then` `cramp` `Costs` `HP` `party` `Go` `to` `the` `bottom` `there` `it` `has` `a` `floor` `Carry` `on` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **result-relic** (21): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Choose` `a` `reward` `of` `the` `three` `There` `is` `no` `skip` `one` `ELITE` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **shop-relic** (26): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `Leave` `without` `buying` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **drawer** (25): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `Your` `party` `Carrying` `now` `Relics` `Read` `only` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **map-drawer** (29): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `The` `run` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **confirm-replace** (28): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-dfe1e4-SMOKE24` `r23` `Replace` `with` `Replace` `Keep`
- **confirm-forfeit** (69): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Don't` `learn` `it` `GYMRUN-dfe1e4-SMOKE24` `r23` `Forfeit` `this` `reward` `Forfeit` `Keep`
- **summary** (361): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Stage` `gen9customgame` `a` `roster` `that` `grows` `caught` `in` `eight` `regions` `and` `scored` `Tutorial` `run` `Copy` `seed` `New` `seed` `gyms` `nodes` `fights` `turns` `rests` `seed` `GYMRUN-dfe1e4-SMOKE24` `The` `first` `gyms` `Past` `the` `opening` `The` `far` `side` `of` `the` `map` `gym` `short` `All` `eight` `Rematch` `this` `seed` `Copy` `seed` `Copy` `result` `New` `seed` `Score` `Gyms` `cleared` `Elite` `nodes` `taken` `Hard` `nodes` `taken` `Pokemon` `caught` `Relics` `held` `Standing` `at` `the` `end` `Turns` `taken` `Party` `slots` `Final` `party` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Mixed` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `in` `battle` `Lv32` `fell` `at` `Gym` `to` `Lv30` `fell` `at` `Gym` `to` `Lv27` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Lv31` `fell` `at` `Gym` `to` `Lv46` `fell` `at` `Gym` `to` `Lv32` `fell` `at` `Gym` `to` `Lv30` `fell` `at` `Gym` `to` `Coverage` `Reaches` `Ghost` `Ground` `Normal` `The` `run` `won` `in` `HP` `site` `rested` `HP` `Trainer's` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `site` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Shop` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Ghost` `won` `in` `HP` `Trainer` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `GYMRUN-dfe1e4-SMOKE24` `r23`
- **log-sheet** (145): `Map` `Team` `Bag` `Info` `Settings` `GYMRUN` `Tutorial` `Trainer's` `Seasoned` `Turn` `rose` `Fully` `paralysed` `History` `started` `between` `Player` `and` `Opponent` `Go` `Opponent` `sent` `out` `The` `opposing` `Golem's` `started` `to` `rain` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `continues` `to` `fall` `Turn` `The` `opposing` `used` `is` `paralyzed` `may` `be` `unable` `to` `move` `used` `The` `opposing` `was` `badly` `poisoned` `continues` `to` `fall` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `is` `paralyzed` `can't` `move` `continues` `to` `fall` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `continues` `to` `fall` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `won't` `go` `any` `higher` `is` `paralyzed` `can't` `move` `none` `ended` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `GYMRUN-dfe1e4-SMOKE24` `r23`
