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
| starter | 34 | 20 | 71 |
| locale | 17 | 3 | 9 |
| map | 23 | 9 | 23 |
| battle | 20 | 6 | 27 |
| result | 26 | 12 | 14 |
| result-capture | 54 | 40 | 47 |
| target | 66 | 52 | 58 |
| replace | 29 | 15 | 25 |
| party | 31 | 17 | 20 |
| pre-gym | 17 | 3 | 6 |
| shop | 39 | 25 | 31 |
| event | 68 | 54 | 54 |
| result-relic | 34 | 20 | 24 |
| shop-relic | 49 | 35 | 43 |
| drawer | 30 | 16 | 19 |
| map-drawer | 34 | 20 | 34 |
| confirm-replace | 33 | 19 | 29 |
| confirm-forfeit | 74 | 60 | 66 |
| summary | 368 | 337 | 410 |
| log-sheet | 150 | 136 | 157 |

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
| reward card | 44 | 10 |
| map node card | 8 | 1 |
| locale card | 0 | 0 |
| starter card | 0 | 0 |
| event choice | 40 | 13 |
| app shell | 297 | 14 |
| screen chrome (no component) | 767 | — |

## Every word counted

The one face. One row per surface, so a number
above can be argued with rather than taken on faith.

- **starter** (34): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Choose` `your` `starter` `Species` `ability` `and` `moves` `are` `randomized` `HP` `and` `PP` `carry` `between` `fights` `a` `gym` `clear` `restores` `both` `GYMRUN-715122-SMOKE24` `r22`
- **locale** (17): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Choose` `a` `region` `GYMRUN-715122-SMOKE24` `r22`
- **map** (23): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `GYMRUN-715122-SMOKE24` `r22`
- **battle** (20): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Trainer's` `Seasoned` `Turn` `Paralysed` `Badly` `poisoned` `GYMRUN-715122-SMOKE24` `r22`
- **result** (26): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `one` `NORMAL` `Restore` `Restore` `Share` `of` `max` `HP` `and` `PP` `Clears` `status` `GYMRUN-715122-SMOKE24` `r22`
- **result-capture** (54): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Lv58` `Beaten` `Yours` `to` `take` `Party` `full` `one` `goes` `Your` `party` `of` `choose` `who` `to` `release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `Keep` `my` `party` `as` `it` `is` `GYMRUN-715122-SMOKE24` `r22`
- **target** (66): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `GYMRUN-715122-SMOKE24` `r22`
- **replace** (29): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-715122-SMOKE24` `r22`
- **party** (31): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Your` `party` `Slot` `leads` `Release` `is` `permanent` `Watch` `for` `Backpack` `of` `carried` `Relics` `Back` `to` `the` `map` `GYMRUN-715122-SMOKE24` `r22`
- **pre-gym** (17): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Send` `in` `Items` `GYMRUN-715122-SMOKE24` `r22`
- **shop** (39): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `Restore` `restore` `HP` `PP` `and` `status` `whole` `party` `Leave` `without` `buying` `GYMRUN-715122-SMOKE24` `r22`
- **event** (68): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `A` `sinkhole` `pool` `with` `a` `clear` `bottom` `and` `no` `shallows` `at` `all` `Fish` `from` `the` `rim` `A` `line` `brings` `something` `up` `Drop` `in` `and` `grab` `to` `the` `bottom` `and` `deep` `Drag` `it` `with` `nets` `Every` `pair` `of` `hands` `then` `cramp` `Costs` `HP` `party` `Go` `to` `the` `bottom` `there` `it` `has` `a` `floor` `Carry` `on` `GYMRUN-715122-SMOKE24` `r22`
- **result-relic** (34): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Choose` `a` `reward` `of` `the` `three` `There` `is` `no` `skip` `one` `ELITE` `Restore` `restore` `HP` `PP` `and` `status` `whole` `party` `GYMRUN-715122-SMOKE24` `r22`
- **shop-relic** (49): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `Restore` `Restore` `Share` `of` `max` `HP` `and` `PP` `Clears` `status` `Restore` `restore` `HP` `PP` `and` `status` `whole` `party` `Leave` `without` `buying` `GYMRUN-715122-SMOKE24` `r22`
- **drawer** (30): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `Your` `party` `Carrying` `now` `Relics` `Read` `only` `GYMRUN-715122-SMOKE24` `r22`
- **map-drawer** (34): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `The` `run` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `Pokemon` `Rookie` `GYMRUN-715122-SMOKE24` `r22`
- **confirm-replace** (33): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-715122-SMOKE24` `r22` `Replace` `with` `Replace` `Keep`
- **confirm-forfeit** (74): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Don't` `learn` `it` `GYMRUN-715122-SMOKE24` `r22` `Forfeit` `this` `reward` `Forfeit` `Keep`
- **summary** (368): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Stage` `gen9customgame` `a` `roster` `that` `grows` `caught` `in` `eight` `regions` `and` `scored` `Tutorial` `run` `Copy` `seed` `New` `seed` `gyms` `nodes` `fights` `turns` `rests` `seed` `GYMRUN-715122-SMOKE24` `The` `first` `gyms` `Past` `the` `opening` `The` `far` `side` `of` `the` `map` `gym` `short` `All` `eight` `Rematch` `this` `seed` `Copy` `seed` `Copy` `result` `New` `seed` `Score` `Gyms` `cleared` `Elite` `nodes` `taken` `Hard` `nodes` `taken` `Pokemon` `caught` `Relics` `held` `Standing` `at` `the` `end` `Turns` `taken` `Party` `slots` `Final` `party` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Mixed` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `in` `battle` `Lv30` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Lv30` `fell` `at` `Gym` `to` `Lv28` `fell` `at` `Gym` `to` `Lv46` `fell` `at` `Gym` `to` `Lv21` `fell` `at` `Gym` `to` `Lv30` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Coverage` `Reaches` `Fighting` `Ghost` `Ground` `Normal` `The` `run` `won` `in` `HP` `site` `rested` `HP` `Trainer's` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `site` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Shop` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Shop` `rested` `HP` `Something` `happens` `rested` `HP` `Ghost` `won` `in` `HP` `Trainer` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `GYMRUN-715122-SMOKE24` `r22`
- **log-sheet** (150): `M` `Map` `T` `Team` `B` `Bag` `R` `Info` `S` `Settings` `GYMRUN` `Tutorial` `Trainer's` `Seasoned` `Turn` `rose` `Fully` `paralysed` `History` `started` `between` `Player` `and` `Opponent` `Go` `Opponent` `sent` `out` `The` `opposing` `Golem's` `started` `to` `rain` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `continues` `to` `fall` `Turn` `The` `opposing` `used` `is` `paralyzed` `may` `be` `unable` `to` `move` `used` `The` `opposing` `was` `badly` `poisoned` `continues` `to` `fall` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `is` `paralyzed` `can't` `move` `continues` `to` `fall` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `continues` `to` `fall` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `won't` `go` `any` `higher` `is` `paralyzed` `can't` `move` `none` `ended` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `GYMRUN-715122-SMOKE24` `r22`
