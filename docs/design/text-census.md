# Text census

**Generated. Do not edit.** Rebuild with `npx vite-node scripts/visual/census.ts --write`.

Milestone M0.1. Words at rest per design bible section 4, excluding proper
nouns and bare numbers, counted per surface and per component (discrepancy
D2). Seed `SMOKE24`, viewport 390x844, every fixture loaded.

The rules, the component list and the glyph list are in the script, each with
its reason. Read them before reading a number.

## Per surface

The last column is the one section 4 budgets: the app shell renders on every
surface and is not the surface, so its words are shown separately below and
subtracted here.

| Surface | detailed | simple | pocket | pocket, less shell |
|---|---:|---:|---:|---:|
| starter | 93 | 84 | 78 | 74 |
| locale | 80 | 62 | 57 | 51 |
| map | 110 | 86 | 69 | 63 |
| battle | 52 | 52 | 31 | 25 |
| result | 75 | 55 | 52 | 46 |
| result-capture | 141 | 120 | 72 | 66 |
| target | 94 | 76 | 58 | 52 |
| replace | 45 | 38 | 22 | 16 |
| party | 475 | 476 | 30 | 24 |
| pre-gym | 248 | 254 | 45 | 39 |
| shop | 101 | 79 | 70 | 64 |
| event | 95 | 95 | 95 | 89 |
| drawer | 435 | 406 | 93 | 87 |
| map-drawer | 200 | 152 | 124 | 118 |
| summary | 498 | 454 | 363 | 342 |
| log-sheet | 163 | 163 | 142 | 136 |

## Per component

Every instance on every surface, summed. A component absent from the tree says
so rather than reading zero.

| Component | detailed | simple | pocket |
|---|---:|---:|---:|
| battle move button | 50 | 50 | 0 |
| move card | 376 | 376 | 0 |
| move chip | absent | absent | absent |
| party row | 481 | 457 | 121 |
| pokemon battle panel | 20 | 20 | 20 |
| flag strip | 11 | 11 | 11 |
| confirm overlay | absent | absent | absent |
| stat block | 90 | 108 | 0 |
| app shell | 109 | 109 | 109 |
| screen chrome (no component) | 1768 | 1521 | 1140 |

## Every word counted, in Pocket

The mode the bible specifies as the face. One row per surface, so a number
above can be argued with rather than taken on faith.

