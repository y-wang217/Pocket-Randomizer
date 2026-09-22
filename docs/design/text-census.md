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
| starter | 84 | 75 | 51 | 47 |
| locale | 74 | 56 | 51 | 45 |
| map | 104 | 80 | 63 | 57 |
| battle | 36 | 36 | 13 | 7 |
| result | 75 | 55 | 52 | 46 |
| result-capture | 132 | 111 | 59 | 53 |
| target | 231 | 201 | 58 | 52 |
| replace | 40 | 33 | 21 | 15 |
| party | 407 | 408 | 23 | 17 |
| pre-gym | 180 | 186 | 38 | 32 |
| shop | 101 | 79 | 70 | 64 |
| event | 95 | 95 | 95 | 89 |
| drawer | 338 | 309 | 76 | 70 |
| map-drawer | 194 | 146 | 118 | 112 |
| confirm-replace | 51 | 44 | 25 | 19 |
| confirm-forfeit | 243 | 213 | 66 | 60 |
| summary | 492 | 448 | 357 | 336 |
| log-sheet | 146 | 146 | 123 | 117 |

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
| move card | 573 | 573 | 0 | 0 |
| move chip | 16 | 16 | 0 | 0 |
| party row | 198 | 186 | 21 | 3 |
| pokemon battle panel | 4 | 4 | 0 | 0 |
| party drawer | 71 | 60 | 13 | 13 |
| flag strip | 6 | 6 | 6 | 3 |
| confirm overlay | 9 | 9 | 9 | 5 |
| stat block | 174 | 204 | 0 | 0 |
| reward card | 42 | 22 | 22 | 8 |
| shop stock card | 58 | 47 | 47 | 11 |
| map node card | 288 | 192 | 184 | 12 |
| locale card | 18 | 18 | 15 | 6 |
| app shell | 121 | 121 | 121 | 14 |
| screen chrome (no component) | 1407 | 1225 | 921 | — |

## Every word counted, in Pocket

The mode the bible specifies as the face. One row per surface, so a number
above can be argued with rather than taken on faith.

