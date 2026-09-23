# Text census

**Generated. Do not edit.** Rebuild with `npx vite-node scripts/visual/census.ts --write`.

Milestone M0.1. Words at rest per design bible section 4, excluding proper
nouns and bare numbers, counted per surface and per component (discrepancy
D2). Seed `SMOKE24`, viewport 390x844, every fixture loaded.

The rules, the component list and the glyph list are in the script, each with
its reason. Read them before reading a number.

## Per surface

`pocket, less shell` is the column section 4 budgets: the app shell renders on every
surface and is not the surface, so its words are shown separately below and
subtracted here.

Every column but the last is the steady state: every glyph family past R7's
third exposure, which is the face section 4 budgets (D44). **The last column
is a first launch**, Pocket less shell at a fresh store, with every exposure
label that is due. It is recorded and never gated.

| Surface | detailed | simple | pocket | pocket, less shell | first run |
|---|---:|---:|---:|---:|---:|
| starter | 98 | 89 | 24 | 20 | 20 |
| locale | 14 | 14 | 9 | 3 | 3 |
| map | 50 | 43 | 28 | 22 | 22 |
| battle | 36 | 36 | 13 | 7 | 7 |
| result | 24 | 19 | 16 | 10 | 10 |
| result-capture | 102 | 81 | 46 | 40 | 40 |
| target | 231 | 201 | 58 | 52 | 52 |
| replace | 40 | 33 | 21 | 15 | 15 |
| party | 407 | 408 | 23 | 17 | 17 |
| pre-gym | 151 | 157 | 9 | 3 | 3 |
| shop | 56 | 40 | 31 | 25 | 25 |
| event | 60 | 60 | 60 | 54 | 54 |
| result-relic | 34 | 29 | 26 | 20 | 20 |
| shop-relic | 69 | 48 | 39 | 33 | 33 |
| drawer | 284 | 272 | 41 | 35 | 35 |
| map-drawer | 86 | 72 | 48 | 42 | 42 |
| confirm-replace | 51 | 44 | 25 | 19 | 19 |
| confirm-forfeit | 243 | 213 | 66 | 60 | 60 |
| summary | 492 | 448 | 357 | 336 | 336 |
| log-sheet | 146 | 146 | 123 | 117 | 117 |

## Per component

Every instance on every surface, summed. A component absent from the tree says
so rather than reading zero.

**The last column is the one a budget is checked against** (D30). Section 4's
figures are ceilings (D1), and a ceiling binds the worst instance, not the
total: three reward cards summing to 22 is 8 + 8 + 6, which passes a ceiling
of 8, or 14 + 4 + 4, which does not. The two columns are equal only where the
budget is 0 or the component renders once.

| Component | detailed | simple | pocket | worst instance, pocket |
|---|---:|---:|---:|---:|
| battle move button | 38 | 38 | 0 | 0 |
| move card | 631 | 631 | 0 | 0 |
| move chip | 16 | 16 | 0 | 0 |
| party row | 198 | 186 | 21 | 3 |
| pokemon battle panel | 4 | 4 | 0 | 0 |
| party drawer | 71 | 60 | 13 | 13 |
| flag strip | 6 | 6 | 6 | 3 |
| confirm overlay | 9 | 9 | 9 | 5 |
| stat block | 174 | 204 | 0 | 0 |
| reward card | 65 | 40 | 40 | 8 |
| map node card | 72 | 44 | 44 | 3 |
| locale card | 3 | 3 | 0 | 0 |
| starter card | 1 | 1 | 0 | 0 |
| event choice | 40 | 40 | 40 | 13 |
| app shell | 133 | 133 | 133 | 14 |
| screen chrome (no component) | 1213 | 1038 | 757 | — |

## Every word counted, in Pocket

The mode the bible specifies as the face. One row per surface, so a number
above can be argued with rather than taken on faith.