- **starter** (78): `GYMRUN` `Tutorial` `Choose` `your` `starter` `Species` `ability` `and` `moves` `are` `randomized` `HP` `and` `PP` `carry` `between` `fights` `a` `gym` `clear` `restores` `both` `Lv15` `Phys` `Attacker` `HP` `HP` `Atk` `Def` `SpA` `SpD` `Spe` `BP` `PP` `BP` `PP` `BP` `PP` `BP` `PP` `Lv15` `Spec` `Attacker` `HP` `HP` `Atk` `Def` `SpA` `SpD` `Spe` `BP` `PP` `BP` `PP` `BP` `PP` `Status` `PP` `Lv15` `Spec` `Attacker` `HP` `HP` `Atk` `Def` `SpA` `SpD` `Spe` `BP` `PP` `BP` `PP` `BP` `PP` `Status` `PP` `GYMRUN-d4e080-SMOKE24` `r21`
- **locale** (57): `GYMRUN` `Tutorial` `Map` `Party` `Segment` `choose` `a` `region` `This` `segment` `ends` `at` `The` `region` `decides` `the` `wild` `Pokemon` `here` `and` `nothing` `else` `Lv36` `Phys` `Attacker` `Lv44` `Phys` `Attacker` `Lv32` `Phys` `Attacker` `Lv30` `Phys` `Attacker` `Lv48` `Mixed` `Attacker` `Lv21` `Phys` `Attacker` `Canopy` `and` `something` `moving` `in` `it` `Standing` `water` `and` `slow` `ground` `air` `and` `no` `horizon` `GYMRUN-d4e080-SMOKE24` `r21`
- **map** (69): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lv36` `Lead` `Lv44` `Lv32` `Lv30` `Lv48` `Lv21` `GYMRUN-d4e080-SMOKE24` `r21`
- **battle** (31): `GYMRUN` `Tutorial` `Map` `Party` `A` `loaded` `board` `A` `trainer` `left` `Opposing` `Lv100` `Phys` `Attacker` `STAGES` `Lv100` `Spec` `Tank` `STAGES` `Lv44` `Lv32` `Lv30` `Lv48` `Lv21` `used` `Paralysed` `Badly` `poisoned` `History` `GYMRUN-d4e080-SMOKE24` `r21`
- **result** (52): `GYMRUN` `Tutorial` `Map` `Party` `coins` `total` `Nobody` `went` `down` `Your` `party` `after` `the` `battle` `HP` `PP` `HP` `PP` `HP` `PP` `HP` `PP` `HP` `PP` `HP` `PP` `one` `NORMAL` `Held` `item` `Halves` `one` `super-effective` `hit` `your` `backpack` `Restore` `Restore` `HP` `PP` `and` `status` `whole` `party` `TM` `You` `choose` `who` `learns` `it` `GYMRUN-d4e080-SMOKE24` `r21`
- **result-capture** (72): `GYMRUN` `Tutorial` `Map` `Party` `coins` `total` `Nobody` `went` `down` `Lv13` `Beaten` `Yours` `to` `take` `Party` `full` `one` `goes` `Lv13` `HP` `Atk` `Def` `SpA` `SpD` `Spe` `Coverage` `if` `it` `replaces` `your` `first` `member` `unchanged` `Your` `party` `of` `choose` `who` `to` `release` `Lv36` `to` `bag` `Release` `Lv44` `to` `bag` `Release` `Lv32` `to` `bag` `Release` `Lv30` `to` `bag` `Release` `Lv48` `to` `bag` `Release` `Lv21` `to` `bag` `Release` `Keep` `my` `party` `as` `it` `is` `GYMRUN-d4e080-SMOKE24` `r21`
- **target** (58): `GYMRUN` `Tutorial` `Map` `Party` `TM` `Who` `learns` `it` `Lv36` `HP` `Four` `moves` `You` `choose` `what` `replaces` `Lv44` `HP` `Four` `moves` `You` `choose` `what` `replaces` `Lv32` `HP` `Four` `moves` `You` `choose` `what` `replaces` `Lv30` `HP` `Four` `moves` `You` `choose` `what` `replaces` `Lv48` `HP` `Four` `moves` `You` `choose` `what` `replaces` `Lv21` `HP` `Four` `moves` `You` `choose` `what` `replaces` `GYMRUN-d4e080-SMOKE24` `r21`
- **replace** (22): `GYMRUN` `Tutorial` `Map` `Party` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Lv36` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-d4e080-SMOKE24` `r21`
- **party** (30): `GYMRUN` `Tutorial` `Map` `Party` `Your` `party` `Slot` `leads` `Release` `is` `permanent` `Watch` `for` `Lv36` `Lead` `Lv44` `Lv32` `Lv30` `Lv48` `Lv21` `Backpack` `of` `carried` `Relics` `Back` `to` `the` `map` `GYMRUN-d4e080-SMOKE24` `r21`
- **pre-gym** (45): `GYMRUN` `Tutorial` `Map` `Party` `Draven's` `gym` `Gym` `of` `Who` `leads` `Lv36` `Lead` `Leading` `Lv44` `Lead` `with` `this` `one` `Lv32` `Lead` `with` `this` `one` `Lv30` `Lead` `with` `this` `one` `Lv48` `Lead` `with` `this` `one` `Lv21` `Lead` `with` `this` `one` `Send` `in` `Party` `screen` `items` `GYMRUN-d4e080-SMOKE24` `r21`
- **shop** (70): `GYMRUN` `Tutorial` `Map` `Party` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `move` `TM` `You` `choose` `who` `learns` `it` `Add` `Technique` `Technique` `You` `choose` `who` `learns` `it` `Add` `Cures` `any` `status` `condition` `once` `Add` `Restore` `restore` `HP` `PP` `and` `status` `Add` `Held` `item` `Water-type` `moves` `have` `power` `Add` `Held` `item` `Attackers` `making` `contact` `lose` `of` `their` `max` `HP` `Add` `Leave` `without` `buying` `GYMRUN-d4e080-SMOKE24` `r21`
- **event** (95): `GYMRUN` `Tutorial` `Map` `Party` `Something` `happens` `Requires` `you` `have` `the` `relic` `A` `fallen` `giant` `across` `a` `ravine` `with` `something` `nesting` `in` `it` `and` `keep` `going` `The` `trunk` `is` `a` `bridge` `Using` `it` `as` `one` `costs` `nothing` `Reward` `T1` `into` `the` `hollow` `Whatever` `is` `nesting` `in` `there` `is` `nesting` `in` `there` `Reward` `T0` `to` `T2` `the` `nest` `out` `Clearing` `it` `means` `everyone` `gets` `bitten` `at` `least` `once` `Costs` `HP` `party` `Reward` `T2` `Roll` `the` `trunk` `over` `The` `trunk` `turns` `and` `the` `underside` `has` `not` `been` `touched` `Reward` `T2` `to` `T3` `HP` `lead` `Carry` `on` `GYMRUN-d4e080-SMOKE24` `r21`
- **drawer** (93): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lv36` `Lead` `Lv44` `Lv32` `Lv30` `Lv48` `Lv21` `Your` `party` `Carrying` `now` `Lv36` `Lead` `Lv44` `Lv32` `Lv30` `Lv48` `Lv21` `Relics` `Read` `only` `Density` `Detailed` `Pocket` `Move` `bar` `Grid` `Columns` `speed` `Even` `Patient` `GYMRUN-d4e080-SMOKE24` `r21`
- **map-drawer** (124): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lv36` `Lead` `Lv44` `Lv32` `Lv30` `Lv48` `Lv21` `The` `run` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `GYMRUN-d4e080-SMOKE24` `r21`
- **summary** (363): `GYMRUN` `Stage` `gen9customgame` `a` `roster` `that` `grows` `caught` `in` `eight` `regions` `and` `scored` `Tutorial` `run` `Copy` `seed` `New` `seed` `gyms` `nodes` `fights` `turns` `rests` `seed` `GYMRUN-d4e080-SMOKE24` `The` `first` `gyms` `Past` `the` `opening` `The` `far` `side` `of` `the` `map` `gym` `short` `All` `eight` `Rematch` `this` `seed` `Copy` `seed` `Copy` `result` `New` `seed` `Score` `Gyms` `cleared` `Elite` `nodes` `taken` `Hard` `nodes` `taken` `Pokemon` `caught` `Relics` `held` `Standing` `at` `the` `end` `Turns` `taken` `Party` `slots` `Final` `party` `Lv36` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Lv44` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Lv32` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Lv30` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Lv48` `Mixed` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Lv21` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `in` `battle` `Lv36` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Lv32` `fell` `at` `Gym` `to` `Lv30` `fell` `at` `Gym` `to` `Lv48` `fell` `at` `Gym` `to` `Lv21` `fell` `at` `Gym` `to` `Lv36` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Coverage` `Reaches` `Fighting` `Ghost` `Ground` `The` `run` `won` `in` `HP` `site` `rested` `HP` `Trainer's` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `site` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Shop` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Shop` `rested` `HP` `Something` `happens` `rested` `HP` `Ghost` `won` `in` `HP` `Trainer` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `GYMRUN-d4e080-SMOKE24` `r21`
- **log-sheet** (142): `GYMRUN` `Tutorial` `Map` `Party` `A` `loaded` `board` `A` `trainer` `left` `Opposing` `Lv100` `Phys` `Attacker` `STAGES` `Lv100` `Spec` `Tank` `STAGES` `Lv44` `Lv32` `Lv30` `Lv48` `Lv21` `Opposing` `used` `rose` `Fully` `paralysed` `History` `History` `started` `between` `Player` `and` `Opponent` `Go` `Opponent` `sent` `out` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `Turn` `The` `opposing` `used` `is` `paralyzed` `may` `be` `unable` `to` `move` `used` `The` `opposing` `was` `badly` `poisoned` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `is` `paralyzed` `can't` `move` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `won't` `go` `any` `higher` `is` `paralyzed` `can't` `move` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `GYMRUN-d4e080-SMOKE24` `r21`