- **starter** (51): `GYMRUN` `Tutorial` `Choose` `your` `starter` `Species` `ability` `and` `moves` `are` `randomized` `HP` `and` `PP` `carry` `between` `fights` `a` `gym` `clear` `restores` `both` `HP` `BP` `PP` `BP` `PP` `BP` `PP` `BP` `PP` `HP` `BP` `PP` `BP` `PP` `BP` `PP` `Status` `PP` `HP` `BP` `PP` `BP` `PP` `BP` `PP` `Status` `PP` `GYMRUN-d4e080-SMOKE24` `r21`
- **locale** (51): `GYMRUN` `Tutorial` `Map` `Party` `Segment` `choose` `a` `region` `This` `segment` `ends` `at` `The` `region` `decides` `the` `wild` `Pokemon` `here` `and` `nothing` `else` `Phys` `Attacker` `Phys` `Attacker` `Phys` `Attacker` `Phys` `Attacker` `Mixed` `Attacker` `Phys` `Attacker` `Canopy` `and` `something` `moving` `in` `it` `Standing` `water` `and` `slow` `ground` `air` `and` `no` `horizon` `GYMRUN-d4e080-SMOKE24` `r21`
- **map** (63): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lead` `GYMRUN-d4e080-SMOKE24` `r21`
- **battle** (13): `GYMRUN` `Tutorial` `Map` `Party` `Trainer` `battle` `Trainer's` `Rookie` `Paralysed` `Badly` `poisoned` `GYMRUN-d4e080-SMOKE24` `r21`
- **result** (52): `GYMRUN` `Tutorial` `Map` `Party` `coins` `total` `Nobody` `went` `down` `Your` `party` `after` `the` `battle` `HP` `PP` `HP` `PP` `HP` `PP` `HP` `PP` `HP` `PP` `HP` `PP` `one` `NORMAL` `Held` `item` `Halves` `one` `super-effective` `hit` `your` `backpack` `Restore` `Restore` `HP` `PP` `and` `status` `whole` `party` `TM` `You` `choose` `who` `learns` `it` `GYMRUN-d4e080-SMOKE24` `r21`
- **result-capture** (59): `GYMRUN` `Tutorial` `Map` `Party` `coins` `total` `Nobody` `went` `down` `Lv13` `Beaten` `Yours` `to` `take` `Party` `full` `one` `goes` `Coverage` `if` `it` `replaces` `your` `first` `member` `unchanged` `Your` `party` `of` `choose` `who` `to` `release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `to` `bag` `Release` `Keep` `my` `party` `as` `it` `is` `GYMRUN-d4e080-SMOKE24` `r21`
- **target** (58): `GYMRUN` `Tutorial` `Map` `Party` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `GYMRUN-d4e080-SMOKE24` `r21`
- **replace** (21): `GYMRUN` `Tutorial` `Map` `Party` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-d4e080-SMOKE24` `r21`
- **party** (23): `GYMRUN` `Tutorial` `Map` `Party` `Your` `party` `Slot` `leads` `Release` `is` `permanent` `Watch` `for` `Backpack` `of` `carried` `Relics` `Back` `to` `the` `map` `GYMRUN-d4e080-SMOKE24` `r21`
- **pre-gym** (38): `GYMRUN` `Tutorial` `Map` `Party` `Draven's` `gym` `Gym` `of` `Who` `leads` `Leading` `Lead` `with` `this` `one` `Lead` `with` `this` `one` `Lead` `with` `this` `one` `Lead` `with` `this` `one` `Lead` `with` `this` `one` `Send` `in` `Party` `screen` `items` `GYMRUN-d4e080-SMOKE24` `r21`
- **shop** (70): `GYMRUN` `Tutorial` `Map` `Party` `Shop` `Nothing` `is` `bought` `until` `you` `leave` `selling` `no` `coming` `back` `Carrying` `Basket` `Left` `move` `TM` `You` `choose` `who` `learns` `it` `Add` `Technique` `Technique` `You` `choose` `who` `learns` `it` `Add` `Cures` `any` `status` `condition` `once` `Add` `Restore` `restore` `HP` `PP` `and` `status` `Add` `Held` `item` `Water-type` `moves` `have` `power` `Add` `Held` `item` `Attackers` `making` `contact` `lose` `of` `their` `max` `HP` `Add` `Leave` `without` `buying` `GYMRUN-d4e080-SMOKE24` `r21`
- **event** (95): `GYMRUN` `Tutorial` `Map` `Party` `Something` `happens` `Requires` `you` `have` `the` `relic` `A` `fallen` `giant` `across` `a` `ravine` `with` `something` `nesting` `in` `it` `and` `keep` `going` `The` `trunk` `is` `a` `bridge` `Using` `it` `as` `one` `costs` `nothing` `Reward` `T1` `into` `the` `hollow` `Whatever` `is` `nesting` `in` `there` `is` `nesting` `in` `there` `Reward` `T0` `to` `T2` `the` `nest` `out` `Clearing` `it` `means` `everyone` `gets` `bitten` `at` `least` `once` `Costs` `HP` `party` `Reward` `T2` `Roll` `the` `trunk` `over` `The` `trunk` `turns` `and` `the` `underside` `has` `not` `been` `touched` `Reward` `T2` `to` `T3` `HP` `lead` `Carry` `on` `GYMRUN-d4e080-SMOKE24` `r21`
- **drawer** (76): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lead` `Your` `party` `Carrying` `now` `Relics` `Read` `only` `Density` `Detailed` `Pocket` `speed` `Even` `Patient` `GYMRUN-d4e080-SMOKE24` `r21`
- **map-drawer** (118): `GYMRUN` `Tutorial` `Map` `Party` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `Coins` `Party` `Manage` `Lead` `The` `run` `Gym` `of` `Pokemon` `steps` `before` `the` `gym` `NORMAL` `coins` `Rookie` `At` `the` `segment's` `level` `and` `band` `Pays` `its` `band` `Trainer` `HARD` `coins` `A` `touch` `higher` `band` `Pays` `one` `band` `up` `Something` `happens` `Requires` `you` `have` `the` `relic` `Trainer` `NORMAL` `Trainer` `NORMAL` `HARD` `Requires` `you` `have` `the` `relic` `HARD` `HARD` `NORMAL` `Garnet's` `Gym` `Pokemon` `GYMRUN-d4e080-SMOKE24` `r21`
- **confirm-replace** (25): `GYMRUN` `Tutorial` `Map` `Party` `learns` `Pick` `the` `move` `it` `replaces` `undo` `Learning` `Phys` `Attacker` `Knows` `tap` `one` `to` `replace` `GYMRUN-d4e080-SMOKE24` `r21` `Replace` `with` `Replace` `Keep`
- **confirm-forfeit** (66): `GYMRUN` `Tutorial` `Map` `Party` `TM` `Who` `learns` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Four` `moves` `You` `choose` `what` `replaces` `Teach` `it` `Don't` `learn` `it` `GYMRUN-d4e080-SMOKE24` `r21` `Forfeit` `this` `reward` `Forfeit` `Keep`
- **summary** (357): `GYMRUN` `Stage` `gen9customgame` `a` `roster` `that` `grows` `caught` `in` `eight` `regions` `and` `scored` `Tutorial` `run` `Copy` `seed` `New` `seed` `gyms` `nodes` `fights` `turns` `rests` `seed` `GYMRUN-d4e080-SMOKE24` `The` `first` `gyms` `Past` `the` `opening` `The` `far` `side` `of` `the` `map` `gym` `short` `All` `eight` `Rematch` `this` `seed` `Copy` `seed` `Copy` `result` `New` `seed` `Score` `Gyms` `cleared` `Elite` `nodes` `taken` `Hard` `nodes` `taken` `Pokemon` `caught` `Relics` `held` `Standing` `at` `the` `end` `Turns` `taken` `Party` `slots` `Final` `party` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Mixed` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `Phys` `Attacker` `HP` `Dealt` `Taken` `KOs` `Faints` `Turns` `in` `battle` `Lv36` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Lv32` `fell` `at` `Gym` `to` `Lv30` `fell` `at` `Gym` `to` `Lv48` `fell` `at` `Gym` `to` `Lv21` `fell` `at` `Gym` `to` `Lv36` `fell` `at` `Gym` `to` `Lv44` `fell` `at` `Gym` `to` `Coverage` `Reaches` `Fighting` `Ghost` `Ground` `The` `run` `won` `in` `HP` `site` `rested` `HP` `Trainer's` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `site` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Shop` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `Shop` `rested` `HP` `Something` `happens` `rested` `HP` `Ghost` `won` `in` `HP` `Trainer` `won` `in` `HP` `Something` `happens` `rested` `HP` `won` `in` `HP` `won` `in` `HP` `Trainer` `won` `in` `HP` `won` `in` `HP` `won` `in` `HP` `GYMRUN-d4e080-SMOKE24` `r21`
- **log-sheet** (123): `GYMRUN` `Tutorial` `Map` `Party` `Trainer` `battle` `Trainer's` `Rookie` `rose` `Fully` `paralysed` `History` `started` `between` `Player` `and` `Opponent` `Go` `Opponent` `sent` `out` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `Turn` `The` `opposing` `used` `is` `paralyzed` `may` `be` `unable` `to` `move` `used` `The` `opposing` `was` `badly` `poisoned` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `is` `paralyzed` `can't` `move` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `rose` `sharply` `used` `Snorlax's` `rose` `sharply` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `The` `opposing` `used` `The` `opposing` `Golem's` `won't` `go` `any` `higher` `is` `paralyzed` `can't` `move` `The` `opposing` `was` `hurt` `by` `poison` `HP` `Turn` `GYMRUN-d4e080-SMOKE24` `r21`