- **starter** (24): `GYMRUN` `Tutorial` `Choose` `your` `starter` `Species` `ability` `and` `moves` `are` `randomized` `HP` `and` `PP` `carry` `between` `fights` `a` `gym` `clear` `restores` `both` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **locale** (9): `GYMRUN` `Tutorial` `Map` `Party` `Choose` `a` `region` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **map** (28): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `coins` `Rookie` `Trainer` `coins` `Something` `happens` `Trainer` `Trainer` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lead` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **battle** (13): `GYMRUN` `Tutorial` `Map` `Party` `Trainer` `battle` `Trainer's` `Rookie` `Paralysed` `Badly` `poisoned` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **result** (16): `GYMRUN` `Tutorial` `Map` `Party` `one` `NORMAL` `Restore` `Restore` `HP` `PP` `and` `status` `whole` `party` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **result-capture** (46): `GYMRUN` `Tutorial` `Map` `Party` `Lv13` `Beaten` `Yours` `to` `take` `Party` `full` `one` `goes` `Your` `party` `of` `choose` `who` `to` `release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `Keep` `my` `party` `as` `it` `is` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **target** (58): `GYMRUN` `Tutorial` `Map` `Party` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **replace** (21): `GYMRUN` `Tutorial` `Map` `Party` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **party** (23): `GYMRUN` `Tutorial` `Map` `Party` `Your` `party` `Slot` `leads` `Release` `is` `permanent` `Watch` `for` `Backpack` `of` `carried` `Relics` `Back` `to` `the` `map` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **pre-gym** (9): `GYMRUN` `Tutorial` `Map` `Party` `Send` `in` `Items` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **shop** (31): `GYMRUN` `Tutorial` `Map` `Party` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `Restore` `restore` `HP` `PP` `and` `status` `whole` `party` `Leave` `without` `buying` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **event** (60): `GYMRUN` `Tutorial` `Map` `Party` `A` `sinkhole` `pool` `with` `a` `clear` `bottom` `and` `no` `shallows` `at` `all` `Fish` `from` `the` `rim` `A` `line` `brings` `something` `up` `Drop` `in` `and` `grab` `to` `the` `bottom` `and` `deep` `Drag` `it` `with` `nets` `Every` `pair` `of` `hands` `then` `cramp` `Costs` `HP` `party` `Go` `to` `the` `bottom` `there` `it` `has` `a` `floor` `Carry` `on` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **result-relic** (26): `GYMRUN` `Tutorial` `Map` `Party` `Choose` `a` `reward` `of` `the` `three` `There` `is` `no` `skip` `one` `ELITE` `Restore` `restore` `HP` `PP` `and` `status` `whole` `party` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **shop-relic** (39): `GYMRUN` `Tutorial` `Map` `Party` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `Restore` `Restore` `HP` `PP` `and` `status` `whole` `party` `Restore` `restore` `HP` `PP` `and` `status` `whole` `party` `Leave` `without` `buying` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **drawer** (41): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `coins` `Rookie` `Trainer` `coins` `Something` `happens` `Trainer` `Trainer` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lead` `Your` `party` `Carrying` `now` `Relics` `Read` `only` `Density` `Detailed` `Pocket` `speed` `Even` `Patient` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **map-drawer** (48): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `coins` `Rookie` `Trainer` `coins` `Something` `happens` `Trainer` `Trainer` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lead` `The` `run` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `coins` `Rookie` `Trainer` `coins` `Something` `happens` `Trainer` `Trainer` `Garnet's` `Gym` `Pokemon` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **confirm-replace** (25): `GYMRUN` `Tutorial` `Map` `Party` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-0b2c2c-SMOKE24` `r21` `Replace` `with` `Replace` `Keep`
- **confirm-forfeit** (66): `GYMRUN` `Tutorial` `Map` `Party` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Don't` `learn` `it` `GYMRUN-0b2c2c-SMOKE24` `r21` `Forfeit` `this` `reward` `Forfeit` `Keep`
- **summary** (357): `GYMRUN` `Stage` `gen9customgame` `a` `roster` `that` `grows` `caught` `in` `eight` `regions` `and` `scored` `Tutorial` `run` `Copy` `seed` `New` `seed` `gyms` `nodes` `fights` `turns` `rests` `seed` `GYMRUN-0b2c2c-SMOKE24` `The` `first` `gyms` `Past` `the` `opening` `The` `far` `side` `of` `the` `map` `gym` `short` `All` `eight` `Rematch` `this` `seed` `Copy` `seed` `Copy` `result` `New` `seed` `Score` `Gyms` `cleared` `Elite` `nodes` `taken` `Hard` `nodes` `taken` `Pokemon` `caught` `Relics` `held` `Standing` `at` `the` `end` `Turns` `taken` `Party` `slots` `Final` `party` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Mixed` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `in` `battle` `Lv36` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Lv32` `fell` `at` `Gym` `to` `Lv30` `fell` `at` `Gym` `to` `Lv48` `fell` `at` `Gym` `to` `Lv21` `fell` `at` `Gym` `to` `Lv36` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Coverage` `Reaches` `Fighting` `Ghost` `Ground` `The` `run` `won` `in` `HP` `site` `rested` `HP` `Trainer's` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `site` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Shop` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Shop` `rested` `HP` `Something` `happens` `rested` `HP` `Ghost` `won` `in` `HP` `Trainer` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `GYMRUN-0b2c2c-SMOKE24` `r21`
- **log-sheet** (123): `GYMRUN` `Tutorial` `Map` `Party` `Trainer` `battle` `Trainer's` `Rookie` `rose` `Fully` `paralysed` `History` `started` `between` `Player` `and` `Opponent` `Go` `Opponent` `sent` `out` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `Turn` `The` `opposing` `used` `is` `paralyzed` `may` `be` `unable` `to` `move` `used` `The` `opposing` `was` `badly` `poisoned` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `is` `paralyzed` `can't` `move` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `won't` `go` `any` `higher` `is` `paralyzed` `can't` `move` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `GYMRUN-0b2c2c-SMOKE24` `r21`
